# FireChan

FireChan es un imageboard estilo 4chan/2chan desarrollado con tecnologías web modernas. Permite a los usuarios crear tablones temáticos, publicar, responder con imágenes y texto, todo almacenado en Firebase.

## Características

### Funcionalidades Core
- **Múltiples tablones temáticos**: Anime, Tecnología, Videojuegos, Política, Paranormal y más
- **Sistema de publicaciones y respuestas**: Publica contenido y responde a otros usuarios
- **Soporte de imágenes**: Integración con ImgBB para subir y almacenar imágenes
- **Formato de texto enriquecido**: Soporta greentext, citas, enlaces y referencias cruzadas
- **Diseño responsive**: Funciona en dispositivos móviles y escritorio
- **Lightbox para imágenes**: Visualiza imágenes en pantalla completa

### Moderación y Administración
- **Panel de administración completo**: Gestiona publicaciones, respuestas y reportes
- **Firebase Authentication**: Sistema de autenticación seguro para administradores
- **Sistema de reportes**: Los usuarios pueden reportar contenido inapropiado
- **Sistema de baneos por IP**: Banea IPs con duración configurable y razones específicas
- **Visualización de IPs**: Los administradores pueden ver y copiar IPs de usuarios con ipify
- **Gestión de baneos**: Interface para ver, agregar y remover baneos activos
- **Estadísticas del sitio**: Métricas completas de uso y actividad

### Seguridad y Anti-Spam
- **Sistema CAPTCHA matemático**: Verificación anti-spam simple pero efectiva
- **Validación doble**: Cliente + servidor con tokens únicos Firebase
- **Sistema de baneos automático**: Ban por múltiples fallos de CAPTCHA
- **Prevención de ataques**: Registro de intentos fallidos por IP
- **Overlay anti-duplicados**: Sistema mejorado de notificaciones de ban

### Características Técnicas
- **Arquitectura modular**: Código refactorizado con utilidades centralizadas
- **Sistema de integración de baneos**: Verificación automática antes de cada acción
- **Overlay completo para usuarios baneados**: Interface profesional para usuarios restringidos
- **Firebase Auth integrado**: Autenticación segura reemplaza sistema hardcodeado

## Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+ con módulos)
- **Base de datos**: Firebase Firestore con transacciones y queries optimizados
- **Autenticación**: Firebase Authentication para administradores
- **Almacenamiento**: ImgBB API para hosting de imágenes
- **Arquitectura**: Sistema modular con utilidades centralizadas
- **Seguridad**: Sistema CAPTCHA matemático con validación dual
- **APIs externas**: 
  - ipify.org para detección de IP
  - ImgBB para almacenamiento de imágenes
  - Firebase Auth para autenticación segura
- **Diseño**: Inspirado en imageboards clásicos con mejoras modernas

## Requisitos Previos

Antes de comenzar, necesitas:

