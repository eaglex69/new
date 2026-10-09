<?php
declare(strict_types=1);

// Профили игроков: основная информация, значки, статистика Royale, лиги и приглашения в клан.

/** Каталог значков. Условие получения считает функцию по статистике игрока. */
const BADGE_DEFS = [
    ['key' => 'first_win', 'name' => 'Первая кровь', 'descr' => 'Победите в первом бою', 'icon' => 'swords', 'color' => 'red', 'order' => 10],
    ['key' => 'wins_10', 'name' => 'Боец', 'descr' => '10 побед на арене', 'icon' => 'swords', 'color' => 'orange', 'order' => 20],
    ['key' => 'wins_50', 'name' => 'Ветеран', 'descr' => '50 побед на арене', 'icon' => 'swords', 'color' => 'green', 'order' => 30],
    ['key' => 'wins_100', 'name' => 'Герой арены', 'descr' => '100 побед на арене', 'icon' => 'swords', 'color' => 'blue', 'order' => 40],
    ['key' => 'wins_500', 'name' => 'Легенда арены', 'descr' => '500 побед на арене', 'icon' => 'crown', 'color' => 'gold', 'order' => 50],
    ['key' => 'crown3_1', 'name' => 'Три короны', 'descr' => 'Победа с тремя коронами', 'icon' => 'crown', 'color' => 'blue', 'order' => 60],
    ['key' => 'crown3_25', 'name' => 'Мастер трёх корон', 'descr' => '25 побед с тремя коронами', 'icon' => 'crown', 'color' => 'gold', 'order' => 70],
    ['key' => 'trophies_500', 'name' => 'Заклинатель кубков', 'descr' => '500 трофеев', 'icon' => 'trophy', 'color' => 'bronze', 'order' => 80],
    ['key' => 'trophies_1500', 'name' => 'Чемпион арены', 'descr' => '1500 трофеев', 'icon' => 'trophy', 'color' => 'silver', 'order' => 90],
    ['key' => 'trophies_3000', 'name' => 'Король трофеев', 'descr' => '3000 трофеев', 'icon' => 'crown', 'color' => 'gold', 'order' => 100],
    ['key' => 'record_1000', 'name' => 'Личный рекорд', 'descr' => '1000 трофеев максимума', 'icon' => 'trophy', 'color' => 'magic', 'order' => 110],
    ['key' => 'cards_20', 'name' => 'Коллекционер', 'descr' => 'Найдите 20 карт', 'icon' => 'cards', 'color' => 'orange', 'order' => 120],
    ['key' => 'cards_60', 'name' => 'Собиратель', 'descr' => 'Найдите 60 карт', 'icon' => 'cards', 'color' => 'blue', 'order' => 130],
    ['key' => 'cards_all', 'name' => 'Полная коллекция', 'descr' => 'Найдите все карты игры', 'icon' => 'crown', 'color' => 'gold', 'order' => 140],
    ['key' => 'donate_1', 'name' => 'Щедрый', 'descr' => 'Подарите карту другу', 'icon' => 'friends', 'color' => 'green', 'order' => 150],
    ['key' => 'donate_25', 'name' => 'Друг клана', 'descr' => '25 пожертвований карт', 'icon' => 'friends', 'color' => 'blue', 'order' => 160],
    ['key' => 'chest_1', 'name' => 'Первая добыча', 'descr' => 'Откройте сундук', 'icon' => 'chest', 'color' => 'brown', 'order' => 170],
    ['key' => 'chest_25', 'name' => 'Охотник за сундуками', 'descr' => 'Откройте 25 сундуков', 'icon' => 'chest', 'color' => 'orange', 'order' => 180],
    ['key' => 'quest_1', 'name' => 'Прилежный', 'descr' => 'Выполните ежедневный квест', 'icon' => 'scroll', 'color' => 'green', 'order' => 190],
    ['key' => 'quest_20', 'name' => 'Мастер квестов', 'descr' => 'Выполните 20 квестов', 'icon' => 'scroll', 'color' => 'blue', 'order' => 200],
    ['key' => 'clan_member', 'name' => 'Свой в доску', 'descr' => 'Вступите в клан', 'icon' => 'shield', 'color' => 'blue', 'order' => 210],
    ['key' => 'clan_leader', 'name' => 'Глава клана', 'descr' => 'Создайте собственный клан', 'icon' => 'crown', 'color' => 'gold', 'order' => 220],
    ['key' => 'level_5', 'name' => 'Опытный', 'descr' => 'Достигните 5 уровня', 'icon' => 'star', 'color' => 'green', 'order' => 230],
    ['key' => 'level_10', 'name' => 'Мудрец арены', 'descr' => 'Достигните 10 уровня', 'icon' => 'star', 'color' => 'magic', 'order' => 240],
    ['key' => 'friend_1', 'name' => 'Не одинок', 'descr' => 'Добавьте друга', 'icon' => 'friends', 'color' => 'pink', 'order' => 250],
    ['key' => 'tournament_1', 'name' => 'Боец турнира', 'descr' => 'Победа в турнире', 'icon' => 'trophy', 'color' => 'gold', 'order' => 260],
];

