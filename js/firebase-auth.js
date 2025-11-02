// Sistema de autenticación Firebase para administradores
import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";

// Lista de emails autorizados como administradores
const AUTHORIZED_ADMINS = [
    'admin@firechan.org',  // Sincronizado con config.js
    // Agregar más emails de administradores aquí
];

export class FirebaseAuth {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.authStateChangeCallbacks = [];
        
        // Escuchar cambios en el estado de autenticación
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            this.isAdmin = user ? this.checkIfAdmin(user.email) : false;
            
            // Notificar a todos los callbacks registrados
            this.authStateChangeCallbacks.forEach(callback => {
                callback(user, this.isAdmin);
            });
        });
    }

    // Verificar si un email está autorizado como administrador
    checkIfAdmin(email) {
        return AUTHORIZED_ADMINS.includes(email?.toLowerCase());
    }

    // Registrar callback para cambios de estado de autenticación
    onAuthStateChange(callback) {
        this.authStateChangeCallbacks.push(callback);
        
        // Llamar inmediatamente si ya hay un usuario
        if (this.currentUser !== null) {
            callback(this.currentUser, this.isAdmin);
        }
    }

    // Iniciar sesión con email y contraseña
    async signIn(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Verificar si es administrador autorizado
            if (!this.checkIfAdmin(user.email)) {
                await this.signOut();
                throw new Error('No tienes permisos de administrador');
            }

            return {
                success: true,
                user: user,
                message: 'Sesión iniciada exitosamente'
            };
        } catch (error) {
            let errorMessage = 'Error al iniciar sesión';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuario no encontrado';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
                    break;
                default:
                    errorMessage = error.message;
            }

            return {
                success: false,
                error: error.code,
                message: errorMessage
            };
        }
    }

    // Crear cuenta de administrador (solo para setup inicial)
    async createAdminAccount(email, password) {
        try {
            // Verificar que el email esté en la lista de administradores autorizados
            if (!this.checkIfAdmin(email)) {
                throw new Error('Email no autorizado para administración');
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            return {
                success: true,
                user: user,
                message: 'Cuenta de administrador creada exitosamente'
            };
        } catch (error) {
            let errorMessage = 'Error al crear cuenta';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'El email ya está en uso';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'La contraseña es muy débil (mínimo 6 caracteres)';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                default:
                    errorMessage = error.message;
            }

            return {
                success: false,
                error: error.code,
                message: errorMessage
            };
        }
    }

    // Cerrar sesión
    async signOut() {
        try {
            await signOut(auth);
            return {
                success: true,
                message: 'Sesión cerrada exitosamente'
            };
        } catch (error) {
            return {
                success: false,
                error: error.code,
                message: 'Error al cerrar sesión'
            };
        }
    }

    // Enviar email para restablecer contraseña
    async resetPassword(email) {
        try {
            // Verificar que el email esté autorizado
            if (!this.checkIfAdmin(email)) {
                throw new Error('Email no autorizado');
            }

            await sendPasswordResetEmail(auth, email);
            return {
                success: true,
                message: 'Email de restablecimiento enviado'
            };
        } catch (error) {
            let errorMessage = 'Error al enviar email';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuario no encontrado';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                default:
                    errorMessage = error.message;
            }

            return {
                success: false,
                error: error.code,
                message: errorMessage
            };
        }
    }

    // Cambiar contraseña (usuario debe estar autenticado)
    async changePassword(newPassword) {
        try {
            if (!this.currentUser) {
                throw new Error('No hay usuario autenticado');
            }

            await updatePassword(this.currentUser, newPassword);
            return {
                success: true,
                message: 'Contraseña actualizada exitosamente'
            };
        } catch (error) {
            let errorMessage = 'Error al cambiar contraseña';
            
            switch (error.code) {
                case 'auth/weak-password':
                    errorMessage = 'La contraseña es muy débil (mínimo 6 caracteres)';
                    break;
                case 'auth/requires-recent-login':
                    errorMessage = 'Debes iniciar sesión nuevamente para cambiar tu contraseña';
                    break;
                default:
                    errorMessage = error.message;
            }

            return {
                success: false,
                error: error.code,
                message: errorMessage
            };
        }
    }

    // Obtener información del usuario actual
    getCurrentUser() {
        return {
            user: this.currentUser,
            isAdmin: this.isAdmin,
            isAuthenticated: !!this.currentUser
        };
    }

    // Middleware para verificar autenticación de admin
    requireAdminAuth() {
        return this.currentUser && this.isAdmin;
    }

    // Obtener token de autenticación para requests del servidor
    async getAuthToken() {
        if (!this.currentUser) {
            return null;
        }
        
        try {
            return await this.currentUser.getIdToken();
        } catch (error) {
            return null;
        }
    }
}

// Instancia singleton
export const firebaseAuth = new FirebaseAuth();

// Helper para mostrar mensajes de notificación
export function showAuthNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `auth-notification ${type}`;
    notification.innerHTML = `
        <div class="auth-notification-content">
            <span class="auth-notification-message">${message}</span>
        </div>
    `;
    
    // Estilos inline para la notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: Arial, sans-serif;
        ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
        ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
        ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
    
    // Botón para cerrar manualmente
    const closeBtn = notification.querySelector('.auth-notification-close');
    closeBtn.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
}