1. Una cuenta de [Firebase](https://firebase.google.com/)
2. Una API key de [ImgBB](https://api.imgbb.com/) (gratuita)
3. Un servidor web local o hosting web

## Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone https://github.com/0x230797/FireChan.git
cd FireChan
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Firestore Database:
   - Ve a "Firestore Database"
   - Crea una base de datos en modo de producción
   - Configura las reglas de seguridad según tus necesidades

4. Habilita Firebase Authentication:
   - Ve a "Authentication" > "Sign-in method"
   - Habilita "Email/Password"
   - Agrega dominios autorizados si es necesario

5. Obtén las credenciales de tu proyecto:
   - Ve a Configuración del proyecto > Tus aplicaciones
   - Registra una aplicación web
   - Copia la configuración de Firebase

6. Configura el archivo `js/firebase-config.js` con tus credenciales:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "tu-app-id"
};
```

### 3. Configurar ImgBB API

1. Regístrate en [ImgBB](https://imgbb.com/) y obtén tu API key gratuita
2. Abre el archivo `js/config.js`
3. Reemplaza la API key con la tuya:

```javascript
export const imgbbConfig = {
    apiKey: "TU_API_KEY_DE_IMGBB",
    endpoint: "https://api.imgbb.com/1/upload"
};
```

### 4. Configurar Administradores Autorizados

1. Abre el archivo `js/firebase-auth.js`
2. Actualiza la lista de emails autorizados como administradores:

```javascript
const AUTHORIZED_ADMINS = [
    'admin@firechan.org',
    'tu-email@dominio.com',  // Agrega tu email aquí
    // Agregar más emails de administradores aquí
];
```

3. **Crear primera cuenta de administrador**:
   - Accede a `admin.html`
   - Usa el botón "Crear Cuenta" para crear tu primera cuenta
   - O usa la función `createAdminAccount()` desde la consola del navegador

**Seguro**: Las credenciales se manejan completamente por Firebase Authentication.

### 5. Desplegar el Sitio

Puedes desplegar en:
- **Firebase Hosting**: `firebase deploy`
- **GitHub Pages**: Sube los archivos a tu repositorio
- **Netlify/Vercel**: Conecta tu repositorio de GitHub
- Cualquier hosting web estático

## Estructura del Proyecto

```
FireChan/
├── index.html              # Página principal con tablones
├── thread.html             # Vista de publicaciones de un tablón
├── reply.html              # Vista de publicación individual con respuestas
├── admin.html              # Panel de administración completo
├── rules.html              # Reglas del sitio
├── css/
│   ├── style.css           # Estilos principales
│   └── reset.css           # Reset CSS
├── js/
│   ├── firebase-config.js  # Configuración de Firebase
│   ├── firebase-auth.js    # Sistema de autenticación Firebase
│   ├── config.js           # Configuración general
│   ├── utils.js            # Utilidades centralizadas
│   ├── thread.js           # Lógica de publicaciones
│   ├── reply.js            # Lógica de respuestas
│   ├── admin.js            # Panel admin con gestión de IPs
│   ├── text-processor.js   # Procesamiento de texto y referencias
│   ├── ip-ban-system.js    # Sistema de baneos por IP
│   ├── ban-integration.js  # Integración automática de baneos
│   ├── captcha-system.js   # Sistema CAPTCHA matemático anti-spam
│   └── stats.js            # Estadísticas del sitio
└── README.md
```

## Uso

### Para Usuarios

1. **Navegar tablones**: Accede a `index.html` y selecciona un tablón
2. **Crear publicación**: En un tablón, llena el formulario y haz clic en "Publicar"
3. **Responder**: Abre una publicación y usa el formulario de respuesta
4. **Reportar contenido**: Usa el botón "Reportar" en cualquier publicación

### Para Administradores

1. **Acceso al panel**: Accede a `admin.html`
2. **Iniciar sesión**: Usa Firebase Authentication (email/password)
3. **Gestión de contenido**: 
   - Ver y eliminar publicaciones y respuestas
   - Gestionar reportes de usuarios
   - Ver estadísticas completas del sitio
4. **Sistema de baneos**:
   - Ver IPs de todos los usuarios (clic para copiar)
   - Banear IPs con duración configurable (1 hora - permanente)
   - Gestionar lista de IPs baneadas
   - Razones predefinidas: Spam, Contenido inapropiado, Trolling, Flood, etc.
5. **Sistema CAPTCHA**:
   - Automáticamente protege contra spam
   - Baneos automáticos por múltiples fallos
   - Sin configuración adicional requerida

## Personalización

### Modificar Tablones

Edita los archivos HTML (`index.html`, `thread.html`, etc.) para agregar o quitar tablones:

```html
<a href="thread.html?board=tu-tablón" class="board-card">
    <div class="board-title">/tu/ - Tu Tablón</div>
    <div class="board-desc">Descripción de tu tablón</div>
</a>
```

### Configurar Sistema de Baneos

En `ip-ban-system.js` puedes modificar:

```javascript
// Duraciones predefinidas (en milisegundos)
export const BanDurations = {
    HOUR_1: 60 * 60 * 1000,
    DAY_1: 24 * 60 * 60 * 1000,
    WEEK_1: 7 * 24 * 60 * 60 * 1000,
    MONTH_1: 30 * 24 * 60 * 60 * 1000,
    PERMANENT: null
};
```

### Estilos

Modifica `css/style.css` para personalizar colores, fuentes y diseño.
El sistema de baneos incluye estilos específicos para overlays y notificaciones.

## Reglas de Firestore Recomendadas

### Reglas de Desarrollo (Permisivas)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Threads - lectura pública, escritura libre (temporalmente)
    match /threads/{document=**} {
      allow read: if true;
      allow write: if true; // Para desarrollo - restringir en producción
    }
    
    // Respuestas - lectura pública, escritura libre (temporalmente)
    match /replies/{document=**} {
      allow read: if true;
      allow write: if true; // Para desarrollo - restringir en producción
    }
    
    // Reportes - lectura y escritura pública para permitir reportar
    match /reports/{document=**} {
      allow read, write: if true;
    }
    
    // Sistema de baneos - solo lectura pública, escritura restringida
    match /ip_bans/{document=**} {
      allow read: if true;
      allow write: if false; // Solo via admin o server-side
    }
    
    // Noticias - lectura pública, escritura solo admins
    match /news/{document=**} {
      allow read: if true;
      allow write: if false; // Solo via admin
    }
    
    // CAPTCHA challenges - lectura y escritura necesaria para validación
    match /captcha_challenges/{document=**} {
      allow read, write: if true; // Necesario para sistema anti-spam
    }
    
    // Contadores - lectura pública, escritura libre para IDs
    match /counters/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Reglas de Producción (RECOMENDADAS - Seguridad Máxima)

Para un entorno de producción más seguro y optimizado:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ================ FUNCIONES DE UTILIDAD ================
    
    // Verificar si el usuario es administrador autenticado
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email in [
               'admin@firechan.org',
               // Agregar emails de admins autorizados aquí
             ];
    }
    
    // Validar tamaño y formato de contenido
    function isValidContent(data) {
      return data.comment != null &&
             data.comment is string &&
             data.comment.size() > 0 &&
             data.comment.size() <= 2000 &&
             data.name.size() <= 50 &&
             (!('subject' in data) || data.subject.size() <= 100);
    }
    
    // Validar estructura de thread
    function isValidThread(data) {
      return isValidContent(data) &&
             data.board != null &&
             data.board is string &&
             data.board.size() <= 20 &&
             data.postId != null &&
             data.postId is int &&
             data.timestamp != null;
    }
    
    // Validar estructura de reply
    function isValidReply(data) {
      return isValidContent(data) &&
             data.threadId != null &&
             data.threadId is string &&
             data.postId != null &&
             data.postId is int &&
             data.timestamp != null;
    }
    
    // Validar que la IP no esté baneada (simplificado, mejor en backend)
    function isNotBanned() {
      // Esta validación es básica. La verdadera validación
      // debe hacerse en el cliente antes de enviar
      return true; 
    }
    
    // ================ COLECCIONES ================
    
    // THREADS - Posts principales
    match /threads/{threadId} {
      // Lectura pública
      allow read: if true;
      
      // Creación solo con contenido válido
      allow create: if isValidThread(request.resource.data) &&
                      isNotBanned();
      
      // Actualización solo para incrementar contador de respuestas
      // o admins para cualquier cambio
      allow update: if isAdmin() ||
                      (request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['replyCount']));
      
      // Eliminación solo admins
      allow delete: if isAdmin();
    }
    
    // REPLIES - Respuestas a threads
    match /replies/{replyId} {
      // Lectura pública
      allow read: if true;
      
      // Creación solo con contenido válido
      allow create: if isValidReply(request.resource.data) &&
                      isNotBanned() &&
                      // Verificar que el thread padre existe
                      exists(/databases/$(database)/documents/threads/$(request.resource.data.threadId));
      
      // Sin actualizaciones de usuarios normales
      allow update: if isAdmin();
      
      // Eliminación solo admins
      allow delete: if isAdmin();
    }
    
    // REPORTS - Sistema de reportes
    match /reports/{reportId} {
      // Lectura solo admins
      allow read: if isAdmin();
      
      // Crear reporte con validación
      allow create: if request.resource.data.contentId != null &&
                      request.resource.data.contentType != null &&
                      request.resource.data.reason != null &&
                      request.resource.data.reason is string &&
                      request.resource.data.reason.size() > 0 &&
                      request.resource.data.reason.size() <= 200 &&
                      request.resource.data.timestamp != null;
      
      // Solo admins pueden actualizar/eliminar
      allow update, delete: if isAdmin();
    }
    
    // IP_BANS - Sistema de baneos
    match /ip_bans/{banId} {
      // Lectura solo para verificar si están baneados (limitada)
      allow read: if true;
      
      // Escritura solo admins o backend
      allow write: if isAdmin();
    }
    
    // NEWS - Noticias del sitio
    match /news/{newsId} {
      // Lectura pública
      allow read: if true;
      
      // Solo admins pueden gestionar noticias
      allow write: if isAdmin();
    }
    
    // CAPTCHA_CHALLENGES - Sistema anti-spam
    match /captcha_challenges/{challengeId} {
      // Lectura para validar respuestas
      allow read: if true;
      
      // Creación para generar desafíos
      allow create: if request.resource.data.token != null &&
                      request.resource.data.answer != null &&
                      request.resource.data.timestamp != null;
      
      // Actualización para marcar como usado/verificado
      allow update: if request.resource.data.verified != null ||
                      request.resource.data.attempts != null;
      
      // Eliminación automática después de TTL (mejor con Cloud Functions)
      allow delete: if true;
    }
    
    // COUNTERS - Sistema de IDs secuenciales
    match /counters/{counterId} {
      // Lectura pública
      allow read: if true;
      
      // Escritura controlada (crear contador inicial)
      allow create: if counterId == 'postIdCounter' &&
                      request.resource.data.value != null &&
                      request.resource.data.value is int;
      
      // Actualización con incremento atómico
      allow update: if counterId == 'postIdCounter' &&
                      request.resource.data.value == resource.data.value + 1;
      
      // Sin eliminación
      allow delete: if false;
    }
  }
}
```

### Mejoras de Seguridad Adicionales Recomendadas

#### 1. **Implementar Cloud Functions para Validación Backend**

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Validar y limpiar contenido antes de guardar
exports.validatePost = functions.firestore
  .document('{collection}/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    // Verificar IP baneada
    const ipBansRef = admin.firestore().collection('ip_bans');
    const banQuery = await ipBansRef
      .where('ip', '==', data.userIP)
      .where('active', '==', true)
      .get();
    
    if (!banQuery.empty) {
      // Eliminar el post de usuario baneado
      await snap.ref.delete();
      console.log(`Post bloqueado de IP baneada: ${data.userIP}`);
    }
    
    // Validar contenido (anti-spam, palabras prohibidas, etc.)
    // ...
  });

