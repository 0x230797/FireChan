import { db } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, doc, updateDoc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { uploadConfig, imgbbConfig } from './config.js';
import { processText } from './text-processor.js';

const urlParams = new URLSearchParams(window.location.search);
const currentBoard = urlParams.get('board');

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
    loadThreads();
    updateBoardTitle();
});

// Función para generar el siguiente ID de post
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

        console.log('Imagen subida exitosamente a ImgBB:', result.data.url);
        return {
            url: result.data.url,
            width: dimensions.width,
            height: dimensions.height
        };
        
    } catch (error) {
        throw new Error('Error al subir imagen: ' + error.message);
    }
}

async function loadThreads() {
    const threadsContainer = document.getElementById('threadsContainer');
    threadsContainer.innerHTML = 'Cargando threads...';
    
    try {
        const q = query(
            collection(db, 'threads'),
            where('board', '==', currentBoard),
            orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        let threadsHTML = '';
        
        querySnapshot.forEach((doc) => {
            const thread = doc.data();
            const timestamp = thread.timestamp ? 
                (thread.timestamp.toDate ? thread.timestamp.toDate() : new Date(thread.timestamp)) 
                : new Date();
                
            // Crear sección de archivo si hay imagen
            const fileSection = thread.imageUrl ? `
                <div class="post-header-file">
                    <b>Archivo:</b>
                    <a href="${thread.imageUrl}" target="_blank" title="${thread.fileName || 'imagen.jpg'}">${thread.fileName || 'imagen.jpg'}</a>
                    ${thread.fileSize ? `(${formatFileSize(thread.fileSize)}${thread.imageWidth && thread.imageHeight ? `, ${thread.imageWidth}x${thread.imageHeight}` : ''})` : ''}
                </div>
            ` : '';

            threadsHTML += `
                <div class="thread-op">
                    ${fileSection}
                    <div class="post-image">
                        ${thread.imageUrl ? `<img src="${thread.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                    </div>
                    <div class="thread-header">
                        <span class="subject">${thread.subject || ''}</span>
                        <span class="name">${thread.name || 'Anónimo'}</span>
                        <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                        <span class="id">No.${thread.postId || 'N/A'}</span>
                        <a href="reply.html?board=${currentBoard}&thread=${thread.postId}" class="replies-btn">
                            Responder (${thread.replyCount || 0})
                        </a>
                        <button class="report-btn" onclick="reportPost('${doc.id}', 'thread', ${thread.postId}, '${encodeURIComponent(thread.name || 'Anónimo')}', '${encodeURIComponent(thread.comment)}', '${thread.imageUrl || ''}', '${currentBoard}')">Reportar</button>
                    </div>
                    <div class="comment">${processText(thread.comment)}</div>
                </div>
            `;
        });
        
        threadsContainer.innerHTML = threadsHTML || 'No hay threads en este tablón';
    } catch (error) {
        console.error('Error detallado:', error);
        threadsContainer.innerHTML = 'Error al cargar los threads: ' + error.message;
    }
}

window.submitThread = async () => {
    const subject = document.getElementById('postSubject').value;
    const name = document.getElementById('postName').value || 'Anónimo';
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
            // Usar ImgBB en lugar de Firebase Storage
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
            replyCount: 0
        });

        console.log('Thread creado exitosamente');
        alert('Thread creado exitosamente!');

        // Limpiar formulario
        document.getElementById('postSubject').value = '';
        document.getElementById('postName').value = '';
        document.getElementById('postComment').value = '';
        document.getElementById('postFile').value = '';
        
        document.getElementById('postFormContainer').style.display = 'none';
        loadThreads();
    } catch (error) {
        console.error('Error general:', error);
        alert('Error al crear el thread: ' + error.message);
    }
};

function updateBoardTitle() {
    const boardTitles = {
        'b': 'Random',
        'g': 'Tecnología',
        'v': 'Videojuegos',
        'a': 'Anime & Manga',
        'fit': 'Fitness',
        'mu': 'Música',
        'pol': 'Política',
        'x': 'Paranormal'
    };

    document.getElementById('boardTitle').textContent = `/${currentBoard}/ - ${boardTitles[currentBoard] || ''}`;
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
