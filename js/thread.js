import { db } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { uploadConfig, uploadImageToServer, deleteImageFromServer } from './upload-system.js';
import { processText } from './text-processor.js';
import { ipBanSystem } from './ip-ban-system.js';
import { firebaseAuth } from './firebase-auth.js';
import { formatFileSize, getUserUniqueId, getNextPostId } from './utils.js';
import { validateCaptcha } from './captcha-system.js';

const urlParams = new URLSearchParams(window.location.search);
const currentBoard = urlParams.get('board');

document.addEventListener('DOMContentLoaded', () => {
    loadThreads();
    updateBoardTitle();
    checkAdminStatusForForm();
    
    checkAdminStatusForForm();
    
    // Escuchar cambios en el estado de autenticación
    firebaseAuth.onAuthStateChange(() => {
        checkAdminStatusForForm();
    });
});

// Función para verificar si es admin y modificar el formulario usando Firebase Auth
function checkAdminStatusForForm() {
    const isAdmin = firebaseAuth.requireAdminAuth();
    const nameField = document.getElementById('postName');
    
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

async function loadThreads() {
    const threadsContainer = document.getElementById('threadsContainer');
    threadsContainer.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <span>Cargando publicaciones...</span>
        </div>`;
    
    try {
        const q = query(
            collection(db, 'threads'),
            where('board', '==', currentBoard),
            orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        let threads = [];
        
        // Recopilar todos los threads y contar respuestas
        for (const doc of querySnapshot.docs) {
            const thread = doc.data();
            const timestamp = thread.timestamp ? 
                (thread.timestamp.toDate ? thread.timestamp.toDate() : new Date(thread.timestamp)) 
                : new Date();

            // Contar respuestas reales del thread
            const repliesQuery = query(
                collection(db, 'replies'),
                where('threadId', '==', doc.id)
            );
            const repliesSnapshot = await getDocs(repliesQuery);
            const actualReplyCount = repliesSnapshot.size;

            threads.push({
                docId: doc.id,
                data: thread,
                timestamp: timestamp,
                replyCount: actualReplyCount
            });
        }

        // Ordenar: primero los pinneados, luego por timestamp
        threads.sort((a, b) => {
            // Si uno está pinneado y el otro no, el pinneado va primero
            if (a.data.isPinned && !b.data.isPinned) return -1;
            if (!a.data.isPinned && b.data.isPinned) return 1;
            
            // Si ambos tienen el mismo estado de pin, ordenar por timestamp
            return b.timestamp - a.timestamp;
        });

        let threadsHTML = '';
        
        // Procesar cada thread ordenado
        for (const threadItem of threads) {
            const thread = threadItem.data;
            const timestamp = threadItem.timestamp;
            const actualReplyCount = threadItem.replyCount;
            const doc = { id: threadItem.docId };
                
            // Crear sección de archivo si hay imagen
            const fileSection = thread.imageUrl ? `
                <div class="post-header-file">
                    <b>Archivo:</b>
                    <a href="${thread.imageUrl}" target="_blank" title="${thread.fileName || 'imagen.jpg'}">${thread.fileName || 'imagen.jpg'}</a>
                    ${thread.fileSize ? `(${formatFileSize(thread.fileSize)}${thread.imageWidth && thread.imageHeight ? `, ${thread.imageWidth}x${thread.imageHeight}` : ''})` : ''}
                </div>
            ` : '';

            // Cargar las últimas 5 respuestas de este thread
            const repliesHTML = await loadLastReplies(threadItem.docId, actualReplyCount, thread.postId);
            
            // Verificar si es post de admin para aplicar estilo especial
            const nameClass = thread.isAdmin ? 'admin-name' : '';
            const displayName = thread.name || 'Anónimo';

            // Badges para pin y block
            const pinBadge = thread.isPinned ? '<img class="badge badge-pin" src="src/imgs/sticky.png" alt="Pinned" title="Thread fijado">' : '';
            const blockBadge = thread.isBlocked ? '<img class="badge badge-block" src="src/imgs/lock.png" alt="Blocked" title="Thread bloqueado">' : '';

            threadsHTML += `
                <div class="thread-container ${thread.isPinned ? 'pinned-thread' : ''} ${thread.isBlocked ? 'blocked-thread' : ''}">
                    <div class="thread-op" data-post-id="${thread.postId}" data-id="${thread.postId}" id="${thread.postId}">
                        ${fileSection}
                        <div class="post-image">
                            ${thread.imageUrl ? `<img src="${thread.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                        </div>
                        <div class="thread-header">
                            <span class="subject">${thread.subject || ''}</span>
                            ${pinBadge}
                            ${blockBadge}
                            <span class="name ${nameClass}">${displayName}</span>
                            <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                            <span class="id" onclick="quotePost('${thread.postId || 'N/A'}', '${thread.postId || 'N/A'}')" style="cursor: pointer;" title="Responder a esta publicación">No.${thread.postId || 'N/A'}</span>
                            [<a href="reply.html?board=${currentBoard}&thread=${thread.postId}">Responder</a> (${actualReplyCount})]
                            [<button class="report-btn" onclick="reportPost('${doc.id}', 'thread', ${thread.postId}, '${encodeURIComponent(displayName)}', '${encodeURIComponent(thread.comment)}', '${thread.imageUrl || ''}', '${currentBoard}')">Reportar</button>]
                        </div>
                        <div class="comment">${processText(thread.comment)}</div>
                    </div>
                    ${repliesHTML}
                </div>
                <div class="clear"></div>
            `;
        }
        
        threadsContainer.innerHTML = threadsHTML || 'No hay threads en este tablón';
    } catch (error) {
        threadsContainer.innerHTML = 'Error al cargar los threads: ' + error.message;
    }
}

