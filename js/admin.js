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
    
    // Remover después de 3 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
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
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    
    // Mostrar información del admin autenticado
    updateAdminInfo(user);
    
    loadStats();
    loadThreads();
}

function updateAdminInfo(user) {
    // Agregar info del admin en el header si existe
    const adminInfo = document.getElementById('adminInfo');
    if (adminInfo) {
        adminInfo.innerHTML = `
            <span>Bienvenido, ${user.email}</span>
        `;
    }
}

function showLoginPanel() {
    document.getElementById('loginPanel').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
}

window.login = async () => {
    const email = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    const loginBtn = document.querySelector('#loginPanel button');
    
    // Validación básica
    if (!email || !password) {
        showAuthNotification('Por favor ingresa email y contraseña', 'error');
        return;
    }

    // Deshabilitar botón durante el login
    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';

    try {
        const result = await firebaseAuth.signIn(email, password);
        
        if (result.success) {
            showAuthNotification(result.message, 'success');
            
            // Limpiar campos
            document.getElementById('adminUser').value = '';
            document.getElementById('adminPass').value = '';
        } else {
            showAuthNotification(result.message, 'error');
        }
    } catch (error) {
        showAuthNotification('Error inesperado al iniciar sesión', 'error');
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

// Función para restablecer contraseña
window.resetPassword = async () => {
    const email = document.getElementById('adminUser').value.trim();
    
    if (!email) {
        showAuthNotification('Por favor ingresa tu email', 'error');
        return;
    }

    try {
        const result = await firebaseAuth.resetPassword(email);
        
        if (result.success) {
            showAuthNotification('Email de restablecimiento enviado. Revisa tu bandeja de entrada.', 'success');
        } else {
            showAuthNotification(result.message, 'error');
        }
    } catch (error) {
        showAuthNotification('Error al enviar email de restablecimiento', 'error');
    }
};

// Función para crear cuenta de administrador (solo para setup inicial)
window.createAdminAccount = async () => {
    const email = prompt('Email del administrador:');
    const password = prompt('Contraseña (mínimo 6 caracteres):');
    
    if (!email || !password) {
        showAuthNotification('Email y contraseña son requeridos', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthNotification('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        const result = await firebaseAuth.createAdminAccount(email, password);
        
        if (result.success) {
            showAuthNotification('Cuenta de administrador creada exitosamente', 'success');
        } else {
            showAuthNotification(result.message, 'error');
        }
    } catch (error) {
        showAuthNotification('Error al crear cuenta de administrador', 'error');
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
    try {
        const threadsQuery = query(collection(db, 'threads'));
        const repliesQuery = query(collection(db, 'replies'));
        const reportsQuery = query(collection(db, 'reports'));
        
        const [threadsSnapshot, repliesSnapshot, reportsSnapshot] = await Promise.all([
            getDocs(threadsQuery),
            getDocs(repliesQuery),
            getDocs(reportsQuery)
        ]);

        document.getElementById('totalThreads').textContent = threadsSnapshot.size;
        document.getElementById('totalReplies').textContent = repliesSnapshot.size;
        document.getElementById('totalReports').textContent = reportsSnapshot.size;

        // Calcular estadísticas de archivos
        let totalFiles = 0;
        let totalFileSize = 0;

        // Contar archivos en threads
        threadsSnapshot.forEach(doc => {
            const thread = doc.data();
            if (thread.imageUrl) {
                totalFiles++;
                if (thread.fileSize) {
                    totalFileSize += thread.fileSize;
                }
            }
        });

        // Contar archivos en replies
        repliesSnapshot.forEach(doc => {
            const reply = doc.data();
            if (reply.imageUrl) {
                totalFiles++;
                if (reply.fileSize) {
                    totalFileSize += reply.fileSize;
                }
            }
        });

        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('totalFileSize').textContent = formatFileSize(totalFileSize);

        // Calcular posts de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let postsToday = 0;

        threadsSnapshot.forEach(doc => {
            const timestamp = doc.data().timestamp?.toDate();
            if (timestamp >= today) postsToday++;
        });

        repliesSnapshot.forEach(doc => {
            const timestamp = doc.data().timestamp?.toDate();
            if (timestamp >= today) postsToday++;
        });

        document.getElementById('totalToday').textContent = postsToday;
    } catch (error) {
        // Error al cargar estadísticas
    }
}



window.loadThreads = async () => {
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

            threadsHTML += `
                <div class="thread-container">
                    <div class="thread-op no-float">
                        ${fileSection}
                        <div class="post-image">
                            ${thread.imageUrl ? `<img src="${thread.imageUrl}" class="thread-image" onclick="openLightbox(this.src)">` : ''}
                        </div>
                        <div class="thread-header">
                            <span class="subject">/${thread.board}/ - ${thread.subject || ''}</span>
                            <span class="name ${nameClass}">${displayName}</span>
                            <span class="date">${timestamp.toLocaleString().replace(',', '')}</span>
                            <span class="id">No.${thread.postId || 'N/A'}</span>
                            <span class="ip" style="color: #666; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="copyIP('${thread.userIP}')" title="Clic para copiar IP al portapapeles">IP: ${thread.userIP || 'No disponible'}</span>
                            [<a href="reply.html?board=${thread.board}&thread=${thread.postId}">Ver publicación</a>]
                            <button class="delete-btn" onclick="deleteThread('${doc.id}')">[Eliminar]</button>
                        </div>
                        <div class="comment">${processText(thread.comment)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = threadsHTML || 'No hay threads';
    } catch (error) {
        container.innerHTML = 'Error: ' + error.message;
    }
};

window.loadReplies = async () => {
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
    if (!confirm('¿Estás seguro de que quieres eliminar este thread?')) return;

    try {
        await deleteDoc(doc(db, 'threads', threadId));
        // También eliminar todas las respuestas asociadas
        const repliesQuery = query(collection(db, 'replies'), where('threadId', '==', threadId));
        const repliesSnapshot = await getDocs(repliesQuery);
        
        const deletePromises = repliesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        loadThreads();
    } catch (error) {
        alert('Error al eliminar el thread: ' + error.message);
    }
};

window.deleteReply = async (replyId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta respuesta?')) return;

    try {
        await deleteDoc(doc(db, 'replies', replyId));
        loadReplies();
    } catch (error) {
        alert('Error al eliminar la respuesta: ' + error.message);
    }
};

window.switchTab = (tabName) => {
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

            // Procesando reporte

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
                // Para threads, usar el postId del thread reportado
                contentUrl = `reply.html?board=${report.board}&thread=${report.postId}`;
            } else {
                // Para respuestas, buscar el threadId correcto
                let actualThreadId = report.threadId;
                let threadPostId;
                
                // Si threadId es undefined, buscar en el mapa de respuestas
                if (!actualThreadId && report.contentId) {
                    actualThreadId = replyThreadMap[report.contentId];
                }
                
                // Si aún no tenemos threadId, verificar si contentId es en realidad un threadId
                if (!actualThreadId && report.contentId) {
                    // Verificar si contentId existe en threadPostIdMap (es decir, si es un thread)
                    threadPostId = threadPostIdMap[report.contentId];
                    if (threadPostId) {
                        actualThreadId = report.contentId;
                    }
                }
                
                // Si no obtuvimos threadPostId arriba, intentar obtenerlo normalmente
                if (!threadPostId && actualThreadId) {
                    threadPostId = threadPostIdMap[actualThreadId];
                }
                
                if (threadPostId) {
                    contentUrl = `reply.html?board=${report.board}&thread=${threadPostId}#${report.postId}`;
                } else {
                    // Fallback: usar el threadId directamente si no se encuentra el postId
                    contentUrl = `reply.html?board=${report.board}&thread=${actualThreadId || 'unknown'}#${report.postId}`;
                }
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
                            <span class="ip" style="color: #666; font-family: monospace; cursor: pointer; text-decoration: underline;" onclick="copyIP('${report.userIP}')" title="Clic para copiar IP del autor">IP: ${report.userIP || 'No disponible'}</span>
                            [<a href="${contentUrl}">Ver contenido</a>]
                            <button class="delete-btn" onclick="dismissReport('${doc.id}')">[Descartar]</button>
                            <button class="delete-btn" onclick="deleteReportedContent('${report.contentId}', '${report.contentType}', '${doc.id}')">[Eliminar Contenido]</button>
                        </div>
                        <div class="comment">
                            <p><strong>Razón del reporte:</strong> ${report.reason}</p>
                            <p><strong>IP del que reporta:</strong> <span style="font-family: monospace; color: #666; cursor: pointer; text-decoration: underline;" onclick="copyIP('${report.reporterIP}')" title="Clic para copiar IP">${report.reporterIP || 'No disponible'}</span></p>
                            <p><strong>Contenido reportado:</strong></p>
                            <div>${processText(report.comment)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = reportsHTML || 'No hay reportes pendientes';
    } catch (error) {
        container.innerHTML = 'Error: ' + error.message;
    }
};

window.dismissReport = async (reportId) => {
    if (!confirm('¿Descartar este reporte?')) return;

    try {
        await deleteDoc(doc(db, 'reports', reportId));
        loadReports();
    } catch (error) {
        alert('Error al descartar el reporte: ' + error.message);
    }
};

window.deleteReportedContent = async (contentId, contentType, reportId) => {
    if (!confirm(`¿Eliminar este ${contentType === 'thread' ? 'thread' : 'respuesta'} reportado?`)) return;

    try {
        if (contentType === 'thread') {
            // Eliminar thread y sus respuestas
            await deleteDoc(doc(db, 'threads', contentId));
            const repliesQuery = query(collection(db, 'replies'), where('threadId', '==', contentId));
            const repliesSnapshot = await getDocs(repliesQuery);
            const deletePromises = repliesSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
        } else {
            // Eliminar respuesta
            await deleteDoc(doc(db, 'replies', contentId));
        }

        // Eliminar el reporte
        await deleteDoc(doc(db, 'reports', reportId));
        
        loadReports();
        alert('Contenido eliminado exitosamente');
    } catch (error) {
        alert('Error al eliminar el contenido: ' + error.message);
    }
};

window.clearAllReports = async () => {
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
            <table style="width: 100%;">
                <tr>
                    <td style="width: 100px; font-weight: bold;">IP:</td>
                    <td><input type="text" id="banIP" placeholder="192.168.1.1" style="width: 100%; padding: 5px; margin-bottom: 5px;"></td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Razón:</td>
                    <td>
                        <select id="banReason" style="width: 100%; padding: 5px; margin-bottom: 5px;">
                            <option value="Spam">Spam</option>
                            <option value="Contenido inapropiado">Contenido inapropiado</option>
                            <option value="Trolling">Trolling</option>
                            <option value="Flood">Flood</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Duración:</td>
                    <td>
                        <select id="banDuration" style="width: 100%; padding: 5px; margin-bottom: 5px;">
                            <option value="3600000">1 hora</option>
                            <option value="86400000">1 día</option>
                            <option value="604800000">1 semana</option>
                            <option value="2592000000">1 mes</option>
                            <option value="0">Permanente</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <td><button onclick="executeBan()" style="padding: 5px 10px; background: #d32f2f; color: white; border: none; cursor: pointer;">Banear IP</button></td>
                </tr>
            </table>
        </div>

        <div class="ban-list">
            <header>
                <h2>IPs Baneadas</h2>
            </header>
            <div>
                <span id="banCount" style="margin-left: 15px; color: #666;">Cargando...</span>
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

// Función para crear cuenta inicial de administrador
window.createInitialAdmin = async () => {
    const email = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    
    if (!email || !password) {
        showAuthNotification('Por favor completa email y contraseña', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAuthNotification('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        showAuthNotification('Creando cuenta de administrador...', 'info');
        
        const result = await firebaseAuth.createAdminAccount(email, password);
        
        if (result.success) {
            showAuthNotification('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.', 'success');
            // Limpiar el campo de contraseña por seguridad
            document.getElementById('adminPass').value = '';
        } else {
            showAuthNotification(result.message, 'error');
        }
    } catch (error) {
        showAuthNotification('Error al crear cuenta: ' + error.message, 'error');
    }
};

// ========== FUNCIONES PARA MANEJO DE NOTICIAS ==========

window.createNews = async function() {
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
                <div class="admin-news-item">
                    <div class="news-item-header">
                        <h4>${item.title}</h4>
                        <span class="news-item-date">${item.date}</span>
                    </div>
                    <div class="news-item-preview">${item.preview}</div>
                    <div class="news-item-actions">
                        <button onclick="editNews('${newsId}')" class="btn-secondary">Editar</button>
                        <button onclick="deleteNews('${newsId}')" class="btn-danger">Eliminar</button>
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
