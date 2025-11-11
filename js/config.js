export const uploadConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB en bytes
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    errorMessages: {
        size: "El archivo no debe superar los 5MB",
        type: "Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)"
    }
};
