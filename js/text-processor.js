// Lista de dominios baneados
const bannedDomains = [
    'xvideo.com',
    'xvideos.com',
    'pornhub.com',
    'xhamster.com',
    'redtube.com',
    'youjizz.com',
    'tube8.com',
    'spankbang.com',
    'eporner.com',
    'tnaflix.com'
];

// Función para escapar HTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Función para procesar URLs
function processUrls(text) {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`\[\]]*)?)/gi;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const beforeUrl = text.substring(lastIndex, match.index);
            parts.push(escapeHtml(beforeUrl));
        }
        
        let url = match[0].trim();
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        if (url.startsWith('http://')) {
            url = url.replace('http://', 'https://');
        }
        
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
            
            if (bannedDomains.some(bannedDomain => domain.includes(bannedDomain))) {
                parts.push('<span class="banned-url">[URL BANEADA]</span>');
            } else {
                parts.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="url-link">${match[0]}</a>`);
            }
        } catch (e) {
            parts.push(escapeHtml(match[0]));
        }
        
        lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
        parts.push(escapeHtml(text.substring(lastIndex)));
    }
    
    return parts.join('');
}

// Función para procesar solo referencias (sin URLs)
function processReferences(text, inheritColor = false) {
    let processedText = text;
    const colorStyle = inheritColor ? 'color: inherit;' : '';
    
    console.log('Processing references for:', text); // Debug log
    
    // Primero procesar referencias cross-board con ID (ej: >>/b/123)
    processedText = processedText.replace(/>>\/([\w]+)\/(\d+)/g, (match, board, postId) => {
        console.log('Found cross-board with ID:', match); // Debug log
        return `<span class="post-reference cross-board" data-post-id="${postId}" data-board="${board}" onclick="highlightPost('${postId}', '${board}')" onmouseover="showPostPreview(event, '${postId}', '${board}')" onmouseout="hidePostPreview()">&gt;&gt;/${board}/${postId}</span>`;
    });
    
    // Luego procesar referencias a boards sin ID (ej: >>/b/)
    processedText = processedText.replace(/>>\/([\w]+)\/$/g, (match, board) => {
        console.log('Found board reference:', match); // Debug log
        return `<span class="board-reference" data-board="${board}" onclick="navigateToBoard('${board}')">&gt;&gt;/${board}/</span>`;
    });
    
    // También procesar referencias a boards que están seguidas de espacios o al final de línea
    processedText = processedText.replace(/>>\/([\w]+)\/(?=\s|$)/g, (match, board) => {
        console.log('Found board reference (with space/end):', match); // Debug log
        return `<span class="board-reference" data-board="${board}" onclick="navigateToBoard('${board}')">&gt;&gt;/${board}/</span>`;
    });
    
    // Finalmente procesar referencias locales (ej: >>123)
    processedText = processedText.replace(/>>(\d+)(?![\/\w])/g, (match, postId) => {
        console.log('Found local reference:', match); // Debug log
        return `<span class="post-reference" data-post-id="${postId}" onclick="highlightPost('${postId}')" onmouseover="showPostPreview(event, '${postId}')" onmouseout="hidePostPreview()">&gt;&gt;${postId}</span>`;
    });
    
    console.log('Result after processing references:', processedText); // Debug log
    return processedText;
}

