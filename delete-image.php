<?php
/**
 * Script para eliminar imágenes del servidor
 * Seguridad: Solo elimina archivos en la carpeta img/board/
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('BASE_DIR', __DIR__ . '/');

// Validar que sea una petición POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit();
}

// Obtener datos
$jsonData = file_get_contents('php://input');
$data = json_decode($jsonData, true);

if (!isset($data['imageUrl'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'URL de imagen no especificada']);
    exit();
}

$imageUrl = $data['imageUrl'];

// Validar que sea una URL local (no externa)
if (strpos($imageUrl, 'http') === 0) {
    echo json_encode(['success' => false, 'error' => 'No se pueden eliminar imágenes externas']);
    exit();
}

// Limpiar la ruta y asegurar que solo elimine de img/board/
$imagePath = preg_replace('/^\/+/', '', $imageUrl); // Eliminar slashes iniciales
$fullPath = BASE_DIR . $imagePath;

// Validar que la ruta esté dentro de img/board/
if (strpos($fullPath, BASE_DIR . 'img/board/') !== 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Ruta no permitida']);
    exit();
}

// Validar que el archivo existe
if (!file_exists($fullPath)) {
    // No es un error si el archivo ya no existe
    echo json_encode(['success' => true, 'message' => 'Archivo no encontrado (posiblemente ya eliminado)']);
    exit();
}

// Validar que sea un archivo (no directorio)
if (!is_file($fullPath)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No es un archivo válido']);
    exit();
}

// Intentar eliminar
if (unlink($fullPath)) {
    echo json_encode(['success' => true, 'message' => 'Imagen eliminada exitosamente']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo eliminar la imagen']);
}
