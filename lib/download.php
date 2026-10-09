<?php
declare(strict_types=1);

// Скачивание версии игры (PHP + MySQL + AJAX + Canvas + JS + CSS) из админки.
// Архив собирается на лету: весь код игры без секретов и пользовательских данных.

const DL_VERSION = '2.5.0';

function download_file_list(): array {
    $root = ROOT;
    $out = [];
    // Каталоги и файлы, которые не должны попасть в архив.
    $skipDirs = ['data/sessions'];
    $skipFiles = ['config.php', 'data/installed.lock'];
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    /** @var SplFileInfo $f */
    foreach ($it as $f) {
        $full = $f->getPathname();
        $rel = substr($full, strlen($root) + 1);
        $rel = str_replace('\\', '/', $rel);
        // Служебное и временное — мимо.
        if (str_starts_with($rel, '.git/') || $rel === '.git') continue;
        if (str_starts_with($rel, 'node_modules/')) continue;
        foreach ($skipDirs as $sd) if ($rel === $sd || str_starts_with($rel, $sd . '/')) continue 2;
        if (in_array($rel, $skipFiles, true)) continue;
        if (preg_match('#^_.*\.(php|html)$#', basename($rel))) continue; // тестовые пробы _p*.html, _devlogin.php
        if (preg_match('#\.(log|tmp|swp)$#i', $rel)) continue;
        if (basename($rel) === '.DS_Store') continue;
        if (str_starts_with($rel, 'uploads/')) continue; // загрузки игроков не раздаём
        if (!$f->isFile() || !$f->isReadable()) continue;
        $out[] = $rel;
    }
    sort($out);
    // Пустая папка uploads должна существовать после распаковки.
    $out[] = 'uploads/.gitkeep:';
    return $out;
}

function download_version_info(): array {
    $files = download_file_list();
    $bytes = 0;
    foreach ($files as $rel) {
        if (str_ends_with($rel, ':')) continue;
        $p = ROOT . '/' . $rel;
        if (is_file($p)) $bytes += (int)filesize($p);
    }
    $tables = 0;
    try { $tables = (int)val("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()"); } catch (Throwable) { $tables = 0; }
    return [
        'version' => DL_VERSION,
        'stack' => 'PHP + MySQL + AJAX + Canvas + JS + CSS',
        'files' => count($files),
        'bytes' => $bytes,
        'size' => round($bytes / 1048576, 2) . ' МБ',
        'php' => PHP_VERSION,
        'zip' => class_exists('ZipArchive'),
        'tables' => $tables,
        'quests' => count(QUEST_POOL),
        'builtAt' => gmdate('Y-m-d H:i:s') . ' UTC',
    ];
}

function download_build_txt(): string {
    $i = download_version_info();
    return "Crownfall v{$i['version']} — {$i['stack']}\r\n"
        . "Собрано из админки: {$i['builtAt']}\r\n"
        . "Файлов: {$i['files']}, размер: {$i['size']}, таблиц MySQL: {$i['tables']}, квестов: {$i['quests']}\r\n"
        . "PHP сборки: {$i['php']}\r\n\r\n"
        . "УСТАНОВКА ЗА 3 ШАГА\r\n"
        . "1. Распакуйте архив в папку сайта, дайте PHP право записи в uploads/ и data/.\r\n"
        . "2. Откройте в браузере install.php, введите данные MySQL (базу установщик создаст сам).\r\n"
        . "3. Зарегистрируйтесь — первый игрок станет администратором.\r\n\r\n"
        . "Требования: PHP 8.1+ (pdo_mysql, mbstring, zip), MySQL 8 / MariaDB 10.4+.\r\n"
        . "Подробности — в README.md внутри архива.\r\n";
}

/** GET api.php?r=download — только для администратора. */
function handle_download(?array $u): void {
    if (!$u || $u['role'] !== 'admin') fail('Доступ запрещён.', 403);
    if (!class_exists('ZipArchive')) fail('На сервере нет расширения php-zip. Установите его: apt install php-zip.', 500);
    $kind = (string)($_GET['kind'] ?? 'full');
    if ($kind === 'info') out(download_version_info());
    if ($kind === 'schema') {
        $sql = @file_get_contents(ROOT . '/schema.sql');
        if ($sql === false) fail('Файл schema.sql не найден.', 500);
        audit((int)$u['id'], 'download', 'Скачана schema.sql');
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="crownfall-schema.sql"');
        header('Content-Length: ' . strlen($sql));
        header('Cache-Control: no-store');
        echo $sql;
        exit;
    }
    if ($kind !== 'full') fail('Неизвестный тип архива.', 400);

    $files = download_file_list();
    $tmp = tempnam(sys_get_temp_dir(), 'cf-dl-');
    if ($tmp === false) fail('Не удалось создать временный файл.', 500);
    $zip = new ZipArchive();
    if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) { @unlink($tmp); fail('Не удалось создать архив.', 500); }
    foreach ($files as $rel) {
        if (str_ends_with($rel, ':')) { $zip->addEmptyDir('crownfall/uploads'); continue; }
        $zip->addFile(ROOT . '/' . $rel, 'crownfall/' . $rel);
    }
    $zip->addFromString('crownfall/BUILD.txt', download_build_txt());
    $zip->close();
    $size = (int)filesize($tmp);
    if ($size <= 0) { @unlink($tmp); fail('Архив получился пустым.', 500); }
    audit((int)$u['id'], 'download', 'Скачан ZIP версии игры (' . count($files) . ' файлов)');
    $name = 'crownfall-php-mysql-' . gmdate('Ymd-Hi') . '.zip';
    if (ob_get_level()) ob_end_clean();
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Content-Length: ' . $size);
    header('Cache-Control: no-store');
    header('Pragma: no-cache');
    $fp = fopen($tmp, 'rb');
    if ($fp) { fpassthru($fp); fclose($fp); }
    @unlink($tmp);
    exit;
}
