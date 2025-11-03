// Módulo para manejo de noticias en el frontend
import { db } from './firebase-config.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

export { loadNews, loadUpdates, loadBoardsList };

// Función para cargar noticias desde Firebase
async function loadNews() {
    const newsContainer = document.getElementById('news-container');
    
    try {
        // Obtener las últimas 3 noticias de Firebase
        const q = query(
            collection(db, 'news'), 
            orderBy('createdAt', 'desc'),
            limit(3)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            // Mostrar noticias por defecto si no hay ninguna
            showDefaultNews(newsContainer);
            return;
        }

        let html = `
            <table class="news-table">
                <tbody>
        `;
        
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const newsId = doc.id;
            
            html += `
                <tr>
                    <td>
                        <a href="news.html?id=${newsId}">
                            ${item.title}
                        </a>
                    </td>
                    <td>${item.preview}</td>
                    <td>${formatDate(item.date)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        newsContainer.innerHTML = html;

        
    } catch (error) {
        console.error('Error al cargar noticias:', error);
        showDefaultNews(newsContainer);
    }
}

// Mostrar noticias por defecto
function showDefaultNews(container) {
    container.innerHTML = `
        <table class="news-table">
            <tbody>
                <tr>
                    <td>
                        <a href="news.html?id=news-1">
                            ¡Bienvenidos a FireChan!
                        </a>
                    </td>
                    <td>Estamos emocionados de dar la bienvenida a todos los usuarios a nuestra nueva plataforma de discusión.</td>
                    <td>02/11/2025</td>
                </tr>
            </tbody>
        </table>
    `;
}

// Función para cargar actualizaciones del sitio
async function loadUpdates() {
    const updatesContainer = document.getElementById('updates-container');
    
    try {
        updatesContainer.innerHTML = '<p style="text-align: center; color: #666;">Cargando actualizaciones...</p>';
        
        // Obtener documentos de threads y posts
        const threadsQuery = query(collection(db, 'threads'), limit(5));
        const postsQuery = query(collection(db, 'posts'), limit(5));
        
        const [threadsSnapshot, postsSnapshot] = await Promise.allSettled([
            getDocs(threadsQuery),
            getDocs(postsQuery)
        ]);
        
        // Combinar documentos encontrados
        const allDocs = [];
        if (threadsSnapshot.status === 'fulfilled') {
            allDocs.push(...threadsSnapshot.value.docs);
        }
        if (postsSnapshot.status === 'fulfilled') {
            allDocs.push(...postsSnapshot.value.docs);
        }
        
        if (allDocs.length === 0) {
            updatesContainer.innerHTML = '<p style="text-align: center; color: #666;">No hay actualizaciones recientes</p>';
            return;
        }
        
        // Procesar y ordenar documentos
        const posts = allDocs
            .map(doc => {
                const data = doc.data();
                const activityDate = data.lastReplyAt || data.createdAt || data.timestamp;
                
                return {
                    id: doc.id,
                    board: data.board,
                    title: data.title || data.subject,
                    content: data.content || data.comment,
                    mostRecentActivity: activityDate
                };
            })
            .sort((a, b) => {
                let dateA = a.mostRecentActivity;
                let dateB = b.mostRecentActivity;
                
                if (dateA && typeof dateA.toDate === 'function') {
                    dateA = dateA.toDate();
                }
                if (dateB && typeof dateB.toDate === 'function') {
                    dateB = dateB.toDate();
                }
                
                return new Date(dateB) - new Date(dateA);
            })
            .slice(0, 5);

        // Crear tabla de actualizaciones
        let html = `
            <table class="updates-table">
                <tbody>
        `;
        
        posts.forEach((post) => {
            const displayTitle = post.title || (post.content ? post.content.substring(0, 50) + '...' : 'Sin título');
            
            html += `
                <tr>
                    <td>
                        <span>/${post.board}/</span>
                    </td>
                    <td>${displayTitle}</td>
                    <td>${formatTimeAgo(post.mostRecentActivity)}</td>
                    <td>
                        <a href="reply.html?board=${post.board}&thread=${post.id}">Ver</a>
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        updatesContainer.innerHTML = html;
        
    } catch (error) {
        console.error('Error al cargar actualizaciones:', error);
        updatesContainer.innerHTML = '<p style="text-align: center; color: #666;">Error al cargar actualizaciones</p>';
    }
}

