import { db } from './firebase-config.js';
import { collection, addDoc, getDoc, doc, query, where, orderBy, getDocs, updateDoc, increment, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { uploadConfig, imgbbConfig } from './config.js';
import { processText } from './text-processor.js';

const urlParams = new URLSearchParams(window.location.search);
const currentBoard = urlParams.get('board');
const threadId = urlParams.get('thread');

// Función para obtener o generar ID único del usuario
function getUserUniqueId() {
    let userId = localStorage.getItem('userUniqueId');
    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('userUniqueId', userId);
        localStorage.setItem('userFirstVisit', new Date().toISOString());
    }
    localStorage.setItem('userLastVisit', new Date().toISOString());
    return userId;
}

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
    loadThread();
    setupNavigation();
    loadQuoteFromURL();
    checkAdminStatusForForm();
    
    // Escuchar cambios en el localStorage para actualizar el formulario
    window.addEventListener('storage', function(e) {
        if (e.key === 'adminAuthenticated') {
            checkAdminStatusForForm();
        }
    });
});

// Función para verificar si es admin y modificar el formulario
function checkAdminStatusForForm() {
    const isAdmin = localStorage.getItem('adminAuthenticated') === 'true';
    const nameField = document.getElementById('replyName');
    
    if (nameField) {
        if (isAdmin) {
            nameField.value = 'Administrador';
            nameField.placeholder = 'Administrador';
            nameField.disabled = true;
            nameField.classList.add('admin-field');
        } else {
            nameField.value = '';
            nameField.placeholder = 'Anónimo';
            nameField.disabled = false;
            nameField.classList.remove('admin-field');
        }
    }
}

function setupNavigation() {
    const backLinks = document.querySelectorAll('#backLink');
    backLinks.forEach(link => {
        link.href = `thread.html?board=${currentBoard}`;
    });
}

function loadQuoteFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const quote = urlParams.get('quote');
    
    if (quote) {
        // Decodificar la cita y cargarla en el campo de comentario
        const decodedQuote = decodeURIComponent(quote);
        const commentField = document.getElementById('replyComment');
        
        if (commentField) {
            commentField.value = decodedQuote;
            
            // Mostrar el formulario de respuesta automáticamente
            const replyForm = document.getElementById('replyFormContainer');
            if (replyForm) {
                replyForm.style.display = 'block';
            }
            
            // Enfocar el campo de comentario al final del texto
            commentField.focus();
            commentField.setSelectionRange(commentField.value.length, commentField.value.length);
        }
        
        // Limpiar la URL para evitar que la cita se cargue múltiples veces
        const newURL = window.location.pathname + `?board=${currentBoard}&thread=${threadId}`;
        window.history.replaceState({}, document.title, newURL);
    }
}

// Función para generar el siguiente ID de post (igual que en thread.js)
async function getNextPostId() {
    try {
        return await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, 'counters', 'postId');
            const counterDoc = await transaction.get(counterRef);
            
            let newId;
            if (counterDoc.exists()) {
                newId = counterDoc.data().value + 1;
            } else {
                newId = 1; // Empezar desde 1
            }
            
            transaction.set(counterRef, { value: newId }, { merge: true });
            return newId;
        });
    } catch (error) {
        console.error('Error al generar ID:', error);
        // Fallback: usar timestamp
        return Date.now();
    }
}

// Función para obtener dimensiones de imagen
function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
                width: img.width,
                height: img.height
            });
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudieron obtener las dimensiones de la imagen'));
        };
        
        img.src = url;
    });
}

// Función para subir imagen a ImgBB
async function uploadImageToImgBB(file) {
    if (!imgbbConfig.apiKey || imgbbConfig.apiKey === "TU_API_KEY_AQUI") {
        throw new Error('API Key de ImgBB no configurada. Ve a https://api.imgbb.com/ para obtener una gratis.');
    }
    
    // Obtener dimensiones de la imagen
    const dimensions = await getImageDimensions(file);
    
    // Convertir archivo a base64
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remover el prefijo "data:image/...;base64,"
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // Crear FormData para la petición
    const formData = new FormData();
    formData.append('key', imgbbConfig.apiKey);
    formData.append('image', base64);
    formData.append('name', file.name.split('.')[0]); // Nombre sin extensión

    try {
        const response = await fetch(imgbbConfig.endpoint, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error?.message || 'Error desconocido de ImgBB');
        }
        return {
            url: result.data.url,
            width: dimensions.width,
            height: dimensions.height
        };
        
    } catch (error) {
        throw new Error('Error al subir imagen: ' + error.message);
    }
}