// Función para procesar URLs sin convertirlas en enlaces (solo para greentext y pinktext)
function processUrlsAsText(text) {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`\[\]]*)?)/gi;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const beforeUrl = text.substring(lastIndex, match.index);
            parts.push(escapeHtml(beforeUrl));
        }
        
        let url = match[0].trim();
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        if (url.startsWith('http://')) {
            url = url.replace('http://', 'https://');
        }
        
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
            
            if (bannedDomains.some(bannedDomain => domain.includes(bannedDomain))) {
                parts.push('<span class="banned-url">[URL BANEADA]</span>');
            } else {
                parts.push(escapeHtml(url));
            }
        } catch (e) {
            parts.push(escapeHtml(match[0]));
        }
        
        lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
        parts.push(escapeHtml(text.substring(lastIndex)));
    }
    
    return parts.join('');
}

// Función para procesar greentext, pinktext, menciones y URLs
export function processText(text) {
    if (!text) return '';
    
    const lines = text.split('\n');
    
    const processedLines = lines.map(line => {
        const trimmedLine = line.trim();
        
        if (/>>(\d+)/.test(trimmedLine) || />>\/([\w]+)\//.test(trimmedLine)) {
            // Procesar referencias primero
            let processedLine = processReferences(line, false);
            
            return processedLine.replace(/([^>]|^)(https?:\/\/[^\s<>"{}|\\^`\[\]]+|(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`\[\]]*)?)/gi, (fullMatch, prefix, url) => {
                let processedUrl = url.trim();
                
                if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
                    processedUrl = 'https://' + processedUrl;
                }
                
                if (processedUrl.startsWith('http://')) {
                    processedUrl = processedUrl.replace('http://', 'https://');
                }
                
                try {
                    const urlObj = new URL(processedUrl);
                    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
                    
                    if (bannedDomains.some(bannedDomain => domain.includes(bannedDomain))) {
                        return prefix + '<span class="banned-url">[URL BANEADA]</span>';
                    } else {
                        return prefix + `<a href="${processedUrl}" target="_blank" rel="noopener noreferrer" class="url-link">${url}</a>`;
                    }
                } catch (e) {
                    return prefix + escapeHtml(url);
                }
            });
        }
        else if (trimmedLine.startsWith('>') && !trimmedLine.startsWith('>>') && trimmedLine.length > 1) {
            let processedLine = processUrlsAsText(line);
            processedLine = processReferences(processedLine, true);
            return `<span class="greentext">${processedLine}</span>`;
        }
        else if (trimmedLine.startsWith('<') && trimmedLine.length > 1) {
            let processedLine = processUrlsAsText(line);
            processedLine = processReferences(processedLine, true);
            return `<span class="pinktext">${processedLine}</span>`;
        }
        else {
            // Procesar referencias primero, luego URLs
            let processedLine = processReferences(line, false);
            return processUrls(processedLine);
        }
    });
    
    return processedLines.join('<br>');
}

// Función para procesar texto en elementos existentes
export function processTextInElement(element) {
    if (!element) return;
    
    const originalText = element.textContent || element.innerText;
    if (originalText) {
        element.innerHTML = processText(originalText);
    }
}

// Obtener el board actual de la URL
function getCurrentBoard() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('board');
}

// Función para navegar a un post específico en un board
async function navigateToPost(board, postId) {
    try {
        // Validar parámetros
        if (!board || !postId) {
            console.error('Parámetros inválidos: board y postId son requeridos');
            return false;
        }

        // Convertir postId a número
        const numPostId = parseInt(postId);
        if (isNaN(numPostId)) {
            console.error('postId debe ser un número válido:', postId);
            return false;
        }

        // Importar Firebase
        let db;
        try {
            const firebaseConfig = await import('./firebase-config.js');
            db = firebaseConfig.db;
        } catch (importError) {
            console.error('Error importando firebase-config.js:', importError);
            window.location.href = `index.html?board=${encodeURIComponent(board)}`;
            return false;
        }

        // Importar funciones de Firestore
        const { collection, query, where, getDocs } = await import(
            'https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js'
        );

        console.log(`Buscando post ${numPostId} en /${board}/`);

        // Búsqueda 1: Verificar si es un thread principal
        try {
            const threadsQuery = query(
                collection(db, 'threads'),
                where('board', '==', board),
                where('postId', '==', numPostId)
            );

            const threadsSnapshot = await getDocs(threadsQuery);

            if (!threadsSnapshot.empty) {
                console.log('Post encontrado como thread principal');
                const threadId = threadsSnapshot.docs[0].id;
                window.location.href = `thread.html?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(threadId)}`;
                return true;
            }
        } catch (threadError) {
            console.error('Error buscando en threads:', threadError);
        }

        // Búsqueda 2: Verificar si es una respuesta
        try {
            const repliesQuery = query(
                collection(db, 'replies'),
                where('board', '==', board),
                where('postId', '==', numPostId)
            );

            const repliesSnapshot = await getDocs(repliesQuery);

            if (!repliesSnapshot.empty) {
                console.log('Post encontrado como respuesta');
                const replyData = repliesSnapshot.docs[0].data();
                const threadId = replyData.threadId || replyData.thread;

                if (!threadId) {
                    console.error('Reply no tiene threadId asociado');
                    window.location.href = `index.html?board=${encodeURIComponent(board)}`;
                    return false;
                }

                window.location.href = `thread.html?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(threadId)}#post-${numPostId}`;
                return true;
            }
        } catch (replyError) {
            console.error('Error buscando en replies:', replyError);
        }

        // Post no encontrado
        console.warn(`Post ${numPostId} no encontrado en /${board}/`);
        window.location.href = `index.html?board=${encodeURIComponent(board)}`;
        return false;

    } catch (error) {
        console.error('Error inesperado en navigateToPost:', error);
        try {
            window.location.href = `index.html?board=${encodeURIComponent(board || 'general')}`;
        } catch (navError) {
            console.error('Error crítico en navegación fallback:', navError);
        }
        return false;
    }
}

