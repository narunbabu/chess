<?php
/**
 * Simple static file server for tournament visualizer
 * Bypasses Laravel to avoid Vite dependency issues
 */

// Get the requested file path
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$filePath = __DIR__ . $requestUri;

// Default to index
if ($requestUri === '/' || $requestUri === '') {
    $filePath = __DIR__ . '/tournament_visualizer.html';
}

// Security check - prevent directory traversal
$realPath = realpath($filePath);
$publicDir = realpath(__DIR__);

if ($realPath === false || strpos($realPath, $publicDir) !== 0) {
    http_response_code(404);
    echo "404 Not Found";
    exit;
}

// Serve static files
if (file_exists($realPath) && is_file($realPath)) {
    $extension = pathinfo($realPath, PATHINFO_EXTENSION);

    // Set content type based on extension
    $contentTypes = [
        'html' => 'text/html',
        'htm' => 'text/html',
        'json' => 'application/json',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
    ];

    $contentType = $contentTypes[$extension] ?? 'application/octet-stream';
    header("Content-Type: $contentType");

    readfile($realPath);
    exit;
}

// File not found
http_response_code(404);
echo "404 Not Found: " . htmlspecialchars($requestUri);