async function loadThread() {
    try {
        // Buscar thread por postId en lugar de por ID del documento
        const q = query(
            collection(db, 'threads'),
            where('postId', '==', parseInt(threadId)),
            where('board', '==', currentBoard)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            throw new Error('Thread no encontrado');
        }

        const threadDoc = querySnapshot.docs[0];
        const threadData = threadDoc.data();
        
        // Guardar el ID real del documento para usar en loadReplies
        window.actualThreadId = threadDoc.id;
        
        displayThread(threadData, threadDoc.id);
        await loadReplies();
        
        // Implementar la función de búsqueda de posts para previews
        window.fetchPostPreview = fetchPostPreview;
    } catch (error) {
        document.getElementById('threadContainer').innerHTML = 'Error: ' + error.message;
    }
}

function displayThread(thread, id) {
    const timestamp = thread.timestamp ? 
        (thread.timestamp.toDate ? thread.timestamp.toDate() : new Date(thread.timestamp)) 
        : new Date();

    // Verificar si es post de admin para aplicar estilo especial
    const nameClass = thread.isAdmin ? 'admin-name' : '';
    const displayName = thread.name || 'Anónimo';

    // Crear sección de archivo si hay imagen
    const fileSection = thread.imageUrl ? `
        <div class="post-header-file">
            <b>Archivo:</b>
            <a href="${thread.imageUrl}" target="_blank" title="${thread.fileName || 'imagen.jpg'}">${thread.fileName || 'imagen.jpg'}</a>
            ${thread.fileSize ? `(${formatFileSize(thread.fileSize)}${thread.imageWidth && thread.imageHeight ? `, ${thread.imageWidth}x${thread.imageHeight}` : ''})` : ''}
        </div>
    ` : '';

    const container = document.getElementById('threadContainer');
    container.innerHTML = `
        <div class="thread thread-op no-float" id="${thread.postId || 'N/A'}" data-id="${thread.postId || 'N/A'}" data-post-id="${thread.postId || 'N/A'}">
            ${fileSection}
            <div class="post-image">
                ${thread.imageUrl ? `<img src="${thread.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
            </div>
            <div class="thread-header">
                <span class="subject">${thread.subject || ''}</span>
                <span class="name ${nameClass}">${displayName}</span>
                <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                <span class="id" onclick="quotePost('${thread.postId || 'N/A'}', '${thread.postId || 'N/A'}')" style="cursor: pointer;">No.${thread.postId || 'N/A'}</span>
                [<button class="report-btn" onclick="reportPost('${doc.id}', 'reply', ${thread.postId}, '${encodeURIComponent(displayName)}', '${encodeURIComponent(thread.comment)}', '${thread.imageUrl || ''}', '${currentBoard}')">Reportar</button>]
            </div>
            <div class="comment">${processText(thread.comment)}</div>
        </div>
    `;
}

async function loadReplies() {
    const repliesContainer = document.getElementById('repliesContainer');
    try {
        // Usar el ID real del documento que guardamos en loadThread
        const actualId = window.actualThreadId || threadId;
        const q = query(
            collection(db, 'replies'),
            where('threadId', '==', actualId),
            orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        let repliesHTML = '';
        
        querySnapshot.forEach((doc) => {
            const reply = doc.data();
            const timestamp = reply.timestamp ? 
                (reply.timestamp.toDate ? reply.timestamp.toDate() : new Date(reply.timestamp)) 
                : new Date();

            // Verificar si es post de admin para aplicar estilo especial
            const nameClass = reply.isAdmin ? 'admin-name' : '';
            const displayName = reply.name || 'Anónimo';

            // Crear sección de archivo para reply si hay imagen
            const replyFileSection = reply.imageUrl ? `
                <div class="post-header-file">
                    <b>Archivo:</b>
                    <a href="${reply.imageUrl}" target="_blank" title="${reply.fileName || 'imagen.jpg'}">${reply.fileName || 'imagen.jpg'}</a>
                    ${reply.fileSize ? `(${formatFileSize(reply.fileSize)}${reply.imageWidth && reply.imageHeight ? `, ${reply.imageWidth}x${reply.imageHeight}` : ''})` : ''}
                </div>
            ` : '';

            repliesHTML += `
                <div class="reply-post" data-post-id="${reply.postId}" data-id="${reply.postId}" id="${reply.postId}">
                    ${replyFileSection}
                    <div class="post-image">
                        ${reply.imageUrl ? `<img src="${reply.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                    </div>
                    <div class="reply-header">
                        <span class="name ${nameClass}">${displayName}</span>
                        <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                        <span class="id" onclick="quotePost('${reply.postId || 'N/A'}', '${threadId}')" style="cursor: pointer;">No.${reply.postId || 'N/A'}</span>
                        [<button class="report-btn" onclick="reportPost('${doc.id}', 'reply', ${reply.postId}, '${encodeURIComponent(displayName)}', '${encodeURIComponent(reply.comment)}', '${reply.imageUrl || ''}', '${currentBoard}')">Reportar</button>]
                    </div>
                    <div class="comment">${processText(reply.comment)}</div>
                </div>
            `;
        });
        
        repliesContainer.innerHTML = repliesHTML || 'No hay respuestas aún';
    } catch (error) {
        console.error('Error detallado:', error);
        repliesContainer.innerHTML = 'Error al cargar las respuestas: ' + error.message;
    }
}