window.submitThread = async () => {
    // Verificar ban antes de proceder
    const canPost = await ipBanSystem.checkBanBeforeAction('crear un nuevo thread');
    if (!canPost) {
        return; // El sistema de ban ya maneja la UI
    }
    
    // Validar CAPTCHA antes de proceder
    const captchaValid = await validateCaptcha();
    if (!captchaValid) {
        return; // El sistema CAPTCHA ya maneja los errores
    }
    
    const subject = document.getElementById('postSubject').value;
    
    // Verificar si el administrador está logueado usando Firebase Auth
    const isAdmin = firebaseAuth.requireAdminAuth();
    let name = document.getElementById('postName').value;
    
    // Si no se especifica nombre, usar 'Administrador' si es admin, o 'Anónimo' si no
    if (!name) {
        name = isAdmin ? 'Administrador' : 'Anónimo';
    }
    
    const comment = document.getElementById('postComment').value;
    const file = document.getElementById('postFile').files[0];

    if (!comment) {
        alert('El comentario es obligatorio');
        return;
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
        // Generar ID único para el post
        const postId = await getNextPostId();
        
        let imageUrl = null;
        let fileName = null;
        let fileSize = null;
        let imageWidth = null;
        let imageHeight = null;
        
        if (file) {
            // Subir imagen al servidor local
            try {
                const uploadResult = await uploadImageToServer(file, currentBoard);
                imageUrl = uploadResult.url;
                imageWidth = uploadResult.width;
                imageHeight = uploadResult.height;
                fileName = uploadResult.fileName;
                fileSize = uploadResult.size;
            } catch (uploadError) {
                alert('Error al subir imagen: ' + uploadError.message);
                return;
            }
        }

        // Obtener IP del usuario
        const userIP = await ipBanSystem.getUserIP();

        await addDoc(collection(db, 'threads'), {
            board: currentBoard,
            name,
            subject,
            comment,
            imageUrl,
            fileName,
            fileSize,
            imageWidth,
            imageHeight,
            postId,
            timestamp: serverTimestamp(),
            replyCount: 0,
            isAdmin: isAdmin,  // Marcar si es post de admin
            userId: getUserUniqueId(),  // Agregar ID único del usuario
            userIP: userIP  // Registrar IP del usuario
        });

        alert('Thread creado exitosamente!');

        // Limpiar formulario
        document.getElementById('postSubject').value = '';
        document.getElementById('postName').value = '';
        document.getElementById('postComment').value = '';
        document.getElementById('postFile').value = '';
        
        document.getElementById('postFormContainer').style.display = 'none';
        loadThreads();
    } catch (error) {
        alert('Error al crear el thread: ' + error.message);
    }
};

function updateBoardTitle() {
    const boardTitles = {
        'a': 'Anime y Manga',
        'b': 'Aleatorio',
        'g': 'Tecnología',
        'v': 'Videojuegos',
        'pol': 'Política',
        'x': 'Paranormal',
        'me': 'Meta'
    };

    const boardDescriptions = {
        'a': 'Anime, manga y cultura japonesa',
        'b': 'Conversaciones aleatorias y contenido variado',
        'g': 'Discusiones sobre tecnología, programación y gadgets',
        'v': 'Todo sobre videojuegos y gaming',
        'pol': 'Política y actualidad',
        'x': 'Temas paranormales y misterios',
        'me': 'Sugerencias, dudas y comentarios sobre el sitio'
    };

    document.getElementById('boardTitle').textContent = boardTitles[currentBoard] || '';
    document.getElementById('boardSubtitle').textContent = boardDescriptions[currentBoard] || '';
}

