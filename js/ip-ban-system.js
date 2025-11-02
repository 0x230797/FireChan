import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    addDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    where, 
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

// Clase principal para el sistema de baneo por IP
export class IPBanSystem {
    constructor() {
        this.bannedIPs = new Set();
        this.initializeBanSystem();
    }

    // Inicializar el sistema cargando IPs baneadas
    async initializeBanSystem() {
        try {
            await this.loadBannedIPs();
        } catch (error) {
            // Error inicializando sistema de baneo
        }
    }

    // Obtener la IP del usuario (simulada para propósitos de desarrollo)
    async getUserIP() {
        try {
            // En producción, esto debería obtenerse del servidor
            // Por ahora usamos una simulación o API externa
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.warn('No se pudo obtener IP real, usando IP simulada');
            // Generar una IP simulada para desarrollo
            return this.generateSimulatedIP();
        }
    }

    // Generar IP simulada para desarrollo
    generateSimulatedIP() {
        const stored = localStorage.getItem('simulatedIP');
        if (stored) {
            return stored;
        }
        
        const ip = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        localStorage.setItem('simulatedIP', ip);
        return ip;
    }

    // Cargar todas las IPs baneadas desde Firebase
    async loadBannedIPs() {
        try {
            const bansQuery = query(
                collection(db, 'ip_bans'),
                where('active', '==', true)
            );
            
            const querySnapshot = await getDocs(bansQuery);
            this.bannedIPs.clear();
            
            querySnapshot.forEach((doc) => {
                const banData = doc.data();
                
                // Verificar si el ban ha expirado
                if (banData.expiresAt && banData.expiresAt.toDate() < new Date()) {
                    this.removeBan(doc.id);
                } else {
                    this.bannedIPs.add(banData.ip);
                }
            });
        } catch (error) {
            // Error cargando IPs baneadas
        }
    }