// Limpiar CAPTCHA challenges expirados
exports.cleanupExpiredCaptchas = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const expiredCaptchas = await admin.firestore()
      .collection('captcha_challenges')
      .where('timestamp', '<', new Date(now.toMillis() - 3600000))
      .get();
    
    const batch = admin.firestore().batch();
    expiredCaptchas.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`Eliminados ${expiredCaptchas.size} CAPTCHAs expirados`);
  });
```

#### 2. **Índices Compuestos Recomendados**

Crea estos índices en Firebase Console para optimizar queries:

```
Collection: threads
- board (Ascending) + timestamp (Descending)

Collection: replies  
- threadId (Ascending) + timestamp (Ascending)
- threadId (Ascending) + timestamp (Descending)

Collection: reports
- timestamp (Descending)

Collection: ip_bans
- ip (Ascending) + active (Ascending)
- active (Ascending) + expiresAt (Ascending)

Collection: captcha_challenges
- token (Ascending) + verified (Ascending)
- ip (Ascending) + timestamp (Descending)
```

#### 3. **Rate Limiting (App Check)**

Habilita Firebase App Check para proteger contra abuso:

```javascript
// En firebase-config.js, agregar:
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_V3_SITE_KEY'),
  isTokenAutoRefreshEnabled: true
});
```

#### 4. **Configuración de Seguridad Storage (si usas Firebase Storage)**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{imageId} {
      // Solo lectura pública
      allow read: if true;
      
      // Solo escritura con validación de tamaño
      allow write: if request.resource.size < 10 * 1024 * 1024 && // 10MB máx
                     request.resource.contentType.matches('image/.*');
    }
  }
}
```