window.showPostForm = () => {
    document.getElementById('postFormContainer').style.display = 'block';
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
        // Obtener IP del usuario que reporta
        const reporterIP = await ipBanSystem.getUserIP();
        
        // Obtener IP del autor del contenido reportado
        let authorIP = 'No disponible';
        let threadId = null;
        
        try {
            if (contentType === 'thread') {
                // Obtener la IP del thread
                const threadDoc = await getDoc(doc(db, 'threads', contentId));
                if (threadDoc.exists()) {
                    const threadData = threadDoc.data();
                    authorIP = threadData.userIP || threadData.ip || 'No disponible';
                }
            } else if (contentType === 'reply') {
                // Obtener la IP de la respuesta
                const replyDoc = await getDoc(doc(db, 'replies', contentId));
                if (replyDoc.exists()) {
                    const replyData = replyDoc.data();
                    authorIP = replyData.userIP || replyData.ip || 'No disponible';
                    threadId = replyData.threadId; // Guardar threadId para respuestas
                }
            }
        } catch (error) {
            console.error('Error al obtener IP del autor:', error);
        }

        await addDoc(collection(db, 'reports'), {
            contentId,
            contentType,
            postId,
            name,
            comment,
            imageUrl,
            board,
            reason,
            timestamp: serverTimestamp(),
            reporterIP: reporterIP,
            userIP: authorIP, // IP del autor del contenido
            threadId: threadId // Solo para respuestas
        });
        
        alert('Reporte enviado exitosamente. Los administradores lo revisarán.');
    } catch (error) {
        alert('Error al enviar el reporte: ' + error.message);
    }
}

// Función para cargar las últimas 5 respuestas de un thread
async function loadLastReplies(threadId, totalReplies, threadPostId) {
    try {
        if (!totalReplies || totalReplies === 0) {
            return '';
        }

        const q = query(
            collection(db, 'replies'),
            where('threadId', '==', threadId),
            orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const allReplies = [];
        const displayedReplies = [];
        
        // Obtener todas las respuestas y separar las que se mostrarán
        let count = 0;
        querySnapshot.forEach((doc) => {
            const replyData = { 
                ...doc.data(), 
                id: doc.id,
                threadId: threadId // Asegurar que el threadId esté presente
            };
            allReplies.push(replyData);
            
            if (count < 5) {
                displayedReplies.push(replyData);
                count++;
            }
        });
        
        // Invertir el array de respuestas mostradas para orden cronológico
        displayedReplies.reverse();
        
        let repliesHTML = '';
        
        // Agregar indicador si hay más respuestas
        if (totalReplies > 5) {
            const omittedCount = totalReplies - 5;
            
            // Contar imágenes en las respuestas omitidas
            const omittedReplies = allReplies.slice(5);
            const omittedImagesCount = omittedReplies.filter(reply => reply.imageUrl).length;
            
            let imagesText = '';
            if (omittedImagesCount > 0) {
                imagesText = ` y ${omittedImagesCount} imagen${omittedImagesCount > 1 ? 'es' : ''}`;
            }
            
            repliesHTML += `
                <div class="omitted-replies">
                    <em>${omittedCount} respuesta${omittedCount > 1 ? 's' : ''} ${imagesText} omitida${omittedCount > 1 ? 's' : ''}. 
                        <a href="reply.html?board=${currentBoard}&thread=${threadPostId}">Click aquí</a> para ver todas.
                    </em>
                </div>
            `;
        }
        
        // Generar HTML para cada respuesta mostrada
        displayedReplies.forEach((reply) => {
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
                <div class="reply-post reply-preview" id="${reply.postId}" data-post-id="${reply.postId}" data-id="${reply.postId}">
                    ${replyFileSection}
                    <div class="post-image">
                        ${reply.imageUrl ? `<img src="${reply.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                    </div>
                    <div class="reply-header">
                        <span class="name ${nameClass}">${displayName}</span>
                        <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                        <span class="id" onclick="quotePost('${reply.postId || 'N/A'}', '${threadPostId}')" style="cursor: pointer;">No.${reply.postId || 'N/A'}</span>
                        [<button class="report-btn" onclick="reportPost('${reply.id}', 'reply', ${reply.postId}, '${encodeURIComponent(displayName)}', '${encodeURIComponent(reply.comment)}', '${reply.imageUrl || ''}', '${currentBoard}')">Reportar</button>]
                    </div>
                    <div class="comment">${processText(reply.comment)}</div>
                </div>
            `;
        });
        
        return repliesHTML;
    } catch (error) {
        return '';
    }
}
