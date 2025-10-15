export const adminConfig = {
    email: "admin@minichan.com",
    password: "admin123"  // Cambia esto por una contraseña más segura
};

export const uploadConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB en bytes
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    errorMessages: {
        size: "El archivo no debe superar los 5MB",
        type: "Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)"
    }
};

// Configuración de ImgBB API
export const imgbbConfig = {
    // Obtén tu API key gratuita en: https://api.imgbb.com/
    apiKey: "31d6ec137c463e0cf5f9db7b6bf6c3bf", // Reemplaza esto con tu API key de ImgBB
    endpoint: "https://api.imgbb.com/1/upload"
};