// Función para navegar a un board específico
window.navigateToBoard = (board) => {
    console.log(`Navegando al board: /${board}/`);
    window.location.href = `thread.html?board=${encodeURIComponent(board)}`;
};

// Funciones globales para manejo de referencias
window.highlightPost = async (postId, board = null) => {
    console.log(`highlightPost llamado: postId=${postId}, board=${board}`);
    
    // Si es una referencia cross-board, redirigir directamente a reply.html
    if (board) {
        console.log(`Referencia cross-board detectada: navegando a /${board}/ thread ${postId}`);
        window.location.href = `reply.html?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(postId)}`;
        return;
    }
    
    document.querySelectorAll('.post-highlighted').forEach(el => {
        el.classList.remove('post-highlighted');
    });
    
    let postElement = document.querySelector(`[data-post-id="${postId}"]`) || 
                     document.querySelector(`[data-id="${postId}"]`);
    console.log(`Buscando post por ID: ${postElement ? 'encontrado' : 'no encontrado'}`);
    
    if (postElement) {
        const postContainer = postElement.closest('.thread, .reply, .thread-op, .reply-post');
        if (postContainer) {
            postContainer.classList.add('post-highlighted');
            postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                postContainer.classList.remove('post-highlighted');
            }, 3000);
        }
    } else {
        console.log(`Post ${postId} no encontrado en la página actual`);
        const currentBoard = getCurrentBoard();
        if (currentBoard) {
            window.location.href = `reply.html?board=${encodeURIComponent(currentBoard)}&thread=${encodeURIComponent(postId)}`;
        }
    }
};

window.showPostPreview = async (event, postId, board = null) => {
    hidePostPreview();
    
    if (board) {
        try {
            const preview = await fetchPostPreview(postId, board);
            if (preview) {
                showPreviewTooltip(event, preview);
            }
        } catch (error) {
            console.error('Error al obtener preview cross-board:', error);
        }
        return;
    }
    
    let postElement = document.querySelector(`[data-post-id="${postId}"]`) || 
                     document.querySelector(`[data-id="${postId}"]`);
    
    if (!postElement) {
        try {
            const preview = await fetchPostPreview(postId, board);
            if (preview) {
                showPreviewTooltip(event, preview);
            }
        } catch (error) {
            console.error('Error al obtener preview:', error);
        }
        return;
    }
    
    const postContainer = postElement.closest('.thread, .reply, .thread-op, .reply-post');
    if (postContainer) {
        const clone = postContainer.cloneNode(true);
        clone.classList.add('post-preview');
        showPreviewTooltip(event, clone.outerHTML);
    }
};

window.hidePostPreview = () => {
    const existingPreview = document.getElementById('postPreview');
    if (existingPreview) {
        existingPreview.remove();
    }
};

function showPreviewTooltip(event, content) {
    const preview = document.createElement('div');
    preview.id = 'postPreview';
    preview.className = 'post-preview-tooltip';
    preview.innerHTML = content;
    
    document.body.appendChild(preview);
    
    const rect = preview.getBoundingClientRect();
    const x = Math.min(event.clientX + 10, window.innerWidth - rect.width - 10);
    const y = Math.max(event.clientY - rect.height - 10, 10);
    
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
}

