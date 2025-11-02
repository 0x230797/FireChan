// Sistema CAPTCHA matemático simple y seguro para FireChan
import { db } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { ipBanSystem } from './ip-ban-system.js';

class CaptchaSystem {
    constructor() {
        this.currentChallenge = null;
        this.token = null;
        this.failureCount = 0;
        this.maxFailures = 5; // Máximo de fallos antes de ban temporal
        
        // Inicializar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initCaptcha();
            });
        } else {
            this.initCaptcha();
        }
    }

    // Generar operación matemática simple
    generateMathChallenge() {
        const operations = ['+', '-'];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        
        let num1, num2, answer;
        
        if (operation === '+') {
            num1 = Math.floor(Math.random() * 20) + 1; // 1-20
            num2 = Math.floor(Math.random() * 20) + 1; // 1-20
            answer = num1 + num2;
        } else { // resta
            num1 = Math.floor(Math.random() * 30) + 10; // 10-39
            num2 = Math.floor(Math.random() * (num1 - 1)) + 1; // 1 a num1-1
            answer = num1 - num2;
        }

        return {
            question: `${num1} ${operation} ${num2} =`,
            answer: answer,
            timestamp: Date.now()
        };
    }

    // Generar token único para validación
    generateSecureToken() {
        return Math.random().toString(36).substring(2) + 
               Date.now().toString(36) + 
               Math.random().toString(36).substring(2);
    }

    // Inicializar CAPTCHA
    async initCaptcha() {
        this.currentChallenge = this.generateMathChallenge();
        this.token = this.generateSecureToken();
        
        // Guardar en Firebase para validación del servidor
        try {
            await addDoc(collection(db, 'captcha_challenges'), {
                token: this.token,
                answer: this.currentChallenge.answer,
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutos
                used: false
            });
        } catch (error) {
            // Error guardando CAPTCHA - continuar sin Firebase
        }

        this.renderCaptcha();
    }

    // Renderizar CAPTCHA en el DOM
    renderCaptcha() {
        const captchaContainer = document.getElementById('captcha-container');
        if (!captchaContainer) return;

        captchaContainer.innerHTML = `
            <div>
                <span>
                    ${this.currentChallenge.question}
                </span>
                <input type="number" id="captcha-answer" name="captcha-answer"placeholder="Tu respuesta" autocomplete="off" style="padding: 4px" required>
                <input type="hidden" id="captcha-token" name="captcha-token" value="${this.token}">
                <button type="button" id="refresh-captcha" title="Generar nuevo CAPTCHA">
                    &circlearrowleft;
                </button>
            </div>
        `;

        // Event listener para refrescar CAPTCHA
        document.getElementById('refresh-captcha').addEventListener('click', () => {
            this.initCaptcha();
        });
    }

    // Validar CAPTCHA en el cliente
    validateClient(userAnswer) {
        const answer = parseInt(userAnswer);
        const isValid = answer === this.currentChallenge.answer;
        
        // Verificar que no sea muy viejo (5 minutos)
        const age = Date.now() - this.currentChallenge.timestamp;
        const isExpired = age > 5 * 60 * 1000;
        
        if (isExpired) {
            this.showError('CAPTCHA expirado. Se ha generado uno nuevo.');
            this.initCaptcha();
            return false;
        }
        
        if (!isValid) {
            this.handleFailure();
            return false;
        }

        // Resetear contador en caso de éxito
        this.failureCount = 0;
        return true;
    }

    // Validar CAPTCHA en el servidor (Firebase)
    async validateServer(token, userAnswer) {
        try {
            const q = query(
                collection(db, 'captcha_challenges'), 
                where('token', '==', token),
                where('used', '==', false)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return { valid: false, error: 'Token CAPTCHA inválido o expirado' };
            }

            const doc = querySnapshot.docs[0];
            const data = doc.data();
            
            // Verificar expiración
            const now = new Date();
            if (data.expiresAt.toDate() < now) {
                // Limpiar token expirado
                await deleteDoc(doc.ref);
                return { valid: false, error: 'CAPTCHA expirado' };
            }

            // Verificar respuesta
            const isCorrect = parseInt(userAnswer) === data.answer;
            
            if (isCorrect) {
                // Marcar como usado para prevenir reutilización
                await deleteDoc(doc.ref);
                return { valid: true };
            } else {
                // Registrar fallo en el servidor también
                await this.recordFailureAttempt();
                return { valid: false, error: 'Respuesta CAPTCHA incorrecta' };
            }

        } catch (error) {
            return { valid: false, error: 'Error del servidor' };
        }
    }

    // Mostrar errores
    showError(message) {
        const errorDiv = document.getElementById('captcha-error') || this.createErrorDiv();
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Auto-ocultar después de 3 segundos
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }

    // Crear div de error si no existe
    createErrorDiv() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'captcha-error';
        errorDiv.className = 'captcha-error';
        errorDiv.style.display = 'none';
        
        const captchaContainer = document.getElementById('captcha-container');
        if (captchaContainer) {
            captchaContainer.appendChild(errorDiv);
        }
        
        return errorDiv;
    }

    // Obtener datos del CAPTCHA para envío
    getCaptchaData() {
        const answerInput = document.getElementById('captcha-answer');
        const tokenInput = document.getElementById('captcha-token');
        
        if (!answerInput || !tokenInput) {
            this.showError('Error: CAPTCHA no inicializado correctamente');
            return null;
        }

        return {
            answer: answerInput.value,
            token: tokenInput.value
        };
    }

    // Limpiar CAPTCHA después del envío
    clearCaptcha() {
        const answerInput = document.getElementById('captcha-answer');
        if (answerInput) {
            answerInput.value = '';
        }
        this.initCaptcha(); // Generar nuevo para siguientes envíos
    }

    // Manejar fallo de CAPTCHA con sistema de baneos
    async handleFailure() {
        this.failureCount++;
        
        if (this.failureCount >= this.maxFailures) {
            // Ban temporal por múltiples fallos de CAPTCHA
            try {
                const { ipBanSystem } = await import('./ip-ban-system.js');
                const userIP = await ipBanSystem.getUserIP();
                const banDuration = 15 * 60 * 1000; // 15 minutos
                const reason = `Múltiples fallos de CAPTCHA (${this.failureCount} intentos)`;
                
                await ipBanSystem.banIP(userIP, reason, banDuration, 'Sistema Anti-Spam');
                
                this.showError(`Demasiados fallos de CAPTCHA. Has sido baneado temporalmente por 15 minutos.`);
                
                // Recargar página después de 3 segundos
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
                
            } catch (error) {
                // Error baneando usuario - continuar sin ban
            }
        } else {
            const remainingAttempts = this.maxFailures - this.failureCount;
            this.showError(`Respuesta incorrecta (${remainingAttempts} intentos restantes)`);
            this.initCaptcha();
        }
    }

    // Registrar intento fallido en el servidor
    async recordFailureAttempt() {
        try {
            const { ipBanSystem } = await import('./ip-ban-system.js');
            const userIP = await ipBanSystem.getUserIP();
            const failureDoc = doc(db, 'captcha_failures', userIP);
            
            const docSnap = await getDoc(failureDoc);
            const now = new Date();
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                const lastFailure = data.lastFailure.toDate();
                const timeDiff = now - lastFailure;
                
                // Resetear contador si han pasado más de 30 minutos
                if (timeDiff > 30 * 60 * 1000) {
                    await setDoc(failureDoc, {
                        count: 1,
                        lastFailure: now,
                        ip: userIP
                    });
                } else {
                    const newCount = data.count + 1;
                    await setDoc(failureDoc, {
                        count: newCount,
                        lastFailure: now,
                        ip: userIP
                    });
                    
                    // Si hay muchos fallos desde el servidor, activar ban automático
                    if (newCount >= this.maxFailures * 2) {
                        const banDuration = 60 * 60 * 1000; // 1 hora
                        await ipBanSystem.banIP(userIP, 'Múltiples fallos de CAPTCHA persistentes', banDuration, 'Sistema Anti-Spam');
                    }
                }
            } else {
                await setDoc(failureDoc, {
                    count: 1,
                    lastFailure: now,
                    ip: userIP
                });
            }
        } catch (error) {
            // Error registrando fallo - continuar sin registro
        }
    }

    // Limpiar CAPTCHAs expirados (función de mantenimiento)
    async cleanupExpiredChallenges() {
        try {
            const now = new Date();
            const q = query(
                collection(db, 'captcha_challenges'),
                where('expiresAt', '<', now)
            );
            
            const querySnapshot = await getDocs(q);
            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
            
            await Promise.all(deletePromises);
        } catch (error) {
            // Error limpiando CAPTCHAs expirados - continuar
        }
    }
}

// Instancia global del sistema CAPTCHA
export const captchaSystem = new CaptchaSystem();

// Función de utilidad para validación completa
export async function validateCaptcha(showErrors = true) {
    const captchaData = captchaSystem.getCaptchaData();
    
    if (!captchaData) {
        return false;
    }

    // Validación del cliente primero (rápida)
    const clientValid = captchaSystem.validateClient(captchaData.answer);
    if (!clientValid) {
        return false;
    }

    // Validación del servidor (segura)
    const serverValidation = await captchaSystem.validateServer(captchaData.token, captchaData.answer);
    
    if (!serverValidation.valid) {
        if (showErrors) {
            captchaSystem.showError(serverValidation.error);
        }
        captchaSystem.initCaptcha(); // Generar nuevo
        return false;
    }

    // CAPTCHA válido, limpiar para siguiente uso
    captchaSystem.clearCaptcha();
    return true;
}

// Limpieza automática cada 10 minutos
setInterval(() => {
    captchaSystem.cleanupExpiredChallenges();
}, 10 * 60 * 1000);