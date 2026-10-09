<?php
declare(strict_types=1);
// Crownfall · диагностика для хостинга. Только для администратора игры.
// Открыть: https://ваш-сайт/crownfall/diag.php (будучи залогиненным как админ).
require __DIR__ . '/lib/bootstrap.php';
header('Cache-Control: no-store');
header('Content-Type: text/html; charset=utf-8');
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function badge(bool $ok): string { return $ok ? '<span class="ok">OK</span>' : '<span class="bad">ОШИБКА</span>'; }
$css = 'body{margin:0;background:#120a2e;color:#fff;font-family:\'Trebuchet MS\',Arial,sans-serif;padding:24px}h1{font-size:22px;color:#ffd45c;margin:0 0 4px}p.sub{color:#cdb6f2;font-size:13px;margin:0 0 18px}table{border-collapse:collapse;width:100%;max-width:860px;background:#1b0c42;border:2px solid #7a4fd0;border-radius:12px;overflow:hidden;font-size:13px}td{padding:9px 12px;border-bottom:1px solid #4a2496;vertical-align:top}tr:last-child td{border:0}td.k{width:240px;color:#cdb6f7;font-weight:bold}.ok{display:inline-block;background:#1f6a3a;border:1px solid #7dff9a;border-radius:6px;padding:1px 8px;font-size:11px;font-weight:bold}.bad{display:inline-block;background:#8a1f48;border:1px solid #ff8aa0;border-radius:6px;padding:1px 8px;font-size:11px;font-weight:bold}.mono{font-family:monospace;font-size:12px;color:#ffe9a8;word-break:break-all}a{color:#ffd45c}.btn{display:inline-block;margin-top:10px;padding:10px 16px;border-radius:10px;background:linear-gradient(#a6ff5e,#4fcc2e 52%,#2f9c20);color:#0e3d08;font-weight:900;text-decoration:none;border:2px solid #d4ffb0}.warn{color:#ffb86b}';

if (!installed()) { http_response_code(503); echo "<!doctype html><meta charset=\"utf-8\"><style>$css</style><h1>Crownfall · диагностика</h1><p class=\"sub\">Игра не установлена.</p><a class=\"btn\" href=\"install.php\">Открыть установщик</a>"; exit; }
$u = current_user();
if (!$u || ($u['role'] ?? '') !== 'admin') { http_response_code(403); echo "<!doctype html><meta charset=\"utf-8\"><style>$css</style><h1>Crownfall · диагностика</h1><p class=\"sub\">Страница доступна только администратору. Сначала <a href=\"index.php\">войдите в игру</a> под учётной записью администратора (первый зарегистрированный игрок).</p>"; exit; }
$uid = (int)$u['id'];

// Действия администратора
$note = '';
try {
    if (($_GET['op'] ?? '') === 'reset_my_battle') {
        run("UPDATE users SET battle_started_at=NULL, battle_mode='ladder', pvp_opponent_id=NULL WHERE id=?", [$uid]);
        $note = 'Ваш зависший бой сброшен. Можно нажимать «В бой».';
    }
    if (($_GET['op'] ?? '') === 'reset_stuck_all') {
        $n = run("UPDATE users SET battle_started_at=NULL, battle_mode='ladder', pvp_opponent_id=NULL WHERE battle_started_at IS NOT NULL");
        $note = "Сброшено зависших боёв: $n.";
    }
} catch (Throwable $e) { $note = 'Ошибка: ' . $e->getMessage(); }

// Проверки
$rows = [];
$rows[] = ['PHP', badge(version_compare(PHP_VERSION, '8.1.0', '>=')) . ' <span class="mono">' . h(PHP_VERSION) . '</span> (нужен 8.1+)'];
foreach (['pdo_mysql' => 'pdo_mysql', 'mbstring' => 'mbstring', 'json' => 'json', 'session' => 'session', 'zip' => 'zip (для скачивания версии)', 'curl' => 'curl'] as $ext => $label) {
    $has = extension_loaded($ext);
    $rows[] = ["Расширение $label", badge($has || $ext === 'zip' || $ext === 'curl') . ($has ? '' : ' <span class="warn">не установлено' . ($ext === 'zip' || $ext === 'curl' ? ' (некритично)' : '') . '</span>')];
}
try {
    db()->query('SELECT 1');
    $ver = (string)val('SELECT VERSION()');
    $rows[] = ['MySQL/MariaDB', badge(true) . ' <span class="mono">' . h($ver) . '</span>'];
} catch (Throwable $e) { $rows[] = ['MySQL/MariaDB', badge(false) . ' <span class="mono">' . h($e->getMessage()) . '</span>']; echo_diag($rows, $note, $css, $u); exit; }

