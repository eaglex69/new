<?php
// Роутер для встроенного сервера PHP (php -S ... router.php).
// Встроенный сервер не читает .htaccess, поэтому служебные папки и файлы закрываем здесь.
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

if (preg_match('#^/(lib|data)(/|$)#', $path) || $path === '/config.php' || $path === '/schema.sql' || $path === '/router.php' || preg_match('#^/uploads/.*\.php$#i', $path)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    return true;
}

// Существующие статические файлы отдаём как есть.
if ($path !== '/' && is_file(__DIR__ . $path)) {
    return false;
}

// Остальное — через PHP-скрипты, а корень — это index.php.
if ($path === '/') {
    require __DIR__ . '/index.php';
    return true;
}
return false;
