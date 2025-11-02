// Integración automática del sistema de baneo por IP en FireChan
import { ipBanSystem } from './ip-ban-system.js';
import { firebaseAuth } from './firebase-auth.js';

// Middleware para interceptar formularios y verificar bans
class FireChanBanIntegration {
    constructor() {
        this.init();
    }

    init() {
        // Auto-verificar al cargar cualquier página
        document.addEventListener('DOMContentLoaded', () => {
            this.checkInitialBan();
            this.interceptForms();
            this.interceptNavigationActions();
        });
    }

    // Verificar ban al cargar la página
    async checkInitialBan() {
        const isBanned = await ipBanSystem.isIPBanned();
        if (isBanned) {
            const banInfo = await ipBanSystem.getBanInfo();
            this.showBanOverlay(banInfo);
        }
    }

    // Interceptar todos los formularios para verificar bans
    interceptForms() {
        // Interceptar formulario de nuevo thread
        const threadForm = document.querySelector('form[action*="thread"], #threadForm, .thread-form');
        if (threadForm) {
            threadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const canSubmit = await ipBanSystem.checkBanBeforeAction('crear un thread');
                if (canSubmit) {
                    // Continuar con la lógica original
                    if (window.submitThread) {
                        window.submitThread();
                    }
                }
            });
        }

        // Interceptar formulario de respuesta
        const replyForm = document.querySelector('form[action*="reply"], #replyForm, .reply-form');
        if (replyForm) {
            replyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const canSubmit = await ipBanSystem.checkBanBeforeAction('enviar una respuesta');
                if (canSubmit) {
                    // Continuar con la lógica original
                    if (window.submitReply) {
                        window.submitReply();
                    }
                }
            });
        }
    }

    // Interceptar acciones de navegación si es necesario
    interceptNavigationActions() {
        // Interceptar clicks en botones de navegación sensibles
        document.addEventListener('click', async (e) => {
            const target = e.target;
            
            // Verificar si es un botón de reporte
            if (target.matches('.report-btn, [onclick*="report"]')) {
                e.preventDefault();
                const canReport = await ipBanSystem.checkBanBeforeAction('reportar contenido');
                if (canReport && target.onclick) {
                    target.onclick();
                }
            }
        });
    }

    // Limpiar overlays duplicados
    cleanupExistingOverlays() {
        const existingOverlays = document.querySelectorAll('#fullBanOverlay');
        existingOverlays.forEach(overlay => {
            overlay.remove();
        });
    }

    // Mostrar overlay de ban que cubre toda la pantalla
    showBanOverlay(banInfo) {
        // Limpiar cualquier overlay existente primero
        this.cleanupExistingOverlays();

        const overlay = document.createElement('div');
        overlay.id = 'fullBanOverlay';
        overlay.innerHTML = `
            <div class="full-ban-overlay">
                <div class="ban-overlay-content">
                    <h1>Acceso Denegado</h1>
                    <div class="ban-info-box">
                        <h3>Tu IP ha sido baneada</h3>
                        <div class="ban-details-grid">
                            <div class="ban-detail">
                                <strong>Razón:</strong>
                                <span>${banInfo.reason || 'No especificada'}</span>
                            </div>
                            <div class="ban-detail">
                                <strong>Fecha del ban:</strong>
                                <span>${banInfo.bannedAt ? banInfo.bannedAt.toLocaleString() : 'No disponible'}</span>
                            </div>
                            <div class="ban-detail">
                                <strong>Duración:</strong>
                                <span>${banInfo.expiresAt ? 'Expira: ' + banInfo.expiresAt.toLocaleString() : 'Permanente'}</span>
                            </div>
                            <div class="ban-detail">
                                <strong>Moderador:</strong>
                                <span>${banInfo.adminName || 'Administrador'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Aplicar estilos
        const style = document.createElement('style');
        style.textContent = `
            .full-ban-overlay {
                background-color: #ebebeb;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 999999;
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
            }

            .ban-overlay-content {
                background: var(--bg);
                border: 1px solid var(--border);
                padding: 40px;
                max-width: 600px;
                width: 90%;
                text-align: center;
            }

            @keyframes banSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .ban-overlay-content h1 {
                color: #dc3545;
            }

            .ban-info-box {
                background: #e6e7ef;
                border: 1px solid var(--border);
                padding: 25px;
                margin: 25px 0;
            }

            .ban-info-box h3 {
                color: #dc3545;
                margin-bottom: 20px;
                font-size: 20px;
            }

            .ban-details-grid {
                display: grid;
                gap: 5px;
                text-align: left;
            }

            .ban-detail {
                display: grid;
                grid-template-columns: 150px 1fr;
                gap: 0px;
                padding: 5px 0;
            }

            .ban-detail:last-child {
                border-bottom: none;
            }

            .ban-detail strong {
                color: #34345c;
                font-weight: bold;
            }

            .ban-detail span {
                color: #666;
            }

            @media (max-width: 768px) {
                .ban-overlay-content {
                    padding: 20px;
                    margin: 20px;
                }

                .ban-overlay-content h1 {
                    font-size: 24px;
                }

                .ban-detail {
                    grid-template-columns: 1fr;
                    gap: 5px;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // Bloquear toda interacción con la página
        document.body.style.overflow = 'hidden';
        
        // Funciones globales para los botones
        window.checkBanStatus = async () => {
            const isBanned = await ipBanSystem.isIPBanned();
            if (!isBanned) {
                alert('¡Tu ban ha expirado! La página se recargará automáticamente.');
                window.location.reload();
            } else {
                alert('Tu ban sigue activo. Inténtalo más tarde.');
            }
        };

        window.goToRules = () => {
            window.location.href = 'rules.html';
        };
    }

    // Función para verificar periódicamente el estado del ban
    startBanStatusChecker() {
        setInterval(async () => {
            const isBanned = await ipBanSystem.isIPBanned();
            if (!isBanned) {
                const overlay = document.getElementById('fullBanOverlay');
                if (overlay) {
                    overlay.remove();
                    document.body.style.overflow = '';
                    alert('Tu ban ha expirado automáticamente. ¡Bienvenido de vuelta a FireChan!');
                }
            }
        }, 60000); // Verificar cada minuto
    }
}

// Funciones de utilidad para moderadores
export const BanUtils = {
    // Banear rápidamente desde cualquier página (solo para admins)
    async quickBan(ip, reason = 'Violación de reglas', duration = null) {
        if (!firebaseAuth.requireAdminAuth()) {
            return false;
        }
        
        const result = await ipBanSystem.banIP(ip, reason, duration, 'Admin');
        return result;
    },

    // Obtener IP del usuario actual
    async getCurrentUserIP() {
        return await ipBanSystem.getUserIP();
    },

    // Verificar si IP específica está baneada
    async checkIP(ip) {
        return await ipBanSystem.isIPBanned(ip);
    },

    // Reportar IP sospechosa (para futura implementación)
    async reportSuspiciousIP(ip, reason) {
        // Aquí se podría implementar un sistema de reportes automáticos
    }
};

// Inicializar integración automáticamente
const banIntegration = new FireChanBanIntegration();

// Iniciar verificador de estado si hay un ban activo
document.addEventListener('DOMContentLoaded', async () => {
    const isBanned = await ipBanSystem.isIPBanned();
    if (isBanned) {
        banIntegration.startBanStatusChecker();
    }
});

export { FireChanBanIntegration, banIntegration };