async function fetchPostPreview(postId, board = null) {
    try {
        const { db } = await import('./firebase-config.js');
        const { collection, query, where, getDocs } = await import(
            'https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js'
        );
        
        if (board) {
            try {
                const threadsQuery = query(
                    collection(db, 'threads'),
                    where('board', '==', board),
                    where('postId', '==', parseInt(postId))
                );
                
                const threadsSnapshot = await getDocs(threadsQuery);
                if (!threadsSnapshot.empty) {
                    const data = threadsSnapshot.docs[0].data();
                    return createPostPreviewHTML(data, postId, 'thread', board);
                }
            } catch (error) {
                console.log(`Error buscando thread en /${board}/:`, error);
            }
            
            try {
                const repliesQuery = query(
                    collection(db, 'replies'),
                    where('board', '==', board),
                    where('postId', '==', parseInt(postId))
                );
                
                const repliesSnapshot = await getDocs(repliesQuery);
                if (!repliesSnapshot.empty) {
                    const data = repliesSnapshot.docs[0].data();
                    return createPostPreviewHTML(data, postId, 'reply', board);
                }
            } catch (error) {
                console.log(`Error buscando reply en /${board}/:`, error);
            }
        } else {
            const currentBoard = getCurrentBoard();
            if (currentBoard) {
                return await fetchPostPreview(postId, currentBoard);
            }
        }
        
        return createNotFoundHTML(postId, board);
        
    } catch (error) {
        console.error('Error fetching post preview:', error);
        return createErrorHTML(postId, board);
    }
}

function createPostPreviewHTML(postData, postId, type, board) {
    const date = postData.timestamp ? new Date(postData.timestamp.seconds * 1000).toLocaleString().replace(',', '') : 'Fecha desconocida';
    const name = postData.name || 'Anónimo';
    const comment = postData.comment || '';
    const subject = postData.subject || '';
    
    // Verificar si es post de admin para aplicar estilo especial
    const nameClass = postData.isAdmin ? 'admin-name' : '';
    
    const fileSection = postData.imageUrl ? `
        <div class="post-header-file">
            <b>Archivo:</b>
            <a href="${postData.imageUrl}" target="_blank" title="${postData.fileName || 'imagen.jpg'}">${postData.fileName || 'imagen.jpg'}</a>
            ${postData.fileSize ? `(${postData.fileSize} KB${postData.imageWidth && postData.imageHeight ? `, ${postData.imageWidth}x${postData.imageHeight}` : ''})` : ''}
        </div>
    ` : '';

    const imageSection = postData.imageUrl ? `
        <div class="post-image">
            <img src="${postData.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">
        </div>
    ` : '';

    const processedComment = comment.length > 300 ? comment.substring(0, 300) + '...' : comment;
    
    return `
        <div class="thread-container">
            <div class="thread-op" data-post-id="${postId}" data-id="${postId}">
                ${fileSection}
                ${imageSection}
                <div class="thread-header">
                    <span class="board-indicator">/${board}/</span>
                    <span class="subject">${escapeHtml(subject)}</span>
                    <span class="name ${nameClass}">${escapeHtml(name)}</span>
                    <span class="date">${date}</span>
                </div>
                <div class="comment">${escapeHtml(processedComment)}</div>
            </div>
        </div>
    `;
}

function createNotFoundHTML(postId, board) {
    return `
        <div class="post-not-found">
            Este post no existe o ha sido eliminado.
        </div>
    `;
}

function createErrorHTML(postId, board) {
    return `
        <div class="post-not-found">
            Error al cargar el post. Inténtalo de nuevo.
        </div>
    `;
}

window.quotePost = (postId, threadId = null) => {
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('thread.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const board = urlParams.get('board');
        const quote = `>>${postId}\n`;
        
        const encodedQuote = encodeURIComponent(quote);
        const targetThreadId = threadId || postId;
        
        window.location.href = `reply.html?board=${board}&thread=${targetThreadId}&quote=${encodedQuote}`;
    } else {
        const commentField = document.getElementById('replyComment') || document.getElementById('postComment');
        if (commentField) {
            const currentText = commentField.value;
            const quote = `>>${postId}\n`;
            
            commentField.value = currentText ? currentText + '\n' + quote : quote;
            commentField.focus();
            
            const replyForm = document.getElementById('replyFormContainer');
            if (replyForm && replyForm.style.display === 'none') {
                replyForm.style.display = 'block';
            }
        }
    }
};