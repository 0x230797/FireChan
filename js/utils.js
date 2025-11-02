// Utilidades compartidas para FireChan
import { db } from './firebase-config.js';
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

/**
 * Formatear el tamaño de archivo en bytes a formato legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado (ej: "1.5 MB")
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generar un ID único de usuario persistente
 * @returns {string} ID único del usuario
 */
export function getUserUniqueId() {
    let userId = localStorage.getItem('userUniqueId');
    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('userUniqueId', userId);
        localStorage.setItem('userFirstVisit', new Date().toISOString());
    }
    
    // Actualizar última visita
    localStorage.setItem('userLastVisit', new Date().toISOString());
    return userId;
}

/**
 * Generar el siguiente ID de post usando transacciones de Firebase
 * @returns {Promise<number>} El siguiente ID de post disponible
 */
export async function getNextPostId() {
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
        // Fallback: usar timestamp
        return Date.now();
    }
}

/**
 * Obtener dimensiones de una imagen
 * @param {File} file - Archivo de imagen
 * @returns {Promise<{width: number, height: number}>} Dimensiones de la imagen
 */
export function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.onerror = () => {
            resolve({ width: 0, height: 0 });
        };
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Validar formato de archivo de imagen
 * @param {File} file - Archivo a validar
 * @returns {boolean} true si es un formato válido
 */
export function isValidImageFormat(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
}

/**
 * Validar tamaño máximo de archivo
 * @param {File} file - Archivo a validar
 * @param {number} maxSizeInMB - Tamaño máximo en MB (por defecto 5MB)
 * @returns {boolean} true si el tamaño es válido
 */
export function isValidFileSize(file, maxSizeInMB = 5) {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
}

/**
 * Escapar HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto con HTML escapado
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncar texto a una longitud específica
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
export function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Validar formato de IP
 * @param {string} ip - IP a validar
 * @returns {boolean} true si es una IP válida
 */
export function isValidIP(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;
    
    return ip.split('.').every(octet => {
        const num = parseInt(octet);
        return num >= 0 && num <= 255;
    });
}

/**
 * Debounce function para limitar la frecuencia de ejecución
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce aplicado
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}