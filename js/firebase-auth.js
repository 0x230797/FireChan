// Sistema de autenticación Firebase para administradores
import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged
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