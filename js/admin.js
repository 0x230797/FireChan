import { db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    deleteDoc, 
    doc, 
    addDoc, 
    updateDoc, 
    getDoc,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { processText } from './text-processor.js';
import { formatFileSize } from './utils.js';
import { firebaseAuth } from './firebase-auth.js';
import { deleteImageFromServer } from './upload-system.js';

// Función simple de notificación para evitar errores
function showSimpleNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Crear notificación simple
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
        color: white;
        border-radius: 5px;
        z-index: 9999;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Función auxiliar para formatear tiempo relativo
function formatTimeAgo(timestamp) {
    let date;
    
    if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else {
        return 'hace un momento';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'hace un momento';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `hace ${minutes} min`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        return `hace ${days} día${days > 1 ? 's' : ''}`;
    } else {
        return date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    startSecurityMonitor();
});

function initializeAuth() {
    // Configurar listener para cambios de autenticación
    firebaseAuth.onAuthStateChange((user, isAdmin) => {
        if (user && isAdmin) {
            showAdminPanel(user);
        } else {
            showLoginPanel();
        }
    });
    
    // Verificar estado actual
    const { user, isAdmin } = firebaseAuth.getCurrentUser();
    if (user && isAdmin) {
        showAdminPanel(user);
    } else {
        showLoginPanel();
    }
}

function showAdminPanel(user) {
    const loginPanel = document.getElementById('loginPanel');
    const adminContent = document.getElementById('adminContent');
    
    loginPanel.style.display = 'none';
    adminContent.style.display = 'block';
    adminContent.setAttribute('data-authenticated', 'true');
    
    loadStats();
    loadThreads();
}

function showLoginPanel() {
    const loginPanel = document.getElementById('loginPanel');
    const adminContent = document.getElementById('adminContent');
    
    loginPanel.style.display = 'block';
    adminContent.style.display = 'none';
    adminContent.removeAttribute('data-authenticated');
}

// ========== FUNCIÓN DE SEGURIDAD CRÍTICA ==========
// Verificar autenticación antes de CUALQUIER acción administrativa
function checkAdminAuth() {
    const { user, isAdmin } = firebaseAuth.getCurrentUser();
    
    if (!user || !isAdmin) {
        alert('⛔ Acceso denegado. Debes iniciar sesión como administrador.');
        showLoginPanel();
        return false;
    }
    
    return true;
}

// Monitor de seguridad - Verifica periódicamente la autenticación
function startSecurityMonitor() {
    // Verificar cada 5 segundos si el panel admin está visible sin autenticación
    setInterval(() => {
        const adminContent = document.getElementById('adminContent');
        const loginPanel = document.getElementById('loginPanel');
        const { user, isAdmin } = firebaseAuth.getCurrentUser();
        
        // Si el panel admin está visible pero no hay autenticación válida
        if (adminContent && adminContent.style.display !== 'none' && (!user || !isAdmin)) {
            console.warn('🚨 Intento de acceso no autorizado detectado');
            showLoginPanel();
            alert('⛔ Sesión expirada o acceso no autorizado. Por favor inicia sesión.');
        }
        
        // Si el login panel está oculto pero no hay autenticación
        if (loginPanel && loginPanel.style.display === 'none' && (!user || !isAdmin)) {
            showLoginPanel();
        }
    }, 5000); // Cada 5 segundos
    
    // También verificar en cada interacción del usuario
    document.addEventListener('click', (e) => {
        const { user, isAdmin } = firebaseAuth.getCurrentUser();
        const adminContent = document.getElementById('adminContent');
        
        // Si hacen clic en cualquier parte del panel admin sin estar autenticados
        if (adminContent && adminContent.contains(e.target) && (!user || !isAdmin)) {
            e.preventDefault();
            e.stopPropagation();
            showLoginPanel();
            alert('⛔ Debes iniciar sesión como administrador.');
        }
    }, true); // useCapture = true para interceptar antes
}

window.login = async () => {
    const email = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    const loginBtn = document.querySelector('#loginPanel button');
    
    // Validación básica
    if (!email || !password) {
        showSimpleNotification('Por favor ingresa email y contraseña', 'error');
        return;
    }

    // Deshabilitar botón durante el login
    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';

    try {
        const result = await firebaseAuth.signIn(email, password);
        
        if (result.success) {
            showSimpleNotification(result.message, 'success');
            
            // Limpiar campos
            document.getElementById('adminUser').value = '';
            document.getElementById('adminPass').value = '';
        } else {
            showSimpleNotification(result.message, 'error');
        }
    } catch (error) {
        showSimpleNotification('Error inesperado al iniciar sesión', 'error');
    } finally {
        // Re-habilitar botón
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sesión';
    }
};

window.handleEnterKey = (event) => {
    if (event.key === 'Enter') {
        login();
    }
};

window.logout = async () => {
    try {
        const result = await firebaseAuth.signOut();
        
        if (result.success) {
            showAuthNotification(result.message, 'success');
        }
        
        // Resetear formularios de nombres en otras páginas si existen
        resetNameFields();
    } catch (error) {
        showAuthNotification('Error al cerrar sesión', 'error');
    }
};

// Función para resetear campos de nombre cuando se cierra sesión
function resetNameFields() {
    // Intentar resetear el campo de thread.html si existe
    const threadNameField = document.getElementById('postName');
    if (threadNameField) {
        threadNameField.value = '';
        threadNameField.placeholder = 'Anónimo';
        threadNameField.disabled = false;
        threadNameField.classList.remove('admin-field');
    }
    
    // Intentar resetear el campo de reply.html si existe
    const replyNameField = document.getElementById('replyName');
    if (replyNameField) {
        replyNameField.value = '';
        replyNameField.placeholder = 'Anónimo';
        replyNameField.disabled = false;
        replyNameField.classList.remove('admin-field');
    }
}

async function loadStats() {
    if (!checkAdminAuth()) {
        return;
    }
    
    try {
        const threadsQuery = query(collection(db, 'threads'));
        const repliesQuery = query(collection(db, 'replies'));
        const reportsQuery = query(collection(db, 'reports'));
        const bansQuery = query(collection(db, 'bans'));
        
        const [threadsSnapshot, repliesSnapshot, reportsSnapshot, bansSnapshot] = await Promise.all([
            getDocs(threadsQuery),
            getDocs(repliesQuery),
            getDocs(reportsQuery),
            getDocs(bansQuery)
        ]);

        // Obtener fechas de referencia
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Variables para cálculos
        let totalFiles = 0;
        let totalFileSize = 0;
        let postsToday = 0;
        let postsThisWeek = 0;
        let postsThisMonth = 0;
        let uniqueUsers = new Set();
        let boardStats = {};
        let deletedPosts = 0;
        let lastActivity = null;
        let oldestPost = null;

        // Procesar threads
        threadsSnapshot.forEach(doc => {
            const thread = doc.data();
            const timestamp = thread.timestamp?.toDate() || thread.createdAt?.toDate();
            
            if (timestamp) {
                if (timestamp >= today) postsToday++;
                if (timestamp >= thisWeekStart) postsThisWeek++;
                if (timestamp >= thisMonthStart) postsThisMonth++;
                
                if (!lastActivity || timestamp > lastActivity) {
                    lastActivity = timestamp;
                }
                if (!oldestPost || timestamp < oldestPost) {
                    oldestPost = timestamp;
                }
            }

            // Contar archivos
            if (thread.imageUrl || thread.fileName) {
                totalFiles++;
                if (thread.fileSize) {
                    totalFileSize += thread.fileSize;
                }
            }

            // Estadísticas por tablón
            const board = thread.board || 'unknown';
            if (!boardStats[board]) {
                boardStats[board] = { posts: 0, threads: 0 };
            }
            boardStats[board].threads++;
            boardStats[board].posts++;

            // Usuarios únicos
            if (thread.userHash) {
                uniqueUsers.add(thread.userHash);
            }

            // Posts eliminados
            if (thread.deleted) {
                deletedPosts++;
            }
        });

        // Procesar respuestas
        repliesSnapshot.forEach(doc => {
            const reply = doc.data();
            const timestamp = reply.timestamp?.toDate() || reply.createdAt?.toDate();
            
            if (timestamp) {
                if (timestamp >= today) postsToday++;
                if (timestamp >= thisWeekStart) postsThisWeek++;
                if (timestamp >= thisMonthStart) postsThisMonth++;
                
                if (!lastActivity || timestamp > lastActivity) {
                    lastActivity = timestamp;
                }
            }

            // Contar archivos
            if (reply.imageUrl || reply.fileName) {
                totalFiles++;
                if (reply.fileSize) {
                    totalFileSize += reply.fileSize;
                }
            }

            // Estadísticas por tablón
            const board = reply.board || 'unknown';
            if (!boardStats[board]) {
                boardStats[board] = { posts: 0, threads: 0 };
            }
            boardStats[board].posts++;

            // Usuarios únicos
            if (reply.userHash) {
                uniqueUsers.add(reply.userHash);
            }

            // Posts eliminados
            if (reply.deleted) {
                deletedPosts++;
            }
        });

        // Calcular estadísticas derivadas
        const totalPosts = threadsSnapshot.size + repliesSnapshot.size;
        const totalActiveReports = Array.from(reportsSnapshot.docs).filter(doc => !doc.data().resolved).length;
        const totalActiveBans = Array.from(bansSnapshot.docs).filter(doc => {
            const expiresAt = doc.data().expiresAt?.toDate();
            return !expiresAt || expiresAt > now;
        }).length;

        // Tablón más activo
        let mostActiveBoard = '-';
        let maxPosts = 0;
        Object.entries(boardStats).forEach(([board, stats]) => {
            if (stats.posts > maxPosts) {
                maxPosts = stats.posts;
                mostActiveBoard = `/${board}/`;
            }
        });

        // Promedio de posts por día
        const daysSinceStart = oldestPost ? Math.max(1, Math.ceil((now - oldestPost) / (1000 * 60 * 60 * 24))) : 1;
        const avgPostsPerDay = Math.round(totalPosts / daysSinceStart * 10) / 10;

        // Tasa de reportes
        const reportRate = totalPosts > 0 ? Math.round((reportsSnapshot.size / totalPosts) * 100 * 10) / 10 : 0;

        // Promedio de tamaño de archivo
        const avgFileSize = totalFiles > 0 ? Math.round(totalFileSize / totalFiles) : 0;

        // Tiempo activo (días desde el primer post)
        const uptimeDays = oldestPost ? Math.ceil((now - oldestPost) / (1000 * 60 * 60 * 24)) : 0;

        // Actualizar elementos HTML
        document.getElementById('totalThreads').textContent = threadsSnapshot.size;
        document.getElementById('totalReplies').textContent = repliesSnapshot.size;
        document.getElementById('totalPosts').textContent = totalPosts;
        document.getElementById('totalUsers').textContent = uniqueUsers.size;

        document.getElementById('postsToday').textContent = postsToday;
        document.getElementById('postsThisWeek').textContent = postsThisWeek;
        document.getElementById('postsThisMonth').textContent = postsThisMonth;
        document.getElementById('avgPostsPerDay').textContent = avgPostsPerDay;

        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('totalFileSize').textContent = formatFileSize(totalFileSize);
        document.getElementById('avgFileSize').textContent = formatFileSize(avgFileSize);

        document.getElementById('totalReports').textContent = totalActiveReports;
        document.getElementById('totalBans').textContent = totalActiveBans;
        document.getElementById('deletedPosts').textContent = deletedPosts;
        document.getElementById('reportRate').textContent = reportRate + '%';

        document.getElementById('mostActiveBoard').textContent = mostActiveBoard;

        document.getElementById('dbSize').textContent = formatFileSize(totalFileSize + (totalPosts * 1024)); // Estimado
        document.getElementById('lastActivity').textContent = lastActivity ? formatTimeAgo(lastActivity) : '-';
        document.getElementById('uptime').textContent = uptimeDays + ' días';

    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        showSimpleNotification('Error al cargar estadísticas', 'error');
    }
}

window.loadThreads = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    const container = document.getElementById('threadsContainer');
    const board = document.getElementById('boardFilter').value;
    
    try {
        const q = board === 'all' 
            ? query(collection(db, 'threads'), orderBy('timestamp', 'desc'))
            : query(collection(db, 'threads'), where('board', '==', board), orderBy('timestamp', 'desc'));
        
        const querySnapshot = await getDocs(q);
        let threadsHTML = '';
        
        querySnapshot.forEach((doc) => {
            const thread = doc.data();
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

            // Badges para pin y block
            const pinBadge = thread.isPinned ? '<img class="badge badge-pin" src="src/imgs/sticky.png" alt="Pinned" title="Thread fijado">' : '';
            const blockBadge = thread.isBlocked ? '<img class="badge badge-block" src="src/imgs/lock.png" alt="Blocked" title="Thread bloqueado">' : '';
            
            threadsHTML += `
                <div class="thread-container">
                    <div class="thread-op">
                        ${fileSection}
                        <div class="post-image">
                            ${thread.imageUrl ? `<img src="${thread.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                        </div>
                        <div class="thread-header">
                            <span class="subject">/${thread.board}/ - ${thread.subject || ''}</span>
                            ${pinBadge}
                            ${blockBadge}
                            <span class="name ${nameClass}">${displayName}</span>
                            <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                            <span class="id">No.${thread.postId || 'N/A'}</span>
                            <span class="ip" style="color: #666; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="copyIP('${thread.userIP}')" title="Clic para copiar IP al portapapeles">IP: ${thread.userIP || 'No disponible'}</span>
                            [<a href="reply.html?board=${thread.board}&thread=${thread.postId}">Ver publicación</a>]
                            <button class="delete-btn" onclick="deleteThread('${doc.id}')">[Eliminar]</button>
                            <button class="pin-btn" onclick="togglePinThread('${doc.id}', ${thread.isPinned || false})">[${thread.isPinned ? 'Unpin' : 'Pin'}]</button>
                            <button class="block-btn" onclick="toggleBlockThread('${doc.id}', ${thread.isBlocked || false})">[${thread.isBlocked ? 'Unblock' : 'Block'}]</button>
                        </div>
                        <div class="comment">${processText(thread.comment)}</div>
                    </div>
                </div>
                <div class="clear"></div>
            `;
        });
        
        container.innerHTML = threadsHTML || 'No hay threads';
    } catch (error) {
        container.innerHTML = 'Error: ' + error.message;
    }
};

window.loadReplies = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    const container = document.getElementById('repliesContainer');
    container.innerHTML = 'Cargando respuestas...';

    try {
        const q = query(collection(db, 'replies'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        let repliesHTML = '';
        
        // Obtener información de todos los threads para mapear threadId -> board y threadId -> postId
        const threadsQuery = query(collection(db, 'threads'));
        const threadsSnapshot = await getDocs(threadsQuery);
        const threadBoardMap = {};
        const threadPostIdMap = {};
        
        threadsSnapshot.forEach((doc) => {
            const threadData = doc.data();
            threadBoardMap[doc.id] = threadData.board;
            threadPostIdMap[doc.id] = threadData.postId;
        });
        
        querySnapshot.forEach((doc) => {
            const reply = doc.data();
            const timestamp = reply.timestamp ? 
                (reply.timestamp.toDate ? reply.timestamp.toDate() : new Date(reply.timestamp)) 
                : new Date();

            // Obtener el board y postId del thread padre
            const replyBoard = threadBoardMap[reply.threadId] || 'unknown';
            const threadPostId = threadPostIdMap[reply.threadId] || reply.threadId;

            // Verificar si es post de admin para aplicar estilo especial
            const nameClass = reply.isAdmin ? 'admin-name' : '';
            const displayName = reply.name || 'Anónimo';

            // Crear sección de archivo si hay imagen
            const replyFileSection = reply.imageUrl ? `
                <div class="post-header-file">
                    <b>Archivo:</b>
                    <a href="${reply.imageUrl}" target="_blank" title="${reply.fileName || 'imagen.jpg'}">${reply.fileName || 'imagen.jpg'}</a>
                    ${reply.fileSize ? `(${formatFileSize(reply.fileSize)}${reply.imageWidth && reply.imageHeight ? `, ${reply.imageWidth}x${reply.imageHeight}` : ''})` : ''}
                </div>
            ` : '';

            repliesHTML += `
                <div class="reply-post">
                    ${replyFileSection}
                        <div class="post-image">
                            ${reply.imageUrl ? `<img src="${reply.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                        </div>
                        <div class="reply-header">
                            <span class="subject">/${replyBoard}/</span>
                            <span class="name ${nameClass}">${displayName}</span>
                            <span class="date">${timestamp.toLocaleString()}</span>
                            <span class="id">No.${reply.postId || 'N/A'}</span>
                            <span class="ip" style="color: #666; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="copyIP('${reply.userIP}')" title="Clic para copiar IP al portapapeles">IP: ${reply.userIP || 'No disponible'}</span>
                            [<a href="reply.html?board=${replyBoard}&thread=${threadPostId}#${reply.postId}">Ver respuesta</a>]
                            <button class="delete-btn" onclick="deleteReply('${doc.id}')">[Eliminar]</button>
                        </div>
                    <div class="comment">${processText(reply.comment)}</div>
                </div>
            `;
        });
        
        container.innerHTML = repliesHTML || 'No hay respuestas';
    } catch (error) {
        container.innerHTML = 'Error: ' + error.message;
    }
};

window.deleteThread = async (threadId) => {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar este thread?')) return;

    try {
        // Obtener datos del thread antes de eliminar
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        const threadData = threadDoc.data();
        
        // Eliminar imagen del thread si existe
        if (threadData && threadData.imageUrl) {
            await deleteImageFromServer(threadData.imageUrl);
        }
        
        // Obtener y eliminar todas las respuestas asociadas
        const repliesQuery = query(collection(db, 'replies'), where('threadId', '==', threadId));
        const repliesSnapshot = await getDocs(repliesQuery);
        
        // Eliminar imágenes de las respuestas
        const deletePromises = repliesSnapshot.docs.map(async (replyDoc) => {
            const replyData = replyDoc.data();
            if (replyData.imageUrl) {
                await deleteImageFromServer(replyData.imageUrl);
            }
            return deleteDoc(replyDoc.ref);
        });
        
        await Promise.all(deletePromises);
        
        // Eliminar el thread
        await deleteDoc(doc(db, 'threads', threadId));

        showSimpleNotification('Thread y todas sus imágenes eliminadas', 'success');
        loadThreads();
    } catch (error) {
        alert('Error al eliminar el thread: ' + error.message);
    }
};

window.deleteReply = async (replyId) => {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar esta respuesta?')) return;

    try {
        // Obtener datos de la respuesta antes de eliminar
        const replyDoc = await getDoc(doc(db, 'replies', replyId));
        const replyData = replyDoc.data();
        
        // Eliminar imagen si existe
        if (replyData && replyData.imageUrl) {
            await deleteImageFromServer(replyData.imageUrl);
        }
        
        // Eliminar la respuesta
        await deleteDoc(doc(db, 'replies', replyId));
        
        showSimpleNotification('Respuesta e imagen eliminadas', 'success');
        loadReplies();
    } catch (error) {
        alert('Error al eliminar la respuesta: ' + error.message);
    }
};

// Función para fijar/desfijar threads
window.togglePinThread = async (threadId, currentPinStatus) => {
    if (!checkAdminAuth()) {
        return;
    }

    try {
        const threadRef = doc(db, 'threads', threadId);
        await updateDoc(threadRef, {
            isPinned: !currentPinStatus
        });
        
        showSimpleNotification(
            currentPinStatus ? 'Thread desfijado exitosamente' : 'Thread fijado exitosamente',
            'success'
        );
        
        loadThreads();
    } catch (error) {
        showSimpleNotification('Error al cambiar estado de pin: ' + error.message, 'error');
    }
};

// Función para bloquear/desbloquear threads
window.toggleBlockThread = async (threadId, currentBlockStatus) => {
    if (!checkAdminAuth()) {
        return;
    }

    try {
        const threadRef = doc(db, 'threads', threadId);
        await updateDoc(threadRef, {
            isBlocked: !currentBlockStatus
        });
        
        showSimpleNotification(
            currentBlockStatus ? 'Thread desbloqueado exitosamente' : 'Thread bloqueado exitosamente',
            'success'
        );
        
        loadThreads();
    } catch (error) {
        showSimpleNotification('Error al cambiar estado de bloqueo: ' + error.message, 'error');
    }
};

window.switchTab = (tabName) => {
    if (!checkAdminAuth()) {
        return;
    }
    
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remover clase active de todos los tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar la pestaña seleccionada
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Activar el tab correspondiente
    event.target.classList.add('active');
    
    // Cargar contenido según la pestaña
    if (tabName === 'statistics') {
        loadStats();
    } else if (tabName === 'news') {
        loadNewsList();
    } else if (tabName === 'threads') {
        loadThreads();
    } else if (tabName === 'replies') {
        loadReplies();
    } else if (tabName === 'reports') {
        loadReports();
    } else if (tabName === 'bans') {
        loadBanList();
    }
};

window.loadReports = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    const container = document.getElementById('reportsContainer');
    container.innerHTML = 'Cargando reportes...';

    try {
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        let reportsHTML = '';
        
        // Obtener información de todos los threads para mapear threadId -> postId
        const threadsQuery = query(collection(db, 'threads'));
        const threadsSnapshot = await getDocs(threadsQuery);
        const threadPostIdMap = {};
        
        threadsSnapshot.forEach((doc) => {
            const threadData = doc.data();
            threadPostIdMap[doc.id] = threadData.postId;
        });

        // Obtener información de todas las respuestas para mapear replyId -> threadId
        const repliesQuery = query(collection(db, 'replies'));
        const repliesSnapshot = await getDocs(repliesQuery);
        const replyThreadMap = {};
        
        repliesSnapshot.forEach((doc) => {
            const replyData = doc.data();
            replyThreadMap[doc.id] = replyData.threadId;
        });
        
        querySnapshot.forEach((doc) => {
            const report = doc.data();
            const timestamp = report.timestamp ? 
                (report.timestamp.toDate ? report.timestamp.toDate() : new Date(report.timestamp)) 
                : new Date();

            // Debug: Log para verificar datos del reporte
            console.log('Procesando reporte:', {
                contentId: report.contentId,
                contentType: report.contentType,
                postId: report.postId,
                board: report.board,
                threadId: report.threadId,
                threadPostIdMapped: threadPostIdMap[report.contentId],
                replyThreadMapped: replyThreadMap[report.contentId]
            });

            // Crear sección de archivo si hay imagen
            const reportFileSection = report.imageUrl ? `
                <div class="post-header-file">
                    <b>Archivo:</b>
                    <a href="${report.imageUrl}" target="_blank" title="${report.fileName || 'imagen.jpg'}">${report.fileName || 'imagen.jpg'}</a>
                    ${report.fileSize ? `(${formatFileSize(report.fileSize)}${report.imageWidth && report.imageHeight ? `, ${report.imageWidth}x${report.imageHeight}` : ''})` : ''}
                </div>
            ` : '';

            // Construir URL correcta según el tipo de contenido
            let contentUrl;
            if (report.contentType === 'thread') {
                // Para threads reportados:
                // 1. Intentar obtener postId del mapa usando contentId (Firebase doc ID)
                // 2. Si no existe, usar directamente el postId del reporte
                const threadPostId = threadPostIdMap[report.contentId] || report.postId;
                contentUrl = `reply.html?board=${report.board}&thread=${threadPostId}`;
            } else {
                // Para respuestas reportadas:
                let actualThreadId = report.threadId;
                
                // Si no hay threadId en el reporte, buscar en el mapa de respuestas
                if (!actualThreadId && report.contentId) {
                    actualThreadId = replyThreadMap[report.contentId];
                }
                
                // Obtener el postId del thread padre
                let threadPostId = actualThreadId ? threadPostIdMap[actualThreadId] : null;
                
                // Si no encontramos threadPostId, usar el postId del reporte como fallback
                // (asumiendo que puede ser el postId del thread padre)
                if (!threadPostId) {
                    threadPostId = report.postId;
                }
                
                contentUrl = `reply.html?board=${report.board}&thread=${threadPostId}#${report.postId}`;
            }

            reportsHTML += `
                <div class="report-container">
                    <div class="report-post">
                        ${reportFileSection}
                        <div class="post-image">
                            ${report.imageUrl ? `<img src="${report.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                        </div>
                        <div class="report-header">
                            <span class="subject">/${report.board}/ - Reporte ${report.contentType === 'thread' ? 'Publicación' : 'Respuesta'}</span>
                            <span class="name">${report.name || 'Anónimo'}</span>
                            <span class="date">${timestamp.toLocaleString()}</span>
                            <span class="id">No.${report.postId || 'N/A'}</span>
                            <span class="ip" style="color: #d32f2f; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="copyIP('${report.userIP}')" title="Clic para copiar IP del AUTOR">IP Autor: ${report.userIP || 'No disponible'}</span>
                            [<a href="${contentUrl}" target="_blank">Ver contenido</a>]
                            <button class="delete-btn" onclick="dismissReport('${doc.id}')">[Descartar]</button>
                            <button class="delete-btn" onclick="deleteReportedContent('${report.contentId}', '${report.contentType}', '${doc.id}')">[Eliminar Contenido]</button>
                        </div>
                        <div class="comment">
                            <p><strong>Razón del reporte:</strong> ${report.reason}</p>
                            <p><strong>IP del que reporta:</strong> <span style="font-family: monospace; color: #4a90e2; cursor: pointer; text-decoration: underline;" onclick="copyIP('${report.reporterIP}')" title="Clic para copiar IP del reportero">${report.reporterIP || 'No disponible'}</span></p>
                            <p><strong>Contenido reportado:</strong></p>
                            <div>${processText(report.comment)}</div>
                        </div>
                    </div>
                </div>
                <div class="clear"></div>
            `;
        });
        
        container.innerHTML = reportsHTML || 'No hay reportes pendientes';
    } catch (error) {
        container.innerHTML = 'Error: ' + error.message;
    }
};

window.dismissReport = async (reportId) => {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!confirm('¿Descartar este reporte?')) return;

    try {
        await deleteDoc(doc(db, 'reports', reportId));
        loadReports();
    } catch (error) {
        alert('Error al descartar el reporte: ' + error.message);
    }
};

window.deleteReportedContent = async (contentId, contentType, reportId) => {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!contentId) {
        alert('Error: ID de contenido no disponible');
        return;
    }
    
    if (!confirm(`¿Eliminar este ${contentType === 'thread' ? 'thread' : 'respuesta'} reportado?`)) return;

    try {
        console.log('Eliminando contenido:', { contentId, contentType, reportId });
        
        if (contentType === 'thread') {
            // Verificar que el thread existe antes de eliminar
            const threadDoc = await getDoc(doc(db, 'threads', contentId));
            if (!threadDoc.exists()) {
                alert('Error: El thread no existe o ya fue eliminado');
                // Eliminar solo el reporte
                await deleteDoc(doc(db, 'reports', reportId));
                loadReports();
                return;
            }
            
            const threadData = threadDoc.data();
            
            // Eliminar imagen del thread si existe
            if (threadData.imageUrl) {
                await deleteImageFromServer(threadData.imageUrl);
            }
            
            // Obtener y eliminar todas las respuestas del thread
            const repliesQuery = query(collection(db, 'replies'), where('threadId', '==', contentId));
            const repliesSnapshot = await getDocs(repliesQuery);
            
            // Eliminar imágenes de las respuestas
            const deletePromises = repliesSnapshot.docs.map(async (replyDoc) => {
                const replyData = replyDoc.data();
                if (replyData.imageUrl) {
                    await deleteImageFromServer(replyData.imageUrl);
                }
                return deleteDoc(replyDoc.ref);
            });
            await Promise.all(deletePromises);
            
            // Eliminar el thread
            await deleteDoc(doc(db, 'threads', contentId));
            
            console.log(`Thread eliminado junto con ${repliesSnapshot.size} respuestas`);
        } else {
            // Verificar que la respuesta existe antes de eliminar
            const replyDoc = await getDoc(doc(db, 'replies', contentId));
            if (!replyDoc.exists()) {
                alert('Error: La respuesta no existe o ya fue eliminada');
                // Eliminar solo el reporte
                await deleteDoc(doc(db, 'reports', reportId));
                loadReports();
                return;
            }
            
            const replyData = replyDoc.data();
            
            // Eliminar imagen si existe
            if (replyData.imageUrl) {
                await deleteImageFromServer(replyData.imageUrl);
            }
            
            // Eliminar respuesta
            await deleteDoc(doc(db, 'replies', contentId));
            console.log('Respuesta eliminada');
        }

        // Eliminar el reporte
        await deleteDoc(doc(db, 'reports', reportId));
        
        loadReports();
        alert('Contenido e imágenes eliminadas exitosamente');
    } catch (error) {
        console.error('Error al eliminar contenido:', error);
        alert('Error al eliminar el contenido: ' + error.message);
    }
};

window.clearAllReports = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!confirm('¿Eliminar TODOS los reportes? Esta acción no se puede deshacer.')) return;

    try {
        const q = query(collection(db, 'reports'));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        loadReports();
        alert('Todos los reportes han sido eliminados');
    } catch (error) {
        alert('Error al eliminar reportes: ' + error.message);
    }
};

// Función para cargar la lista de bans
window.loadBanList = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    const container = document.getElementById('banManagement');
    if (!container) {
        return;
    }
    
    // Mostrar estado de carga
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Cargando sistema de baneos...</div>';
    
    try {
        // Importar el sistema de baneos directamente
        const { ipBanSystem } = await import('./ip-ban-system.js');
        
        // Crear interfaz directamente aquí
        await createBanInterface(container, ipBanSystem);
        
    } catch (error) {
        container.innerHTML = `
            <div style="color: red; padding: 20px; text-align: center;">
                <h3>Error al cargar sistema de baneos</h3>
                <p><strong>Detalles:</strong> ${error.message}</p>
                <button onclick="loadBanList()" style="padding: 8px 16px; margin-top: 10px;">Reintentar</button>
            </div>
        `;
    }
};

// Función para crear la interfaz de baneos directamente
async function createBanInterface(container, ipBanSystem) {
    // HTML de la interfaz
    container.innerHTML = `
    <div class="ban-panel">
        <header>
            <h2>Banear Nueva IP</h2>
        </header>
            <table>
                <tr>
                    <td>IP:</td>
                    <td><input type="text" id="banIP" placeholder="192.168.1.1"></td>
                </tr>
                <tr>
                    <td>Razón:</td>
                    <td>
                        <select id="banReason">
                            <option value="Spam">Spam</option>
                            <option value="Contenido inapropiado">Contenido inapropiado</option>
                            <option value="Trolling">Trolling</option>
                            <option value="Flood">Flood</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <td>Duración:</td>
                    <td>
                        <select id="banDuration">
                            <option value="3600000">1 hora</option>
                            <option value="86400000">1 día</option>
                            <option value="604800000">1 semana</option>
                            <option value="2592000000">1 mes</option>
                            <option value="0">Permanente</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <td>
                        <button onclick="executeBan()" style="padding: 5px 10px; background: #d32f2f; color: white; border: none; cursor: pointer;">Banear IP</button>
                    </td>
                </tr>
            </table>
        </div>

        <div class="ban-list">
            <header>
                <h2>IPs Baneadas</h2>
            </header>
            <div style="padding: 10px 0 0 10px; color: #666;">
                <span id="banCount">Cargando...</span>
            </div>
            <div id="bansList" style="border: 1px solid #ddd; border-radius: 5px; padding: 10px; min-height: 100px;">
                Cargando lista de baneos...
            </div>
        </div>
    `;
    
    // Cargar lista inicial
    await refreshBanList();
}

// Función para actualizar la lista de baneos
window.refreshBanList = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    const bansList = document.getElementById('bansList');
    const banCount = document.getElementById('banCount');
    
    if (!bansList || !banCount) {
        return;
    }
    
    try {
        // Importar el sistema de baneos
        const { ipBanSystem } = await import('./ip-ban-system.js');
        
        bansList.innerHTML = 'Cargando...';
        banCount.textContent = 'Cargando...';
        
        // Obtener lista de baneos activos
        const activeBans = await ipBanSystem.getActiveBans();
        
        banCount.textContent = activeBans.length + ' bans activos';
        
        if (activeBans.length === 0) {
            bansList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No hay IPs baneadas</div>';
            return;
        }
        
        // Generar HTML para cada ban
        let bansHTML = '';
        activeBans.forEach((ban, index) => {
            
            const expiry = ban.expiresAt ? 
                'Expira: ' + new Date(ban.expiresAt).toLocaleString() : 
                'Permanente';
                
            const bannedDate = ban.bannedAt ? 
                new Date(ban.bannedAt).toLocaleDateString() : 
                'Fecha desconocida';
            
            const bgColor = index % 2 === 0 ? 'background: #e6e7ef;' : '';
            const adminInfo = ban.adminName ? ' | Por: ' + ban.adminName : '';
            
            bansHTML += '<div style="border: 1px solid var(--border); padding: 10px; ' + bgColor + '">' +
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<div>' +
                '<strong style="font-family: monospace; color: #d32f2f;">' + ban.ip + '</strong>' +
                '<span style="background: #ffbfbf; padding: 2px 6px; font-size: 12px; margin-left: 10px;">' + ban.reason + '</span>' +
                '</div>' +
                '<button onclick="removeBan(\'' + ban.id + '\')" style="padding: 5px 10px; background: #d32f2f; color: white; border: none; cursor: pointer;">Eliminar</button>' +
                '</div>' +
                '<div style="font-size: 12px; color: #666;">' +
                'Baneado: ' + bannedDate + ' | ' + expiry + adminInfo +
                '</div>' +
                '</div>';
        });
        
        bansList.innerHTML = bansHTML;
        
    } catch (error) {
        bansList.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">' +
            '<strong>Error:</strong> ' + error.message + '<br>' +
            '<small>Revisa la consola para más detalles</small>' +
            '</div>';
        banCount.textContent = 'Error';
    }
};

// Función para ejecutar un baneo
window.executeBan = async () => {
    if (!checkAdminAuth()) {
        return;
    }
    
    const ip = document.getElementById('banIP').value.trim();
    const reason = document.getElementById('banReason').value;
    const duration = parseInt(document.getElementById('banDuration').value);
    
    if (!ip) {
        alert('Por favor ingresa una IP válida');
        return;
    }
    
    if (!reason) {
        alert('Por favor selecciona una razón');
        return;
    }
    
    if (!confirm('¿Banear la IP ' + ip + '?')) {
        return;
    }
    
    try {
        const { ipBanSystem } = await import('./ip-ban-system.js');
        
        // Obtener el nombre del admin actual
        const { user } = firebaseAuth.getCurrentUser();
        const adminName = user ? user.email : 'Admin';
        
        // El tercer parámetro debe ser duration en milisegundos (null para permanente)
        const banDuration = duration > 0 ? duration : null;
        
        // EJECUTAR EL BANEO
        const result = await ipBanSystem.banIP(ip, reason, banDuration, adminName);
        
        if (!result.success) {
            alert('Error al banear IP: ' + result.message);
            return;
        }
        
        // Limpiar formulario
        document.getElementById('banIP').value = '';
        
        // Actualizar lista
        await refreshBanList();
        
        alert('IP ' + ip + ' baneada exitosamente');
        
    } catch (error) {
        alert('Error al banear IP: ' + error.message);
    }
};

// Función para remover un ban
window.removeBan = async (banId) => {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!confirm('¿Eliminar este ban?')) {
        return;
    }
    
    try {
        const { ipBanSystem } = await import('./ip-ban-system.js');
        
        await ipBanSystem.removeBan(banId);
        
        // Actualizar lista
        await refreshBanList();
        
        alert('Ban eliminado exitosamente');
        
    } catch (error) {
        alert('Error al eliminar ban: ' + error.message);
    }
};

// Función para copiar IP al portapapeles
window.copyIP = async (ip) => {
    if (!ip || ip === 'No disponible') {
        alert('IP no disponible para copiar');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(ip);
        
        // Mostrar notificación temporal
        showCopyNotification(ip);
    } catch (error) {
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = ip;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showCopyNotification(ip);
    }
};

// Función para mostrar notificación de copia
function showCopyNotification(ip) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.innerHTML = `IP ${ip} copiada al portapapeles`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: rgb(76, 175, 80);
        color: white;
        padding: 5px 10px;
        z-index: 9999;
    `;
    
    document.body.appendChild(notification);
    
    // Remover después de 2 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

// Funciones para el lightbox de imágenes
window.openLightbox = (src) => {
    document.getElementById('lightbox').style.display = 'flex';
    document.getElementById('lightboxImg').src = src;
};

window.closeLightbox = () => {
    document.getElementById('lightbox').style.display = 'none';
};

// ========== FUNCIONES PARA MANEJO DE NOTICIAS ==========

window.createNews = async function() {
    if (!checkAdminAuth()) {
        return;
    }
    
    const title = document.getElementById('newsTitle').value.trim();
    const preview = document.getElementById('newsPreview').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    const date = document.getElementById('newsDate').value;

    if (!title || !preview || !content || !date) {
        showSimpleNotification('Por favor, completa todos los campos', 'error');
        return;
    }

    try {
        const titleElement = document.getElementById('newsTitle');
        const editingId = titleElement.getAttribute('data-editing');

        const newsData = {
            title: title,
            preview: preview,
            content: content,
            date: date,
            updatedAt: Timestamp.now(),
            updatedBy: firebaseAuth.getCurrentUser().user?.email || 'admin'
        };

        if (editingId) {
            // Actualizar noticia existente
            const docRef = doc(db, 'news', editingId);
            await updateDoc(docRef, newsData);
            
            showSimpleNotification('¡Noticia actualizada exitosamente!', 'success');
            
            // Limpiar indicador de edición
            titleElement.removeAttribute('data-editing');
        } else {
            // Crear nueva noticia
            newsData.createdAt = Timestamp.now();
            newsData.createdBy = firebaseAuth.getCurrentUser().user?.email || 'admin';
            
            const docRef = await addDoc(collection(db, 'news'), newsData);
            console.log('Noticia creada con ID: ', docRef.id);

            showSimpleNotification('¡Noticia creada exitosamente!', 'success');
        }

        clearNewsForm();
        loadNewsList();
        
    } catch (error) {
        console.error('Error al procesar noticia:', error);
        showSimpleNotification('Error al procesar la noticia: ' + error.message, 'error');
    }
};

window.clearNewsForm = function() {
    const titleElement = document.getElementById('newsTitle');
    
    titleElement.value = '';
    document.getElementById('newsPreview').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsDate').value = '';
    
    // Limpiar indicador de edición
    titleElement.removeAttribute('data-editing');
    
    // Restaurar fecha actual
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('newsDate').value = today;
};

window.loadNewsList = async function() {
    if (!checkAdminAuth()) {
        return;
    }
    
    const container = document.getElementById('newsListContainer');
    
    try {
        // Mostrar loading
        container.innerHTML = '<p style="text-align: center; color: #666;">Cargando noticias...</p>';
        
        // Obtener noticias de Firebase ordenadas por fecha de creación
        const q = query(
            collection(db, 'news'), 
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay noticias creadas</p>';
            return;
        }

        let html = '<div class="admin-news-list">';
        
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const newsId = doc.id;
            
            html += `
                <div>
                    <header>
                        <h4>${item.title}</h4>
                        <span>${item.date}</span>
                    </header>
                    <div>${item.preview}</div>
                    <div>
                        <button onclick="editNews('${newsId}')">Editar</button>
                        <button onclick="deleteNews('${newsId}')">Eliminar</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error al cargar noticias:', error);
        container.innerHTML = '<p style="color: red;">Error al cargar las noticias: ' + error.message + '</p>';
    }
};

window.editNews = async function(newsId) {
    if (!checkAdminAuth()) {
        return;
    }
    
    try {
        // Obtener documento específico de Firebase
        const docRef = doc(db, 'news', newsId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const newsItem = docSnap.data();
            
            document.getElementById('newsTitle').value = newsItem.title;
            document.getElementById('newsPreview').value = newsItem.preview;
            document.getElementById('newsContent').value = newsItem.content;
            document.getElementById('newsDate').value = newsItem.date;
            
            // Agregar indicador de edición
            document.getElementById('newsTitle').setAttribute('data-editing', newsId);
            
            showSimpleNotification('Noticia cargada para edición', 'info');
        } else {
            showSimpleNotification('La noticia no existe', 'error');
        }
    } catch (error) {
        console.error('Error al cargar noticia:', error);
        showSimpleNotification('Error al cargar la noticia: ' + error.message, 'error');
    }
};

window.deleteNews = async function(newsId) {
    if (!checkAdminAuth()) {
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar esta noticia?')) {
        return;
    }

    try {
        // Eliminar documento de Firebase
        await deleteDoc(doc(db, 'news', newsId));
        
        showSimpleNotification('Noticia eliminada exitosamente', 'success');
        loadNewsList();
        
    } catch (error) {
        console.error('Error al eliminar noticia:', error);
        showSimpleNotification('Error al eliminar la noticia: ' + error.message, 'error');
    }
};

// Inicializar la fecha actual en el formulario
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('newsDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
});