$expectedTables = ['users','login_tokens','clans','cards','owned_cards','clan_messages','global_messages','friends','card_requests','request_donations','battles','pvp_matches','chests','leagues','arenas','tournaments','tournament_players','cosmetic_items','announcements','settings','audit_logs','daily_quests','mail_messages','badges','clan_invites'];
try {
    // SHOW TABLES возвращает колонку с именем вида Tables_in_<db> — читаем первую колонку явно
    $raw = q('SHOW TABLES')->fetchAll(PDO::FETCH_NUM);
    $have = array_map(fn($r) => (string)$r[0], $raw);
} catch (Throwable $e) { $have = []; }
$missing = array_values(array_diff($expectedTables, $have));
$rows[] = ['Таблицы БД (' . count($have) . '/' . count($expectedTables) . ')', badge(!$missing) . ($missing ? ' нет: <span class="mono">' . h(implode(', ', $missing)) . '</span>' : ' все на месте')];

$expectedCols = ['id','username','email','password_hash','role','banned','gold','gems','trophies','wins','losses','xp','clan_id','last_gift_at','deck','battle_started_at','battle_mode','last_request_at','tournament_wins','tournament_claims','league_season','league_chest_season','pvp_opponent_id','last_pvp_at','banner_skin','equipped_emotes','wildcards','evolution_fragments','cosmetics','tower_skin','tag','max_trophies','season_trophies','clan_role','tutorial_done','badges','favorite_card','last_season','best_season','created_at'];
try {
    $cols = array_column(rows('SHOW COLUMNS FROM users'), 'Field');
    $missCols = array_values(array_diff($expectedCols, $cols));
    $rows[] = ['Колонки users (' . count($cols) . '/' . count($expectedCols) . ')', badge(!$missCols) . ($missCols ? ' нет: <span class="mono">' . h(implode(', ', $missCols)) . '</span> (обновитесь: откройте любую страницу игры — миграции добавят их сами, либо переустановите)' : ' все на месте')];
} catch (Throwable $e) { $rows[] = ['Колонки users', badge(false) . ' <span class="mono">' . h($e->getMessage()) . '</span>']; }

foreach ([['data/', ROOT . '/data'], ['uploads/', ROOT . '/uploads']] as [$label, $dir]) {
    $ok = is_dir($dir) && is_writable($dir);
    $rows[] = ["Папка $label", badge($ok) . ($ok ? ' запись разрешена' : ' <span class="warn">PHP не может писать — дайте права 775/777 или владельца www-data</span>')];
}
$sp = session_save_path() ?: sys_get_temp_dir();
$rows[] = ['Сессии', badge(is_writable($sp) || is_writable(ROOT . '/data')) . ' <span class="mono">' . h($sp) . '</span>'];
try {
    $locks = rows("SELECT id,username,battle_started_at,TIMESTAMPDIFF(SECOND,battle_started_at,UTC_TIMESTAMP()) AS age FROM users WHERE battle_started_at IS NOT NULL ORDER BY battle_started_at DESC LIMIT 20");
    $txt = $locks ? '<br>' . implode('<br>', array_map(fn($l) => '<span class="mono">#' . (int)$l['id'] . ' ' . h($l['username']) . ' — ' . h((string)$l['battle_started_at']) . ' UTC (' . (int)$l['age'] . ' сек назад)</span>', $locks)) : 'зависших боёв нет';
    $rows[] = ['Активные бои (' . count($locks) . ')', badge(true) . $txt];
    $me = row('SELECT battle_started_at FROM users WHERE id=?', [$uid]);
    if ($me && $me['battle_started_at']) $rows[] = ['Ваш бой', '<span class="warn">у вас висит незавершённый бой с ' . h((string)$me['battle_started_at']) . ' UTC</span> <a class="btn" href="diag.php?op=reset_my_battle">Сбросить мой бой</a>'];
} catch (Throwable $e) { $rows[] = ['Активные бои', badge(false) . ' <span class="mono">' . h($e->getMessage()) . '</span>']; }
try {
    $rows[] = ['Настройки', '<span class="mono">cards_version=' . h((string)(setting('cards_version', '?'))) . ' · league_season=' . h((string)(setting('league_season', '?'))) . ' · battle_seconds=' . h((string)(setting('battle_seconds', '?'))) . '</span>'];
    $rows[] = ['Каталог', badge(is_file(ROOT . '/data/catalog.json')) . ' <span class="mono">data/catalog.json</span>'];
} catch (Throwable $e) { $rows[] = ['Настройки', badge(false)]; }

function echo_diag(array $rows, string $note, string $css, array $u): void {
    echo "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Crownfall · диагностика</title><style>$css</style></head><body>";
    echo '<h1>Crownfall · диагностика</h1><p class="sub">Вы вошли как <b>' . h($u['username']) . '</b> (админ). Если бой не начинается — ищите красные строки ниже.</p>';
    if ($note !== '') echo '<p class="sub">➜ ' . h($note) . '</p>';
    echo '<table>';
    foreach ($rows as [$k, $v]) echo '<tr><td class="k">' . h($k) . '</td><td>' . $v . '</td></tr>';
    echo '</table><p class="sub">Действия: <a href="diag.php?op=reset_stuck_all" onclick="return confirm(\'Сбросить ВСЕ зависшие бои? Игроки смогут играть заново.\')">сбросить все зависшие бои</a> · <a href="index.php">в игру</a></p></body></html>';
}
echo_diag($rows, $note, $css, $u);