// Función para cargar lista de tablones con estadísticas
async function loadBoardsList() {
    const boardsList = document.getElementById('boards-container');
    
    try {
        boardsList.innerHTML = '<p style="text-align: center; color: #666;">Cargando tablones...</p>';
        
        // Definir tablones con sus metadatos
        const boardsConfig = [
            {
                id: 'a',
                title: 'Anime y Manga',
                description: 'Anime, manga y cultura japonesa'
            },
            {
                id: 'b',
                title: 'Aleatorio',
                description: 'Conversaciones aleatorias y contenido variado'
            },
            {
                id: 'g',
                title: 'Tecnología',
                description: 'Discusiones sobre tecnología, programación y gadgets'
            },
            {
                id: 'v',
                title: 'Videojuegos',
                description: 'Todo sobre videojuegos y gaming'
            },
            {
                id: 'pol',
                title: 'Política',
                description: 'Política y actualidad'
            },
            {
                id: 'x',
                title: 'Paranormal',
                description: 'Temas paranormales y misterios'
            },
            {
                id: 'me',
                title: 'Meta',
                description: 'Discusiones sobre el sitio y sugerencias'
            }
        ];
        
        // Obtener todos los posts de Firebase
        const threadsQuery = query(collection(db, 'threads'));
        const postsQuery = query(collection(db, 'posts'));
        
        const [threadsSnapshot, postsSnapshot] = await Promise.allSettled([
            getDocs(threadsQuery),
            getDocs(postsQuery)
        ]);
        
        // Combinar todos los documentos
        const allDocs = [];
        if (threadsSnapshot.status === 'fulfilled') {
            allDocs.push(...threadsSnapshot.value.docs);
        }
        if (postsSnapshot.status === 'fulfilled') {
            allDocs.push(...postsSnapshot.value.docs);
        }
        
        // Calcular estadísticas por tablón
        const boardStats = {};
        
        // Inicializar contadores
        boardsConfig.forEach(board => {
            boardStats[board.id] = {
                ...board,
                posts: 0,
                images: 0
            };
        });
        
        // Contar posts e imágenes por tablón
        allDocs.forEach(doc => {
            const data = doc.data();
            const boardId = data.board;
            
            if (boardStats[boardId]) {
                boardStats[boardId].posts++;
                
                // Contar si tiene imagen (cualquier campo relacionado con imagen)
                if (data.imageUrl || data.fileName || data.imageHeight || data.imageWidth) {
                    boardStats[boardId].images++;
                }
            }
        });
        
        // Crear tabla
        let html = `
            <table class="boards-table">
                <thead>
                    <tr>
                        <th>Tablón</th>
                        <th>Descripción</th>
                        <th>Posts</th>
                        <th>Imágenes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        boardsConfig.forEach(board => {
            const stats = boardStats[board.id];
            html += `
                <tr>
                    <td>
                        <a href="thread.html?board=${board.id}">
                            <span>/${board.id}/ - </span>
                            <span>${board.title}</span>
                        </a>
                    </td>
                    <td>${board.description}</td>
                    <td>${stats.posts}</td>
                    <td>${stats.images}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        boardsList.innerHTML = html;
        
    } catch (error) {
        console.error('Error al cargar tablones:', error);
        boardsList.innerHTML = '<p style="text-align: center; color: #666;">Error al cargar tablones</p>';
    }
}

// Función auxiliar para formatear fechas cortas
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        month: '2-digit', 
        day: '2-digit',
        year: 'numeric'
    };
    return date.toLocaleDateString('es-ES', options);
}

// Función auxiliar para formatear tiempo relativo ("hace X minutos")
function formatTimeAgo(timestamp) {
    let date;
    
    // Manejar diferentes tipos de timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
        // Firebase Timestamp
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