    // Verificar si una IP está baneada
    async isIPBanned(ip = null) {
        if (!ip) {
            ip = await this.getUserIP();
        }
        
        // Verificar en caché local primero
        if (this.bannedIPs.has(ip)) {
            return true;
        }
        
        // Verificar en base de datos por si acaso
        try {
            const bansQuery = query(
                collection(db, 'ip_bans'),
                where('ip', '==', ip),
                where('active', '==', true)
            );
            
            const querySnapshot = await getDocs(bansQuery);
            
            if (!querySnapshot.empty) {
                const banDoc = querySnapshot.docs[0];
                const banData = banDoc.data();
                
                // Verificar si el ban ha expirado
                if (banData.expiresAt && banData.expiresAt.toDate() < new Date()) {
                    await this.removeBan(banDoc.id);
                    return false;
                }
                
                this.bannedIPs.add(ip);
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    // Banear una IP
    async banIP(ip, reason, duration = null, adminName = 'Sistema') {
        try {
            // Calcular fecha de expiración si se especifica duración
            let expiresAt = null;
            if (duration) {
                expiresAt = new Date();
                expiresAt.setMilliseconds(expiresAt.getMilliseconds() + duration);
            }

            const banData = {
                ip: ip,
                reason: reason,
                bannedAt: serverTimestamp(),
                expiresAt: expiresAt,
                adminName: adminName,
                active: true
            };

            // Guardar en Firebase
            const docRef = await addDoc(collection(db, 'ip_bans'), banData);
            
            // Actualizar caché local
            this.bannedIPs.add(ip);
            
            return {
                success: true,
                banId: docRef.id,
                message: `IP ${ip} baneada exitosamente`
            };
        } catch (error) {
            return {
                success: false,
                message: 'Error al banear la IP'
            };
        }
    }

    // Remover ban de una IP
    async removeBan(banId) {
        try {
            // Obtener datos del ban antes de eliminarlo
            const banDoc = await getDoc(doc(db, 'ip_bans', banId));
            
            if (banDoc.exists()) {
                const banData = banDoc.data();
                
                // Marcar como inactivo en lugar de eliminar (para historial)
                await deleteDoc(doc(db, 'ip_bans', banId));
                
                // Remover de caché local
                this.bannedIPs.delete(banData.ip);
                
                return {
                    success: true,
                    message: `Ban removido para IP: ${banData.ip}`
                };
            } else {
                return {
                    success: false,
                    message: 'Ban no encontrado'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: 'Error al remover el ban'
            };
        }
    }

    // Obtener todos los bans activos
    async getActiveBans() {
        try {
            // Usar solo where sin orderBy para evitar problemas de índice
            const bansQuery = query(
                collection(db, 'ip_bans'),
                where('active', '==', true)
            );
            
            const querySnapshot = await getDocs(bansQuery);
            const bans = [];
            
            querySnapshot.forEach((doc) => {
                const banData = doc.data();
                
                // Verificar si el ban ha expirado
                let expired = false;
                if (banData.expiresAt) {
                    const expireDate = banData.expiresAt.toDate ? banData.expiresAt.toDate() : banData.expiresAt;
                    if (expireDate < new Date()) {
                        expired = true;
                    }
                }
                
                if (!expired) {
                    bans.push({
                        id: doc.id,
                        ip: banData.ip,
                        reason: banData.reason,
                        bannedAt: banData.bannedAt?.toDate ? banData.bannedAt.toDate() : banData.bannedAt,
                        expiresAt: banData.expiresAt?.toDate ? banData.expiresAt.toDate() : banData.expiresAt,
                        adminName: banData.adminName,
                        active: banData.active
                    });
                }
            });
            
            // Ordenar por fecha manualmente
            bans.sort((a, b) => {
                if (!a.bannedAt || !b.bannedAt) return 0;
                return new Date(b.bannedAt) - new Date(a.bannedAt);
            });
            
            return bans;
        } catch (error) {
            return [];
        }
    }

    // Obtener información de un ban específico
    async getBanInfo(ip = null) {
        if (!ip) {
            ip = await this.getUserIP();
        }

        try {
            const bansQuery = query(
                collection(db, 'ip_bans'),
                where('ip', '==', ip),
                where('active', '==', true)
            );
            
            const querySnapshot = await getDocs(bansQuery);
            
            if (!querySnapshot.empty) {
                const banData = querySnapshot.docs[0].data();
                return {
                    banned: true,
                    reason: banData.reason,
                    bannedAt: banData.bannedAt?.toDate(),
                    expiresAt: banData.expiresAt?.toDate(),
                    adminName: banData.adminName
                };
            }
            
            return { banned: false };
        } catch (error) {
            return { banned: false };
        }
    }

    // Middleware para verificar bans antes de cualquier acción
    async checkBanBeforeAction(action = 'realizar esta acción') {
        const userIP = await this.getUserIP();
        const isBanned = await this.isIPBanned(userIP);
        
        if (isBanned) {
            const banInfo = await this.getBanInfo(userIP);
            // Usar el sistema de ban-integration.js
            try {
                const { banIntegration } = await import('./ban-integration.js');
                banIntegration.showBanOverlay(banInfo);
            } catch (error) {
                // Fallback: mostrar alerta simple si ban-integration no está disponible
                alert(`Acceso denegado - Tu IP ha sido baneada. Razón: ${banInfo.reason || 'No especificada'}`);
            }
            return false;
        }
        
        return true;
    }
}

// Durations helper - duraciones predefinidas en millisegundos
export const BanDurations = {
    HOUR_1: 60 * 60 * 1000,
    HOURS_6: 6 * 60 * 60 * 1000,
    HOURS_12: 12 * 60 * 60 * 1000,
    DAY_1: 24 * 60 * 60 * 1000,
    DAYS_3: 3 * 24 * 60 * 60 * 1000,
    WEEK_1: 7 * 24 * 60 * 60 * 1000,
    WEEKS_2: 14 * 24 * 60 * 60 * 1000,
    MONTH_1: 30 * 24 * 60 * 60 * 1000,
    PERMANENT: null
};

// Exportar instancia singleton
export const ipBanSystem = new IPBanSystem();

// Auto-verificación al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    const canProceed = await ipBanSystem.checkBanBeforeAction('acceder a FireChan');
    if (!canProceed) {
        // Bloquear toda la funcionalidad de la página
        document.body.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';
    }
});