window.submitReply = async () => {
    // Verificar si el administrador está logueado
    const isAdmin = localStorage.getItem('adminAuthenticated') === 'true';
    let name = document.getElementById('replyName').value;
    
    // Si no se especifica nombre, usar 'Administrador' si es admin, o 'Anónimo' si no
    if (!name) {
        name = isAdmin ? 'Administrador' : 'Anónimo';
    }
    
    const comment = document.getElementById('replyComment').value;
    const file = document.getElementById('replyFile').files[0];

    if (!comment) {
        alert('El comentario es obligatorio');
        return;
    }

    // Detectar si el comentario contiene referencias a otros posts
    const referencedPostIds = extractReferencedPosts(comment);
    let parentPostId = null;
    
    // Si hay referencias, tomar la primera como parent (respuesta directa)
    if (referencedPostIds.length > 0) {
        parentPostId = referencedPostIds[0];
    }

    if (file) {
        // Validar tamaño
        if (file.size > uploadConfig.maxFileSize) {
            alert(uploadConfig.errorMessages.size);
            return;
        }
        // Validar tipo
        if (!uploadConfig.allowedTypes.includes(file.type)) {
            alert(uploadConfig.errorMessages.type);
            return;
        }
    }

    try {
        // Generar ID único para la respuesta
        const postId = await getNextPostId();
        
        let imageUrl = null;
        let fileName = null;
        let fileSize = null;
        let imageWidth = null;
        let imageHeight = null;
        
        if (file) {
            try {
                const uploadResult = await uploadImageToImgBB(file);
                imageUrl = uploadResult.url;
                imageWidth = uploadResult.width;
                imageHeight = uploadResult.height;
                fileName = file.name;
                fileSize = file.size;
            } catch (uploadError) {
                alert('Error al subir imagen: ' + uploadError.message);
                return;
            }
        }

        // Usar el ID real del documento
        const actualId = window.actualThreadId || threadId;
        
        await addDoc(collection(db, 'replies'), {
            threadId: actualId,
            name,
            comment,
            imageUrl,
            fileName,
            fileSize,
            imageWidth,
            imageHeight,
            postId,
            parentPostId,
            referencedPosts: referencedPostIds,
            timestamp: serverTimestamp(),
            isAdmin: isAdmin,  // Marcar si es post de admin
            userId: getUserUniqueId(),  // Agregar ID único del usuario
            board: currentBoard  // Agregar board para estadísticas
        });

        // Incrementar el contador de respuestas en el thread
        await updateDoc(doc(db, 'threads', actualId), {
            replyCount: increment(1)
        });

        // Limpiar formulario
        document.getElementById('replyName').value = '';
        document.getElementById('replyComment').value = '';
        document.getElementById('replyFile').value = '';
        
        loadReplies();
    } catch (error) {
        alert('Error al publicar la respuesta: ' + error.message);
    }
};

window.showReplyForm = () => {
    document.getElementById('replyFormContainer').style.display = 'block';
};

window.openLightbox = (src) => {
    document.getElementById('lightbox').style.display = 'flex';
    document.getElementById('lightboxImg').src = src;
};

window.closeLightbox = () => {
    document.getElementById('lightbox').style.display = 'none';
};

