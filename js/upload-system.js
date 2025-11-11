/**
 * Sistema de subida de imágenes local para FireChan
 * Almacenamiento en el servidor local
 */

// Configuración de subida
export const uploadConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    uploadEndpoint: '/upload.php',
    deleteEndpoint: '/delete-image.php',
    errorMessages: {
        size: 'El archivo excede el tamaño máximo de 5MB',
        type: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'
    }
};

/**
 * Subir imagen al servidor local
 * @param {File} file - Archivo de imagen a subir
 * @param {string} board - Board donde se subirá la imagen (a, b, g, v, pol, x, me)
 * @returns {Promise<Object>} - Objeto con url, width, height, fileName, size
 */
export async function uploadImageToServer(file, board) {
    // Validar tamaño
    if (file.size > uploadConfig.maxFileSize) {
        throw new Error(uploadConfig.errorMessages.size);
    }

    // Validar tipo
    if (!uploadConfig.allowedTypes.includes(file.type)) {
        throw new Error(uploadConfig.errorMessages.type);
    }

    // Crear FormData
    const formData = new FormData();
    formData.append('image', file);
    formData.append('board', board);

    try {
        const response = await fetch(uploadConfig.uploadEndpoint, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Error desconocido al subir imagen');
        }

        return {
            url: result.data.url,
            width: result.data.width,
            height: result.data.height,
            fileName: result.data.fileName,
            size: result.data.size,
            originalName: result.data.originalName
        };

    } catch (error) {
        console.error('Error al subir imagen:', error);
        throw new Error('Error al subir imagen: ' + error.message);
    }
}

/**
 * Eliminar imagen del servidor
 * @param {string} imageUrl - URL de la imagen a eliminar
 * @returns {Promise<Object>} - Resultado de la eliminación
 */
export async function deleteImageFromServer(imageUrl) {
    // No intentar eliminar imágenes externas (URLs antiguas)
    if (!imageUrl || imageUrl.includes('http://') || imageUrl.includes('https://')) {
        console.log('Imagen externa, no se puede eliminar del servidor:', imageUrl);
        return { success: true, message: 'Imagen externa (no eliminada del servidor)' };
    }

    try {
        const response = await fetch(uploadConfig.deleteEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imageUrl })
        });

        const result = await response.json();

        if (!result.success) {
            console.warn('No se pudo eliminar la imagen:', result.error);
        }

        return result;

    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Obtener dimensiones de una imagen
 * @param {File} file - Archivo de imagen
 * @returns {Promise<Object>} - Objeto con width y height
 */
export async function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({
                width: img.width,
                height: img.height
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudieron obtener las dimensiones de la imagen'));
        };

        img.src = url;
    });
}
