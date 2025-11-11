<?php
/**
 * Sistema de subida de imágenes local para FireChan
 * Estilo 4chan: nombres de 10 dígitos, organizado por boards
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

// Configuración
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
define('ALLOWED_TYPES', ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
define('BASE_UPLOAD_DIR', __DIR__ . '/img/board/');

// Función para generar nombre estilo 4chan (10 dígitos)
function generateImageName() {
    return str_pad(mt_rand(1, 9999999999), 10, '0', STR_PAD_LEFT);
}

// Función para crear directorios si no existen
function ensureDirectoryExists($path) {
    if (!file_exists($path)) {
        mkdir($path, 0755, true);
    }
}

// Función para obtener dimensiones de imagen
function getImageDimensions($filePath) {
    $imageInfo = getimagesize($filePath);
    if ($imageInfo) {
        return [
            'width' => $imageInfo[0],
            'height' => $imageInfo[1]
        ];
    }
    return ['width' => 0, 'height' => 0];
}

// Validar que sea una petición POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit();
}

// Validar que haya un archivo
if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No se recibió ningún archivo']);
    exit();
}

// Validar que haya un board
if (!isset($_POST['board'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Board no especificado']);
    exit();
}

$file = $_FILES['image'];
$board = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['board']); // Sanitizar board name

// Validar tamaño
if ($file['size'] > MAX_FILE_SIZE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'El archivo excede el tamaño máximo de 5MB']);
    exit();
}

// Validar tipo MIME
if (!in_array($file['type'], ALLOWED_TYPES)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Tipo de archivo no permitido']);
    exit();
}

// Obtener extensión del archivo
$pathInfo = pathinfo($file['name']);
$extension = strtolower($pathInfo['extension']);

// Validar extensión
if (!in_array($extension, ALLOWED_EXTENSIONS)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Extensión de archivo no permitida']);
    exit();
}

// Validar errores de upload
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al subir el archivo: ' . $file['error']]);
    exit();
}

// Crear directorio del board si no existe
$boardDir = BASE_UPLOAD_DIR . $board . '/';
ensureDirectoryExists($boardDir);

// Generar nombre único
$attempts = 0;
do {
    $imageName = generateImageName();
    $fileName = $imageName . '.' . $extension;
    $filePath = $boardDir . $fileName;
    $attempts++;
    
    // Evitar bucle infinito
    if ($attempts > 100) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'No se pudo generar un nombre único']);
        exit();
    }
} while (file_exists($filePath));

// Mover archivo
if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al guardar el archivo']);
    exit();
}

// Obtener dimensiones
$dimensions = getImageDimensions($filePath);

// Construir URL relativa
$relativeUrl = 'img/board/' . $board . '/' . $fileName;

// Respuesta exitosa
echo json_encode([
    'success' => true,
    'data' => [
        'url' => $relativeUrl,
        'fileName' => $fileName,
        'originalName' => $file['name'],
        'size' => $file['size'],
        'width' => $dimensions['width'],
        'height' => $dimensions['height'],
        'board' => $board
    ]
]);