window.reportPost = (contentId, contentType, postId, name, comment, imageUrl, board) => {
    // Decodificar entidades HTML y limpiar texto
    name = decodeURIComponent(name || '').replace(/'/g, "\\'");
    comment = decodeURIComponent(comment || '').replace(/'/g, "\\'");
    const reasons = [
        'Contenido inapropiado',
        'Spam',
        'Contenido ilegal',
        'Violación de reglas',
        'Otro'
    ];
    
    let reasonsList = reasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n');
    
    const reasonInput = prompt(`Selecciona una razón para reportar esta publicación:\n\n${reasonsList}\n\nEscribe el número (1-5) o una razón personalizada:`);
    
    if (reasonInput === null || reasonInput.trim() === '') {
        return; // Usuario canceló
    }
    
    let selectedReason;
    const reasonNumber = parseInt(reasonInput);
    
    if (reasonNumber >= 1 && reasonNumber <= 5) {
        selectedReason = reasons[reasonNumber - 1];
    } else {
        selectedReason = reasonInput.trim();
    }
    
    // Enviar reporte
    submitReport(contentId, contentType, postId, name, comment, imageUrl, board, selectedReason);
};

async function submitReport(contentId, contentType, postId, name, comment, imageUrl, board, reason) {
    try {
        await addDoc(collection(db, 'reports'), {
            contentId,
            contentType,
            postId,
            name,
            comment,
            imageUrl,
            board,
            reason,
            timestamp: serverTimestamp()
        });
        
        alert('Reporte enviado exitosamente. Los administradores lo revisarán.');
    } catch (error) {
        console.error('Error al enviar reporte:', error);
        alert('Error al enviar el reporte: ' + error.message);
    }
}

// Función para extraer números de posts referenciados en un comentario
function extractReferencedPosts(comment) {
    const matches = comment.match(/>>(\d+)/g);
    if (!matches) return [];
    
    return matches.map(match => match.replace('>>', '')).filter((id, index, self) => {
        // Remover duplicados
        return self.indexOf(id) === index;
    });
}

// Función para buscar y mostrar preview de un post
async function fetchPostPreview(postId) {
    try {
        // Primero buscar en threads (post original)
        const threadQuery = query(
            collection(db, 'threads'),
            where('postId', '==', parseInt(postId)),
            where('board', '==', currentBoard)
        );
        
        const threadSnapshot = await getDocs(threadQuery);
        
        if (!threadSnapshot.empty) {
            const threadData = threadSnapshot.docs[0].data();
            const timestamp = threadData.timestamp ? 
                (threadData.timestamp.toDate ? threadData.timestamp.toDate() : new Date(threadData.timestamp)) 
                : new Date();
                
            // Verificar si es post de admin para aplicar estilo especial
            const nameClass = threadData.isAdmin ? 'admin-name' : '';
            const displayName = threadData.name || 'Anónimo';
                
            return `
                <div class="thread thread-op post-preview">
                    <div class="thread-header">
                        <span class="subject">${threadData.subject || ''}</span>
                        <span class="name ${nameClass}">${displayName}</span>
                        <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                        <span class="id">No.${threadData.postId}</span>
                    </div>
                    <div class="comment">${processText(threadData.comment)}</div>
                    ${threadData.imageUrl ? `<div class="post-image"><img src="${threadData.imageUrl}" class="thread-image preview-image"></div>` : ''}
                </div>
            `;
        }
        
        // Si no es un thread, buscar en replies
        const replyQuery = query(
            collection(db, 'replies'),
            where('postId', '==', parseInt(postId))
        );
        
        const replySnapshot = await getDocs(replyQuery);
        
        if (!replySnapshot.empty) {
            const replyData = replySnapshot.docs[0].data();
            const timestamp = replyData.timestamp ? 
                (replyData.timestamp.toDate ? replyData.timestamp.toDate() : new Date(replyData.timestamp)) 
                : new Date();
                
            // Verificar si es post de admin para aplicar estilo especial
            const nameClass = replyData.isAdmin ? 'admin-name' : '';
            const displayName = replyData.name || 'Anónimo';
                
            return `
                <div class="reply-post post-preview">
                    <div class="reply-header">
                        <span class="name ${nameClass}">${displayName}</span>
                        <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                        <span class="id">No.${replyData.postId}</span>
                    </div>
                    <div class="comment">${processText(replyData.comment)}</div>
                    ${replyData.imageUrl ? `<div class="post-image"><img src="${replyData.imageUrl}" class="thread-image preview-image"></div>` : ''}
                </div>
            `;
        }
        
        return null;
    } catch (error) {
        console.error('Error al obtener preview del post:', error);
        return null;
    }
}
