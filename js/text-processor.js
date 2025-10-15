// Función para procesar greentext y pinktext
export function processText(text) {
    if (!text) return '';
    
    // Escapar HTML para prevenir XSS
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    
    // Dividir el texto en líneas
    const lines = text.split('\n');
    
    // Procesar cada línea
    const processedLines = lines.map(line => {
        const trimmedLine = line.trim();
        
        // Greentext: líneas que empiezan con >
        if (trimmedLine.startsWith('>') && trimmedLine.length > 1) {
            return `<span class="greentext">${escapeHtml(line)}</span>`;
        }
        
        // Pinktext: líneas que empiezan con <
        if (trimmedLine.startsWith('<') && trimmedLine.length > 1) {
            return `<span class="pinktext">${escapeHtml(line)}</span>`;
        }
        
        // Línea normal
        return escapeHtml(line);
    });
    
    // Unir las líneas con <br>
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