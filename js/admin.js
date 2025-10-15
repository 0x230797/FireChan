import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { adminConfig } from './config.js';
import { processText } from './text-processor.js';

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
});

function checkAuthState() {
    const isAuthenticated = localStorage.getItem('adminAuthenticated') === 'true';
    
    if (isAuthenticated) {
        showAdminPanel();
    } else {
        showLoginPanel();
    }
}

function showAdminPanel() {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    loadStats();
    loadThreads();
}

function showLoginPanel() {
    document.getElementById('loginPanel').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
}

window.login = () => {
    const email = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;

    // Validar credenciales localmente
    if (email === adminConfig.email && password === adminConfig.password) {
        // Simular autenticación exitosa
        localStorage.setItem('adminAuthenticated', 'true');
        showAdminPanel();
        
        // Limpiar campos
        document.getElementById('adminUser').value = '';
        document.getElementById('adminPass').value = '';
    }
};

window.handleEnterKey = (event) => {
    if (event.key === 'Enter') {
        login();
    }
};

window.logout = () => {
    localStorage.removeItem('adminAuthenticated');
    showLoginPanel();
};

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
        console.error('Error al cargar estadísticas:', error);
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

            threadsHTML += `
                <div class="admin-item">
                    <div class="admin-item-header">
                        <span>/${thread.board}/ - ${thread.subject || 'Sin título'} - No.${thread.postId || 'N/A'}</span>
                        <button onclick="deleteThread('${doc.id}')">Eliminar</button>
                    </div>
                    <div class="admin-item-content">
                        <p><strong>${thread.name || 'Anónimo'}</strong> - ${timestamp.toLocaleString()}</p>
                        <div>${processText(thread.comment)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = threadsHTML || 'No hay threads';
    } catch (error) {
        console.error('Error detallado:', error);
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
        
        querySnapshot.forEach((doc) => {
            const reply = doc.data();
            const timestamp = reply.timestamp ? 
                (reply.timestamp.toDate ? reply.timestamp.toDate() : new Date(reply.timestamp)) 
                : new Date();

            repliesHTML += `
                <div class="admin-item">
                    <div class="admin-item-header">
                        <span>Respuesta - No.${reply.postId || 'N/A'}</span>
                        <button onclick="deleteReply('${doc.id}')">Eliminar</button>
                    </div>
                    <div class="admin-item-content">
                        <p><strong>${reply.name || 'Anónimo'}</strong> - ${timestamp.toLocaleString()}</p>
                        <div>${processText(reply.comment)}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = repliesHTML || 'No hay respuestas';
    } catch (error) {
        console.error('Error detallado:', error);
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
    if (tabName === 'threads') {
        loadThreads();
    } else if (tabName === 'replies') {
        loadReplies();
    } else if (tabName === 'reports') {
        loadReports();
    }
};

window.loadReports = async () => {
    const container = document.getElementById('reportsContainer');
    container.innerHTML = 'Cargando reportes...';

    try {
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        let reportsHTML = '';
        
        querySnapshot.forEach((doc) => {
            const report = doc.data();
            const timestamp = report.timestamp ? 
                (report.timestamp.toDate ? report.timestamp.toDate() : new Date(report.timestamp)) 
                : new Date();

            reportsHTML += `
                <div class="admin-item report-item">
                    <div class="admin-item-header">
                        <span>Reporte - ${report.contentType === 'thread' ? 'Thread' : 'Respuesta'} No.${report.postId || 'N/A'}</span>
                        <div>
                            <button onclick="dismissReport('${doc.id}')">Descartar</button>
                            <button onclick="deleteReportedContent('${report.contentId}', '${report.contentType}', '${doc.id}')">Eliminar Contenido</button>
                        </div>
                    </div>
                    <div class="admin-item-content">
                        <p><strong>Razón:</strong> ${report.reason}</p>
                        <p><strong>Reportado el:</strong> ${timestamp.toLocaleString()}</p>
                        <p><strong>Tablón:</strong> /${report.board}/</p>
                        <div class="reported-content">
                            <p><strong>Contenido reportado:</strong></p>
                            <div><em>${report.name || 'Anónimo'}</em>: ${processText(report.comment)}</div>
                            ${report.imageUrl ? `<p><a href="${report.imageUrl}" target="_blank">Ver imagen</a></p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = reportsHTML || 'No hay reportes pendientes';
    } catch (error) {
        console.error('Error detallado:', error);
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