/** Создаёт недостающие поля и таблицы профиля в уже установленной базе. */
function profile_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $cols = array_column(rows("SHOW COLUMNS FROM users"), 'Field');
    // Полный список колонок из schema.sql: база, созданная старой версией игры,
    // сама подтягивается до актуальной структуры (иначе бой и другие действия падают с 500).
    $add = [
        'role' => "ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'player'",
        'banned' => 'ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0',
        'gold' => 'ALTER TABLE users ADD COLUMN gold INT NOT NULL DEFAULT 2500',
        'gems' => 'ALTER TABLE users ADD COLUMN gems INT NOT NULL DEFAULT 120',
        'trophies' => 'ALTER TABLE users ADD COLUMN trophies INT NOT NULL DEFAULT 120',
        'wins' => 'ALTER TABLE users ADD COLUMN wins INT NOT NULL DEFAULT 0',
        'losses' => 'ALTER TABLE users ADD COLUMN losses INT NOT NULL DEFAULT 0',
        'xp' => 'ALTER TABLE users ADD COLUMN xp INT NOT NULL DEFAULT 0',
        'clan_id' => 'ALTER TABLE users ADD COLUMN clan_id INT NULL',
        'last_gift_at' => 'ALTER TABLE users ADD COLUMN last_gift_at DATETIME NULL',
        'deck' => 'ALTER TABLE users ADD COLUMN deck TEXT NOT NULL',
        'battle_started_at' => 'ALTER TABLE users ADD COLUMN battle_started_at DATETIME NULL',
        'battle_mode' => "ALTER TABLE users ADD COLUMN battle_mode VARCHAR(16) NOT NULL DEFAULT 'ladder'",
        'last_request_at' => 'ALTER TABLE users ADD COLUMN last_request_at DATETIME NULL',
        'tournament_wins' => 'ALTER TABLE users ADD COLUMN tournament_wins INT NOT NULL DEFAULT 0',
        'tournament_claims' => 'ALTER TABLE users ADD COLUMN tournament_claims INT NOT NULL DEFAULT 0',
        'league_season' => "ALTER TABLE users ADD COLUMN league_season VARCHAR(10) NOT NULL DEFAULT ''",
        'league_chest_season' => "ALTER TABLE users ADD COLUMN league_chest_season VARCHAR(10) NOT NULL DEFAULT ''",
        'pvp_opponent_id' => 'ALTER TABLE users ADD COLUMN pvp_opponent_id INT NULL',
        'last_pvp_at' => 'ALTER TABLE users ADD COLUMN last_pvp_at DATETIME NULL',
        'banner_skin' => "ALTER TABLE users ADD COLUMN banner_skin VARCHAR(60) NOT NULL DEFAULT ''",
        'equipped_emotes' => 'ALTER TABLE users ADD COLUMN equipped_emotes TEXT NOT NULL',
        'wildcards' => 'ALTER TABLE users ADD COLUMN wildcards TEXT NOT NULL',
        'evolution_fragments' => 'ALTER TABLE users ADD COLUMN evolution_fragments INT NOT NULL DEFAULT 0',
        'cosmetics' => 'ALTER TABLE users ADD COLUMN cosmetics TEXT NOT NULL',
        'tower_skin' => "ALTER TABLE users ADD COLUMN tower_skin VARCHAR(60) NOT NULL DEFAULT 'classic'",
        'tag' => "ALTER TABLE users ADD COLUMN tag VARCHAR(12) NOT NULL DEFAULT ''",
        'max_trophies' => 'ALTER TABLE users ADD COLUMN max_trophies INT NOT NULL DEFAULT 0',
        'season_trophies' => 'ALTER TABLE users ADD COLUMN season_trophies INT NOT NULL DEFAULT 0',
        'clan_role' => "ALTER TABLE users ADD COLUMN clan_role VARCHAR(16) NOT NULL DEFAULT 'member'",
        'tutorial_done' => 'ALTER TABLE users ADD COLUMN tutorial_done TINYINT(1) NOT NULL DEFAULT 0',
        'badges' => "ALTER TABLE users ADD COLUMN badges TEXT NOT NULL DEFAULT ''",
        'favorite_card' => 'ALTER TABLE users ADD COLUMN favorite_card INT NOT NULL DEFAULT 0',
        'last_season' => "ALTER TABLE users ADD COLUMN last_season TEXT NOT NULL DEFAULT ''",
        'best_season' => "ALTER TABLE users ADD COLUMN best_season TEXT NOT NULL DEFAULT ''",
    ];
    foreach ($add as $c => $sql) if (!in_array($c, $cols, true)) db()->exec($sql);
    db()->exec("CREATE TABLE IF NOT EXISTS badges (
        id INT AUTO_INCREMENT PRIMARY KEY, bkey VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL,
        descr VARCHAR(180) NOT NULL DEFAULT '', icon VARCHAR(24) NOT NULL DEFAULT 'star',
        color VARCHAR(24) NOT NULL DEFAULT 'blue', sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    db()->exec("CREATE TABLE IF NOT EXISTS clan_invites (
        id INT AUTO_INCREMENT PRIMARY KEY, clan_id INT NOT NULL, user_id INT NOT NULL, inviter_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_invite (clan_id, user_id),
        CONSTRAINT fk_ci_clan FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
        CONSTRAINT fk_ci_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_ci_inv FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $st = db()->prepare('INSERT IGNORE INTO badges(bkey,name,descr,icon,color,sort_order) VALUES(?,?,?,?,?,?)');
    foreach (BADGE_DEFS as $b) $st->execute([$b['key'], $b['name'], $b['descr'], $b['icon'], $b['color'], $b['order']]);
    db()->exec("UPDATE users SET clan_role='leader' WHERE clan_id IS NOT NULL AND clan_role='member' AND id IN (SELECT owner_id FROM (SELECT owner_id FROM clans) AS c)");
    // тег для всех, у кого его ещё нет
    $noTag = rows('SELECT id FROM users WHERE tag=\'\' OR tag IS NULL');
    foreach ($noTag as $r) run('UPDATE users SET tag=? WHERE id=?', [gen_tag((int)$r['id']), (int)$r['id']]);
}

function gen_tag(int $id): string {
    $alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $n = $id * 2654435761 + 12345;
    $t = '';
    for ($i = 0; $i < 6; $i++) { $t .= $alphabet[$n % 34]; $n = (int)($n / 34) + 7; }
    return '#' . $t;
}

function badge_catalog(): array {
    static $c = null;
    if ($c === null) $c = rows('SELECT * FROM badges ORDER BY sort_order, id');
    return $c;
}

function level_of(int $xp): int { return max(1, (int)floor($xp / 500) + 1); }

/** Статистика игрока для профиля и значков. */
function player_stats(int $uid): array {
    $u = row('SELECT * FROM users WHERE id=?', [$uid]);
    if (!$u) return [];
    $crowns3 = (int)val("SELECT COUNT(*) FROM battles WHERE user_id=? AND result='win' AND crowns>=3", [$uid]);
    $cardsFound = (int)val('SELECT COUNT(*) FROM owned_cards WHERE user_id=?', [$uid]);
    $donated = (int)val('SELECT COALESCE(SUM(amount),0) FROM request_donations WHERE donor_id=?', [$uid]);
    $chests = (int)val('SELECT COUNT(*) FROM chests WHERE user_id=? AND opened_at IS NOT NULL', [$uid]);
    $quests = (int)val('SELECT COUNT(*) FROM daily_quests WHERE user_id=? AND claimed=1', [$uid]);
    $friends = (int)val("SELECT COUNT(*) FROM friends WHERE (requester_id=? OR recipient_id=?) AND status='accepted'", [$uid, $uid]);
    $maxTrophies = max((int)$u['trophies'], (int)$u['max_trophies'], (int)$u['season_trophies']);
    return [
        'wins' => (int)$u['wins'], 'losses' => (int)$u['losses'], 'trophies' => (int)$u['trophies'],
        'maxTrophies' => $maxTrophies, 'crowns3' => $crowns3, 'cardsFound' => $cardsFound,
        'cardsDonated' => $donated, 'chestsOpened' => $chests, 'questsClaimed' => $quests,
        'friends' => $friends, 'level' => level_of((int)$u['xp']), 'tournamentWins' => (int)$u['tournament_wins'],
        'inClan' => (int)$u['clan_id'] > 0, 'clanLeader' => (int)$u['clan_role'] === 0 ? false : $u['clan_role'] === 'leader',
        'isClanOwner' => (int)val('SELECT COUNT(*) FROM clans WHERE owner_id=?', [$uid]) > 0,
        'tutorialDone' => (bool)$u['tutorial_done'],
    ];
}

function badges_earned(array $st): array {
    $all = [];
    foreach (BADGE_DEFS as $b) {
        $k = $b['key'];
        $ok = match ($k) {
            'first_win' => $st['wins'] >= 1, 'wins_10' => $st['wins'] >= 10, 'wins_50' => $st['wins'] >= 50,
            'wins_100' => $st['wins'] >= 100, 'wins_500' => $st['wins'] >= 500,
            'crown3_1' => $st['crowns3'] >= 1, 'crown3_25' => $st['crowns3'] >= 25,
            'trophies_500' => $st['maxTrophies'] >= 500, 'trophies_1500' => $st['maxTrophies'] >= 1500, 'trophies_3000' => $st['maxTrophies'] >= 3000,
            'record_1000' => $st['maxTrophies'] >= 1000,
            'cards_20' => $st['cardsFound'] >= 20, 'cards_60' => $st['cardsFound'] >= 60, 'cards_all' => $st['cardsFound'] >= 122,
            'donate_1' => $st['cardsDonated'] >= 1, 'donate_25' => $st['cardsDonated'] >= 25,
            'chest_1' => $st['chestsOpened'] >= 1, 'chest_25' => $st['chestsOpened'] >= 25,
            'quest_1' => $st['questsClaimed'] >= 1, 'quest_20' => $st['questsClaimed'] >= 20,
            'clan_member' => $st['inClan'], 'clan_leader' => $st['isClanOwner'],
            'level_5' => $st['level'] >= 5, 'level_10' => $st['level'] >= 10,
            'friend_1' => $st['friends'] >= 1, 'tournament_1' => $st['tournamentWins'] >= 1,
            default => false,
        };
        if ($ok) $all[] = $k;
    }
    return $all;
}

function jarr(?string $j): array { $v = json_decode((string)$j, true); return is_array($v) ? $v : []; }
function jobj(?string $j): ?array { $v = json_decode((string)$j, true); return is_array($v) ? $v : null; }

function equipped_badges(array $u, array $earned): array {
    $sel = array_values(array_filter(array_map('strval', jarr($u['badges'] ?? '')), fn($k) => in_array($k, $earned, true)));
    $sel = array_slice(array_unique($sel), 0, 8);
    $cat = [];
    foreach (badge_catalog() as $b) $cat[$b['bkey']] = $b;
    return array_map(fn($k) => $cat[$k] ?? null, $sel);
}

function save_badges(int $uid, array $keys): void {
    profile_migrate();
    $st = player_stats($uid);
    $earned = badges_earned($st);
    $keys = array_values(array_unique(array_filter(array_map('strval', $keys), fn($k) => in_array($k, $earned, true))));
    if (count($keys) > 8) fail('Можно выбрать не более 8 значков.');
    run('UPDATE users SET badges=? WHERE id=?', [json_encode(array_slice($keys, 0, 8), JSON_UNESCAPED_UNICODE), $uid]);
    ok('Значки обновлены.');
}

function save_favorite_card(int $uid, int $cardId): void {
    profile_migrate();
    $ok = row('SELECT c.id FROM cards c JOIN owned_cards o ON o.card_id=c.id WHERE c.id=? AND o.user_id=?', [$cardId, $uid]);
    if (!$ok) fail('Можно выбрать только карту из вашей коллекции.');
    run('UPDATE users SET favorite_card=? WHERE id=?', [$cardId, $uid]);
    ok('Любимая карта обновлена.');
}

function legendary_threshold(): int {
    $v = val("SELECT MIN(min_trophies) FROM leagues WHERE color IN ('legendary','champion')");
    return (int)($v ?: 2500);
}

function world_place(int $uid): ?int {
    $t = (int)val('SELECT trophies FROM users WHERE id=?', [$uid]);
    if ($t <= 0) return null;
    return 1 + (int)val('SELECT COUNT(*) FROM users WHERE banned=0 AND trophies>?', [$t]);
}

/** Полный профиль игрока. */
function profile_of(int $uid, ?int $viewerId): array {
    profile_migrate();
    $u = row('SELECT * FROM users WHERE id=?', [$uid]);
    if (!$u) fail('Игрок не найден.', 404);
    if ($u['banned'] && (int)$viewerId !== $uid) fail('Профиль недоступен.', 403);
    if ($u['tag'] === '' || $u['tag'] === null) { $tag = gen_tag($uid); run('UPDATE users SET tag=? WHERE id=?', [$tag, $uid]); $u['tag'] = $tag; }

    $st = player_stats($uid);
    $earned = badges_earned($st);
    $arenas = rows('SELECT * FROM arenas ORDER BY min_trophies');
    $leaguesRaw = rows('SELECT * FROM leagues ORDER BY sort_order, min_trophies');
    $arena = arena_for($arenas, (int)$u['trophies']);
    $lg = league_for($leaguesRaw, (int)$u['trophies']);

    $clan = null;
    if ($u['clan_id']) {
        $c = row('SELECT * FROM clans WHERE id=?', [$u['clan_id']]);
        if ($c) {
            $clan = clan_view($c);
            $clan['role'] = (int)$c['owner_id'] === $uid ? 'leader' : (string)$u['clan_role'];
            $clan['roleLabel'] = clan_rank_label($clan['role']);
        }
    }

    $deckIds = array_values(array_filter(array_map('intval', explode(',', (string)$u['deck']))));
    $deckCards = [];
    if ($deckIds) {
        $ids = in_ph($deckIds);
        foreach (rows("SELECT id,name,cost,rarity,image FROM cards WHERE id IN ($ids)", $deckIds) as $c) $deckCards[(int)$c['id']] = camel($c);
    }
    $deck = array_values(array_filter(array_map(fn($i) => $deckCards[$i] ?? null, $deckIds)));

    $fav = null;
    if ((int)$u['favorite_card'] > 0) {
        $fc = row('SELECT id,name,rarity,image FROM cards WHERE id=?', [(int)$u['favorite_card']]);
        if ($fc) $fav = camel($fc);
    }

    $inLeagues = $st['maxTrophies'] >= legendary_threshold();
    $season = null;
    if ($inLeagues) {
        $season = [
            'current' => ['season' => setting('league_season') ?: gmdate('Y-m'), 'trophies' => max((int)$u['trophies'], (int)$u['season_trophies']), 'place' => world_place($uid)],
            'previous' => jobj($u['last_season']),
            'best' => jobj($u['best_season']),
        ];
    }

    $canInvite = false;
    if ($viewerId && $viewerId !== $uid && !$u['clan_id'] && $u['tutorial_done']) {
        $me = row('SELECT clan_id, clan_role FROM users WHERE id=?', [$viewerId]);
        if ($me && $me['clan_id'] && clan_can_invite((string)$me['clan_role'])) $canInvite = true;
    }

    $duel = ($viewerId && (int)$viewerId !== $uid) ? duel_view((int)$viewerId, $uid) : null;
    $canDuel = (bool)($viewerId && (int)$viewerId !== $uid && !$u['banned'] && $u['tutorial_done']);

    $cat = badge_catalog();
    $all = array_map(fn($b) => [
        'key' => $b['bkey'], 'name' => $b['name'], 'descr' => $b['descr'],
        'icon' => $b['icon'], 'color' => $b['color'], 'earned' => in_array($b['bkey'], $earned, true),
    ], $cat);

    return [
        'id' => $uid, 'username' => $u['username'], 'tag' => $u['tag'],
        'level' => $st['level'], 'xp' => (int)$u['xp'],
        'trophies' => (int)$u['trophies'], 'maxTrophies' => $st['maxTrophies'],
        'wins' => (int)$u['wins'], 'losses' => (int)$u['losses'],
        'arena' => $arena ? ['name' => $arena['name'], 'difficulty' => (int)$arena['difficulty'], 'description' => $arena['description']] : null,
        'league' => $lg ? ['name' => $lg['name'], 'color' => $lg['color'], 'minTrophies' => (int)$lg['min_trophies']] : null,
        'clan' => $clan, 'deck' => $deck, 'favoriteCard' => $fav,
        'badges' => array_values(array_filter(equipped_badges($u, $earned), fn($b) => $b !== null)),
        'badgesAll' => $all, 'badgesEarnedCount' => count($earned),
        'stats' => $st, 'season' => $season, 'inLeagues' => $inLeagues,
        'canInvite' => $canInvite, 'isMe' => (int)$viewerId === $uid,
        'duel' => $duel, 'canDuel' => $canDuel,
        'clanRoles' => CLAN_RANKS, 'canInviteRole' => $viewerId ? clan_can_invite(row('SELECT clan_role FROM users WHERE id=?', [(int)$viewerId])['clan_role'] ?? '') : false,
        'tutorialDone' => (bool)$u['tutorial_done'],
        'bannerSkin' => $u['banner_skin'] ?: null, 'towerSkin' => $u['tower_skin'] ?: null,
    ];
}

// ---------- приглашения в клан ----------
function clan_invite(int $inviterId, int $targetId): void {
    profile_migrate();
    if ($inviterId === $targetId) fail('Нельзя пригласить самого себя.');
    $me = row('SELECT clan_id, clan_role FROM users WHERE id=?', [$inviterId]);
    if (!$me || !$me['clan_id']) fail('Вы не состоите в клане.');
    if (!clan_can_invite((string)$me['clan_role'])) fail('Приглашать может только старейшина или глава. Новичкам и бойцам это недоступно.');
    $clan = row('SELECT * FROM clans WHERE id=?', [(int)$me['clan_id']]);
    if (!$clan) fail('Клан не найден.');
    $t = row('SELECT id,username,clan_id,tutorial_done,banned FROM users WHERE id=?', [$targetId]);
    if (!$t || $t['banned']) fail('Игрок не найден.');
    if ($t['clan_id']) fail('Игрок уже состоит в клане.');
    if (!$t['tutorial_done']) fail('Игрок ещё не завершил обучение.');
    if ((int)val('SELECT COUNT(*) FROM users WHERE clan_id=?', [(int)$clan['id']]) >= 50) fail('В клане уже максимум участников.');
    if (run('INSERT IGNORE INTO clan_invites(clan_id,user_id,inviter_id) VALUES(?,?,?)', [(int)$clan['id'], $targetId, $inviterId])) {
        send_mail($targetId, 'Приглашение в клан', "Вас приглашают в клан «{$clan['name']}». Принять приглашение можно в разделе «Клан».", 0, 0);
        ok("Приглашение отправлено игроку {$t['username']}.");
    } else fail('Приглашение уже отправлено.');
}

function clan_invites_for(int $uid): array {
    return camel_all(rows('SELECT i.id,i.clan_id,c.name AS clan_name,u.username AS inviter FROM clan_invites i JOIN clans c ON c.id=i.clan_id JOIN users u ON u.id=i.inviter_id WHERE i.user_id=? ORDER BY i.id DESC', [$uid]));
}

function clan_invite_answer(int $uid, int $inviteId, bool $accept): void {
    $r = row('SELECT * FROM clan_invites WHERE id=? AND user_id=?', [$inviteId, $uid]);
    if (!$r) fail('Приглашение не найдено.');
    if ($accept) {
        $me = row('SELECT clan_id FROM users WHERE id=?', [$uid]);
        if ($me['clan_id']) fail('Вы уже состоите в клане.');
        if ((int)val('SELECT COUNT(*) FROM users WHERE clan_id=?', [(int)$r['clan_id']]) >= 50) fail('В клане нет мест.');
        run("UPDATE users SET clan_id=?, clan_role='newbie' WHERE id=?", [(int)$r['clan_id'], $uid]);
        clan_xp_add((int)$r['clan_id'], 50);
        ok('Вы вступили в клан! Звание: новичок.');
    } else ok('Приглашение отклонено.');
    run('DELETE FROM clan_invites WHERE id=? AND user_id=?', [$inviteId, $uid]);
}

// clan_set_rank перенесён в lib/clans.php (поддержка званий: новичок/боец/старейшина).