### Resumen de Cambios para Producción

**✅ Implementar:**
1. Reglas de Firestore con validación estricta
2. Autenticación Firebase para operaciones de admin
3. Validación de contenido (tamaño, formato)
4. Verificación de existencia de documentos padre
5. Protección contra modificaciones no autorizadas
6. Rate limiting con App Check
7. Cloud Functions para validación backend
8. Índices compuestos para performance
9. Limpieza automática de datos temporales (CAPTCHA)
10. Monitoreo y alertas de uso anormal

**🔒 Beneficios de Seguridad:**
- Previene spam y flood
- Bloquea IPs baneadas efectivamente
- Valida estructura de datos
- Protege operaciones de admin
- Optimiza queries (índices)
- Limpia datos obsoletos automáticamente
- Protege contra inyección de datos maliciosos
## Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -m 'Agrega nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abre un Pull Request

## Licencia

Este proyecto es de código abierto bajo MIT License.

## Disclaimer

FireChan es una plataforma de entretenimiento y discusión. Todo el contenido es responsabilidad de los usuarios. Los administradores se reservan el derecho de moderar contenido según las reglas establecidas. El sistema de baneos está implementado para mantener un ambiente seguro y respetuoso.

---

**FireChan** - Desarrollado con ❤️ por [0x230797](https://github.com/0x230797)