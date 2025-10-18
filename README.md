# FireChan

FireChan es un imageboard estilo 4chan/2chan desarrollado con tecnologías web modernas. Permite a los usuarios crear tablones temáticos, publicar, responder con imágenes y texto, todo almacenado en Firebase.

## Características

- **Múltiples tablones temáticos**: Anime, Tecnología, Videojuegos, Política, Paranormal y más
- **Sistema de publicaciones y respuestas**: Publica contenido y responde a otros usuarios
- **Soporte de imágenes**: Integración con ImgBB para subir y almacenar imágenes
- **Formato de texto enriquecido**: Soporta greentext, citas, enlaces y formato especial
- **Panel de administración**: Gestiona publicaciones, respuestas y reportes
- **Sistema de reportes**: Los usuarios pueden reportar contenido inapropiado
- **Diseño responsive**: Funciona en dispositivos móviles y escritorio
- **Lightbox para imágenes**: Visualiza imágenes en pantalla completa

## Tecnologías Utilizadas

- HTML5, CSS3, JavaScript (ES6+)
- Firebase Firestore (Base de datos)
- ImgBB API (Almacenamiento de imágenes)
- Diseño inspirado en imageboards clásicos

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

4. Obtén las credenciales de tu proyecto:
   - Ve a Configuración del proyecto > Tus aplicaciones
   - Registra una aplicación web
   - Copia la configuración de Firebase

5. Configura el archivo `js/firebase-config.js` con tus credenciales:

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

### 4. Configurar Credenciales de Administrador

Abre `js/config.js` y personaliza las credenciales del panel admin:

```javascript
export const adminConfig = {
    email: "tu-email@dominio.com",
    password: "tu-contraseña-segura"
};
```

**Importante**: Estas credenciales se almacenan en el cliente. Para producción, considera implementar Firebase Authentication.

### 5. Desplegar el Sitio

Puedes desplegar en:
- **Firebase Hosting**: `firebase deploy`
- **GitHub Pages**: Sube los archivos a tu repositorio
- **Netlify/Vercel**: Conecta tu repositorio de GitHub
- Cualquier hosting web estático

## Estructura del Proyecto

```
FireChan/
├── index.html          # Página principal con tablones
├── thread.html         # Vista de publicaciones de un tablón
├── reply.html          # Vista de publicación individual con respuestas
├── admin.html          # Panel de administración
├── rules.html          # Reglas del sitio
├── css/
│   └── style.css       # Estilos principales
├── js/
│   ├── firebase-config.js  # Configuración de Firebase (crear)
│   ├── config.js           # Configuración general
│   ├── thread.js           # Lógica de publicaciones
│   ├── reply.js            # Lógica de respuestas
│   ├── admin.js            # Lógica del panel admin
│   └── text-processor.js   # Procesamiento de texto (greentext, etc.)
└── README.md
```

## Uso

### Para Usuarios

1. **Navegar tablones**: Accede a `index.html` y selecciona un tablón
2. **Crear publicación**: En un tablón, llena el formulario y haz clic en "Publicar"
3. **Responder**: Abre una publicación y usa el formulario de respuesta
4. **Reportar contenido**: Usa el botón "Reportar" en cualquier publicación

### Para Administradores

1. Accede a `admin.html`
2. Inicia sesión con las credenciales configuradas
3. Gestiona publicaciones, respuestas y reportes desde el panel

## Personalización

### Modificar Tablones

Edita los archivos HTML (`index.html`, `thread.html`, etc.) para agregar o quitar tablones:

```html
<a href="thread.html?board=tu-tablón" class="board-card">
    <div class="board-title">/tu/ - Tu Tablón</div>
    <div class="board-desc">Descripción de tu tablón</div>
</a>
```

### Estilos

Modifica `css/style.css` para personalizar colores, fuentes y diseño.

## Seguridad

- Las credenciales de admin actuales son básicas y solo para desarrollo
- Para producción, implementa autenticación real con Firebase Auth
- Configura correctamente las reglas de Firestore
- Valida y sanitiza todo el input del usuario
- Considera implementar CAPTCHA para prevenir spam

## Reglas de Firestore Recomendadas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /threads/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /replies/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -m 'Agrega nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abre un Pull Request

## Licencia

Este proyecto es de código abierto y está disponible bajo los términos que definas.

## Disclaimer

Todo el contenido publicado es ficticio y se proporciona únicamente con fines de entretenimiento. Los administradores del sitio no son responsables del contenido generado por los usuarios.

## Soporte

Si tienes problemas o sugerencias, usa el tablón `/me/ Meta` dentro de la aplicación o abre un issue en GitHub.

---

Desarrollado con ❤️ por 0x230797