import { db } from './firebase-config.js';
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Función para generar o recuperar ID único del usuario
function getUserUniqueId() {
    let userId = localStorage.getItem('userUniqueId');
    if (!userId) {
        // Generar ID único basado en timestamp y random
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('userUniqueId', userId);
        localStorage.setItem('userFirstVisit', new Date().toISOString());
    }
    
    // Actualizar última visita
    localStorage.setItem('userLastVisit', new Date().toISOString());
    return userId;
}

// Función para obtener estadísticas completas del imageboard
export async function getImageboardStats() {
    try {
        const stats = {
            totalThreads: 0,
            totalReplies: 0,
            uniqueUsers: 0,
            totalFileSize: 0,
            totalFiles: 0,
            boardStats: {}
        };

        // Obtener todos los threads
        console.log('Obteniendo estadísticas de threads...');
        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        stats.totalThreads = threadsSnapshot.size;
        
        let threadsFileSize = 0;
        let threadsFileCount = 0;
        const userIds = new Set();

        threadsSnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Contar archivos y tamaño de threads
            if (data.imageUrl && data.fileSize) {
                threadsFileSize += data.fileSize;
                threadsFileCount++;
            }
            
            // Agregar userId si existe
            if (data.userId) {
                userIds.add(data.userId);
            }
            
            // Estadísticas por board
            const board = data.board || 'unknown';
            if (!stats.boardStats[board]) {
                stats.boardStats[board] = {
                    threads: 0,
                    replies: 0,
                    files: 0,
                    fileSize: 0
                };
            }
            stats.boardStats[board].threads++;
            if (data.imageUrl && data.fileSize) {
                stats.boardStats[board].files++;
                stats.boardStats[board].fileSize += data.fileSize;
            }
        });

        // Obtener todas las respuestas
        console.log('Obteniendo estadísticas de respuestas...');
        const repliesSnapshot = await getDocs(collection(db, 'replies'));
        stats.totalReplies = repliesSnapshot.size;
        
        let repliesFileSize = 0;
        let repliesFileCount = 0;

        repliesSnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Contar archivos y tamaño de respuestas
            if (data.imageUrl && data.fileSize) {
                repliesFileSize += data.fileSize;
                repliesFileCount++;
            }
            
            // Agregar userId si existe
            if (data.userId) {
                userIds.add(data.userId);
            }
            
            // Estadísticas por board (basado en threadId o board del reply)
            const board = data.board || 'unknown';
            if (!stats.boardStats[board]) {
                stats.boardStats[board] = {
                    threads: 0,
                    replies: 0,
                    files: 0,
                    fileSize: 0
                };
            }
            stats.boardStats[board].replies++;
            if (data.imageUrl && data.fileSize) {
                stats.boardStats[board].files++;
                stats.boardStats[board].fileSize += data.fileSize;
            }
        });

        // Calcular totales
        stats.totalFileSize = threadsFileSize + repliesFileSize;
        stats.totalFiles = threadsFileCount + repliesFileCount;
        stats.uniqueUsers = userIds.size;

        // Agregar usuario actual si no está en la base de datos
        const currentUserId = getUserUniqueId();
        if (!userIds.has(currentUserId)) {
            stats.uniqueUsers++;
        }

        console.log('Estadísticas obtenidas:', stats);
        return stats;

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        return {
            totalThreads: 0,
            totalReplies: 0,
            uniqueUsers: 1, // Al menos el usuario actual
            totalFileSize: 0,
            totalFiles: 0,
            boardStats: {}
        };
    }
}

// Función para mostrar las estadísticas en el DOM
export async function displayStats() {
    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    // Mostrar indicador de carga
    statsContainer.innerHTML = `
        <div class="stats-loading">
            <div class="loading-spinner"></div>
            <span>Cargando estadísticas...</span>
        </div>
    `;

    try {
        const stats = await getImageboardStats();
        
        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalThreads.toLocaleString()}</div>
                    <div class="stat-label">Hilos Totales</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalReplies.toLocaleString()}</div>
                    <div class="stat-label">Respuestas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.uniqueUsers.toLocaleString()}</div>
                    <div class="stat-label">Usuarios Únicos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${formatFileSize(stats.totalFileSize)}</div>
                    <div class="stat-label">Archivos Subidos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalFiles.toLocaleString()}</div>
                    <div class="stat-label">Total de Archivos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${(stats.totalThreads + stats.totalReplies).toLocaleString()}</div>
                    <div class="stat-label">Posts Totales</div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error al mostrar estadísticas:', error);
        statsContainer.innerHTML = `
            <div class="stats-error">
                <span>Error al cargar estadísticas</span>
                <button onclick="displayStats()" class="retry-btn">Reintentar</button>
            </div>
        `;
    }
}

// Función para obtener estadísticas rápidas (solo conteos básicos)
export async function getQuickStats() {
    try {
        const [threadsSnapshot, repliesSnapshot] = await Promise.all([
            getDocs(collection(db, 'threads')),
            getDocs(collection(db, 'replies'))
        ]);

        return {
            totalPosts: threadsSnapshot.size + repliesSnapshot.size,
            totalThreads: threadsSnapshot.size,
            totalReplies: repliesSnapshot.size
        };
    } catch (error) {
        console.error('Error al obtener estadísticas rápidas:', error);
        return {
            totalPosts: 0,
            totalThreads: 0,
            totalReplies: 0
        };
    }
}

// Inicializar ID único del usuario al cargar el script
getUserUniqueId();