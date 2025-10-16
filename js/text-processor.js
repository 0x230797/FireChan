// Función para procesar greentext, pinktext y menciones
export function processText(text) {
    if (!text) return '';
    
    // Dividir el texto en líneas
    const lines = text.split('\n');
    
    // Procesar cada línea
    const processedLines = lines.map(line => {
        const trimmedLine = line.trim();
        
        // Primero verificar si es una referencia >>numero
        if (/>>(\d+)/.test(trimmedLine)) {
            // Procesar referencias sin escapar HTML aún
            return line.replace(/>>(\d+)/g, (match, postId) => {
                return `<span class="post-reference" data-post-id="${postId}" onclick="highlightPost('${postId}')" onmouseover="showPostPreview(event, '${postId}')" onmouseout="hidePostPreview()">&gt;&gt;${postId}</span>`;
            });
        }
        // Greentext: líneas que empiezan con > pero NO con >>
        else if (trimmedLine.startsWith('>') && !trimmedLine.startsWith('>>') && trimmedLine.length > 1) {
            return `<span class="greentext">${escapeHtml(line)}</span>`;
        }
        // Pinktext: líneas que empiezan con <
        else if (trimmedLine.startsWith('<') && trimmedLine.length > 1) {
            return `<span class="pinktext">${escapeHtml(line)}</span>`;
        }
        // Línea normal - escapar HTML y luego procesar referencias
        else {
            let escapedLine = escapeHtml(line);
            // Buscar referencias ya escapadas (&gt;&gt;)
            return escapedLine.replace(/&gt;&gt;(\d+)/g, (match, postId) => {
                return `<span class="post-reference" data-post-id="${postId}" onclick="highlightPost('${postId}')" onmouseover="showPostPreview(event, '${postId}')" onmouseout="hidePostPreview()">&gt;&gt;${postId}</span>`;
            });
        }
    });
    
    // Unir las líneas con <br>
    return processedLines.join('<br>');
    
    // Función local para escapar HTML
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Función para procesar texto en elementos existentes
export function processTextInElement(element) {
    if (!element) return;
    
    const originalText = element.textContent || element.innerText;
    if (originalText) {
        element.innerHTML = processText(originalText);
    }
}

// Funciones globales para manejo de referencias
window.highlightPost = (postId) => {
    // Remover highlight anterior
    document.querySelectorAll('.post-highlighted').forEach(el => {
        el.classList.remove('post-highlighted');
    });
    
    // Buscar y resaltar el post
    const postElement = document.querySelector(`[data-post-id="${postId}"]`) || 
                      document.querySelector(`[data-id="${postId}"]`);
    
    if (postElement) {
        const postContainer = postElement.closest('.thread, .reply, .thread-op, .reply-post');
        if (postContainer) {
            postContainer.classList.add('post-highlighted');
            postContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Remover highlight después de 3 segundos
            setTimeout(() => {
                postContainer.classList.remove('post-highlighted');
            }, 3000);
        }
    }
};

window.showPostPreview = async (event, postId) => {
    // Remover preview anterior
    hidePostPreview();
    
    // Buscar el post en la página actual
    let postElement = document.querySelector(`[data-post-id="${postId}"]`) || 
                     document.querySelector(`[data-id="${postId}"]`);
    
    if (!postElement) {
        // Si no está en la página, intentar buscarlo en Firebase
        try {
            const preview = await fetchPostPreview(postId);
            if (preview) {
                showPreviewTooltip(event, preview);
            }
        } catch (error) {
            console.error('Error al obtener preview:', error);
        }
        return;
    }
    
    // Si el post está en la página actual
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
    
    // Posicionar el tooltip
    const rect = preview.getBoundingClientRect();
    const x = Math.min(event.clientX + 10, window.innerWidth - rect.width - 10);
    const y = Math.max(event.clientY - rect.height - 10, 10);
    
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
}

async function fetchPostPreview(postId) {
    // Esta función será implementada en reply.js para buscar posts en Firebase
    return null;
}

// Función para citar un post
window.quotePost = (postId, threadId = null) => {
    // Verificar si estamos en thread.html o reply.html
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('thread.html')) {
        // Si estamos en thread.html, redirigir a reply.html con la cita
        const urlParams = new URLSearchParams(window.location.search);
        const board = urlParams.get('board');
        const quote = `>>${postId}\n`;
        
        // Codificar la cita para la URL
        const encodedQuote = encodeURIComponent(quote);
        
        // Para threads, el postId es también el threadId (post original)
        const targetThreadId = threadId || postId;
        
        // Redirigir a reply.html con la cita pre-cargada
        window.location.href = `reply.html?board=${board}&thread=${targetThreadId}&quote=${encodedQuote}`;
    } else {
        // Si estamos en reply.html, agregar la cita al campo de comentario
        const commentField = document.getElementById('replyComment') || document.getElementById('postComment');
        if (commentField) {
            const currentText = commentField.value;
            const quote = `>>${postId}\n`;
            
            // Agregar la cita al final del texto actual
            commentField.value = currentText ? currentText + '\n' + quote : quote;
            commentField.focus();
            
            // Mostrar el formulario de respuesta si está oculto
            const replyForm = document.getElementById('replyFormContainer');
            if (replyForm && replyForm.style.display === 'none') {
                replyForm.style.display = 'block';
            }
        }
    }
};