<?php
declare(strict_types=1);

// Кланы: уровни и опыт, типы (открытый/закрытый), звания, эмблемы.
// Дуэли между игроками и почта из профиля.

const CLAN_EMBLEMS = ['blue', 'red', 'purple', 'green', 'gold', 'orange', 'teal', 'black'];
const CLAN_TYPES = ['open' => 'Открытый', 'closed' => 'Закрытый'];
const CLAN_RANKS = ['newbie' => 'Новичок', 'member' => 'Боец', 'elder' => 'Старейшина', 'leader' => 'Глава'];
/** Кто может приглашать в клан и редактировать его. */
const CLAN_RANK_CAN_INVITE = ['elder', 'leader'];
const CLAN_MAX_LEVEL = 20;

/** Колонки и таблицы, которых может не хватать в старой базе. */
function clan_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $cols = array_column(rows('SHOW COLUMNS FROM clans'), 'Field');
    $add = [
        'xp' => 'ALTER TABLE clans ADD COLUMN xp INT NOT NULL DEFAULT 0',
        'level' => 'ALTER TABLE clans ADD COLUMN level INT NOT NULL DEFAULT 1',
        'type' => "ALTER TABLE clans ADD COLUMN type VARCHAR(12) NOT NULL DEFAULT 'open'",
        'emblem' => "ALTER TABLE clans ADD COLUMN emblem VARCHAR(6) NOT NULL DEFAULT ''",
    ];
    foreach ($add as $c => $sql) if (!in_array($c, $cols, true)) db()->exec($sql);
    db()->exec("CREATE TABLE IF NOT EXISTS duel_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenger_id INT NOT NULL,
        opponent_id INT NOT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_duel_pair (challenger_id, opponent_id),
        CONSTRAINT fk_du_c FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_du_o FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $mc = array_column(rows('SHOW COLUMNS FROM mail_messages'), 'Field');
    if (!in_array('sender_id', $mc, true)) db()->exec('ALTER TABLE mail_messages ADD COLUMN sender_id INT NULL');
    // Бывшие «участники» без званий получают базовое звание, главы — статус лидера.
    run("UPDATE users SET clan_role='member' WHERE clan_role NOT IN ('newbie','member','elder','leader') AND clan_id IS NOT NULL");
}

function clan_rank_label(string $r): string { return CLAN_RANKS[$r] ?? 'Участник'; }
function clan_can_invite(string $r): bool { return in_array($r, CLAN_RANK_CAN_INVITE, true); }
function clan_type_label(string $t): string { return CLAN_TYPES[$t] ?? 'Открытый'; }

/** Уровень клана: 1 при 0 опыта, дальше квадратичная шкала до 20 уровня. */
function clan_level(int $xp): int { return min(CLAN_MAX_LEVEL, (int)sqrt(max(0, $xp) / 100) + 1); }
/** Опыт, нужный для перехода на следующий уровень. */
function clan_xp_need(int $level): int { return min(CLAN_MAX_LEVEL, $level) * min(CLAN_MAX_LEVEL, $level) * 100; }

/** Начисляет опыт клану. Возвращает true, если клан повысил уровень. */
function clan_xp_add(int $clanId, int $xp): bool {
    if ($clanId <= 0 || $xp <= 0) return false;
    $c = row('SELECT xp,level FROM clans WHERE id=?', [$clanId]);
    if (!$c) return false;
    $xp += (int)$c['xp'];
    $lv = clan_level($xp);
    run('UPDATE clans SET xp=?, level=? WHERE id=?', [$xp, $lv, $clanId]);
    if ($lv > (int)$c['level']) {
        // Сообщаем участникам о новом уровне — письмом без награды.
        foreach (rows('SELECT id FROM users WHERE clan_id=? LIMIT 50', [$clanId]) as $m) {
            send_mail((int)$m['id'], 'Клан поднял уровень!', "Ваш клан достиг {$lv} уровня. Продолжайте побеждать, чтобы расти дальше.", 0, 0);
        }
        return true;
    }
    return false;
}

/** Полные данные клана для клиентa. */
function clan_view(?array $c): ?array {
    if (!$c) return null;
    $xp = (int)($c['xp'] ?? 0);
    $level = isset($c['level']) ? (int)$c['level'] : clan_level($xp);
    $need = clan_xp_need($level);
    $prev = clan_xp_need($level - 1);
    $glyph = (string)($c['emblem'] ?? '');
    if ($glyph === '') $glyph = mb_substr((string)($c['name'] ?? 'C'), 0, 1, 'UTF-8');
    return [
        'id' => (int)$c['id'], 'name' => $c['name'], 'description' => $c['description'] ?? '',
        'badge' => $c['badge'] ?? 'blue', 'ownerId' => (int)($c['owner_id'] ?? 0),
        'type' => $c['type'] ?? 'open', 'xp' => $xp, 'level' => $level,
        'xpNeed' => $need, 'xpPrev' => $prev,
        'xpPct' => $need > $prev ? (int)round(($xp - $prev) / max(1, $need - $prev) * 100) : 100,
        'emblem' => $glyph,
        'members' => (int)val('SELECT COUNT(*) FROM users WHERE clan_id=?', [(int)$c['id']]),
    ];
}

/** Права текущего игрока в клане: редактирование, приглашения, звания. */
function clan_perms(int $uid): array {
    $u = row('SELECT clan_id,clan_role FROM users WHERE id=?', [$uid]);
    $role = $u && $u['clan_id'] ? (string)$u['clan_role'] : '';
    return [
        'clanId' => $u ? (int)$u['clan_id'] : 0,
        'role' => $role,
        'isLeader' => $role === 'leader',
        'canInvite' => clan_can_invite($role),
        'canEdit' => clan_can_invite($role),
        'canRanks' => in_array($role, ['leader', 'elder'], true),
    ];
}

/** Настройки клана: эмблема (цвет + глиф), тип, описание. Доступно старейшинам и главе. */
function clan_update(int $uid, array $b): void {
    clan_migrate();
    $p = clan_perms($uid);
    if (!$p['clanId']) fail('Вы не состоите в клане.');
    if (!$p['canEdit']) fail('Редактировать клан может только глава или старейшина.');
    $set = [];
    $detail = [];
    if (isset($b['badge']) || isset($b['emblem']) || isset($b['type']) || isset($b['description'])) {
        if (isset($b['badge'])) {
            $badge = s($b, 'badge', 16);
            if (!in_array($badge, CLAN_EMBLEMS, true)) fail('Неизвестная эмблема.');
            $set['badge'] = $badge; $detail[] = 'эмблема ' . $badge;
        }
        if (isset($b['emblem'])) {
            $glyph = s($b, 'emblem', 6);
            if (mb_strlen($glyph) > 4) fail('Глиф эмблемы: до 4 символов.');
            $set['emblem'] = $glyph; $detail[] = 'символ «' . $glyph . '»';
        }
        if (isset($b['type'])) {
            $type = s($b, 'type', 12);
            if (!isset(CLAN_TYPES[$type])) fail('Тип клана: открытый или закрытый.');
            if (!$p['isLeader']) fail('Тип клана меняет только глава.');
            $set['type'] = $type; $detail[] = 'тип: ' . clan_type_label($type);
        }
        if (isset($b['description'])) {
            $set['description'] = s($b, 'description', 180);
            $detail[] = 'описание обновлено';
        }
    }
    if (!$set) fail('Не указано, что изменить.');
    $cols = array_keys($set);
    $sql = 'UPDATE clans SET ' . implode(',', array_map(fn($c) => "$c=?", $cols)) . ' WHERE id=?';
    run($sql, [...array_values($set), $p['clanId']]);
    ok('Клан обновлён: ' . implode(', ', $detail) . '.');
}

/** Вступить в открытый клан (закрытый — только по приглашению). */
function clan_join_allowed(int $uid, int $clanId): void {
    clan_migrate();
    $c = row('SELECT * FROM clans WHERE id=?', [$clanId]);
    if (!$c) fail('Клан не найден.');
    if (($c['type'] ?? 'open') === 'closed') {
        $inv = row('SELECT id FROM clan_invites WHERE clan_id=? AND user_id=?', [$clanId, $uid]);
        if (!$inv) fail('Этот клан закрытый — вступить можно только по приглашению от старейшины или главы.');
    }
}

/** Смена звания. Глава меняет любые, старейшина — только новичков и бойцов. */
function clan_set_rank(int $uid, int $targetId, string $rank): void {
    clan_migrate();
    if (!isset(CLAN_RANKS[$rank]) || $rank === 'leader') fail('Неизвестное звание.');
    $me = row('SELECT clan_id, clan_role FROM users WHERE id=?', [$uid]);
    if (!$me || !$me['clan_id'] || !in_array((string)$me['clan_role'], CLAN_RANK_CAN_INVITE, true)) {
        fail('Звания выдаёт глава или старейшина.');
    }
    if ($targetId === $uid) fail('Нельзя изменить своё звание.');
    $t = row('SELECT clan_id, clan_role FROM users WHERE id=?', [$targetId]);
    if (!$t || (int)$t['clan_id'] !== (int)$me['clan_id']) fail('Игрок не в вашем клане.');
    if ((string)$t['clan_role'] === 'leader') fail('Главу клана нельзя понизить. Сначала передайте главенство.');
    if ((string)$me['clan_role'] === 'elder' && $rank === 'elder') fail('Старейшина не может назначать других старейшин.');
    run('UPDATE users SET clan_role=? WHERE id=?', [$rank, $targetId]);
    ok('Звание игрока обновлено: ' . clan_rank_label($rank) . '.');
}

// ======================= ДУЭЛИ =======================

/** Последний вызов на дуэль между двумя игроками. */
function duel_between(int $a, int $b): ?array {
    return row('SELECT * FROM duel_requests WHERE (challenger_id=? AND opponent_id=?) OR (challenger_id=? AND opponent_id=?) ORDER BY id DESC LIMIT 1', [$a, $b, $b, $a]);
}

function duel_offer(int $uid, int $targetId): void {
    clan_migrate();
    if ($targetId === $uid) fail('Нельзя вызвать на дуэль самого себя.');
    $t = row('SELECT id,username,banned,tutorial_done FROM users WHERE id=?', [$targetId]);
    if (!$t || $t['banned']) fail('Игрок не найден.');
    if (!$t['tutorial_done']) fail('Игрок ещё не прошёл обучение — дуэль недоступна.');
    run('DELETE FROM duel_requests WHERE challenger_id=? AND opponent_id=?', [$uid, $targetId]);
    run('DELETE FROM duel_requests WHERE challenger_id=? AND opponent_id=?', [$targetId, $uid]);
    run('INSERT INTO duel_requests(challenger_id,opponent_id,status) VALUES(?,?,?)', [$uid, $targetId, 'pending']);
    send_mail($targetId, 'Вызов на дуэль', "Вас вызвали на дуэль! Откройте профиль игрока и примите вызов.", 0, 0, $uid);
    ok("Вызов на дуэль отправлен игроку {$t['username']}.");
}

/** Принять/отклонить входящий вызов или отменить свой. */
function duel_answer(int $uid, int $requestId, bool $accept): void {
    clan_migrate();
    $r = row('SELECT * FROM duel_requests WHERE id=?', [$requestId]);
    if (!$r) fail('Вызов не найден.');
    if ((int)$r['opponent_id'] === $uid) {
        if ($r['status'] !== 'pending') fail('Этот вызов уже обработан.');
        if ($accept) {
            run("UPDATE duel_requests SET status='accepted' WHERE id=?", [$requestId]);
            send_mail((int)$r['challenger_id'], 'Дуэль принята!', 'Соперник принял ваш вызов на дуэль. Откройте его профиль и начинайте бой.', 0, 0, $uid);
            ok('Дуэль принята! Откройте профиль соперника и начните бой.');
        } else {
            run('DELETE FROM duel_requests WHERE id=?', [$requestId]);
            ok('Вызов отклонён.');
        }
        return;
    }
    if ((int)$r['challenger_id'] === $uid) {
        if ($accept) fail('Вызов принимает соперник.');
        run('DELETE FROM duel_requests WHERE id=?', [$requestId]);
        ok('Вызов отменён.');
        return;
    }
    fail('Этот вызов не ваш.');
}

/** Дуэль между участником и просматриваемым профилем (для страницы профиля). */
function duel_view(int $uid, int $otherId): ?array {
    clan_migrate();
    $r = duel_between($uid, $otherId);
    if (!$r || !in_array((string)$r['status'], ['pending', 'accepted'], true)) return null;
    $side = (int)$r['opponent_id'] === $uid ? 'incoming' : 'outgoing';
    $opId = (int)($side === 'incoming' ? $r['challenger_id'] : $r['opponent_id']);
    return ['id' => (int)$r['id'], 'status' => $r['status'], 'side' => $side, 'opponentId' => $opId,
        'createdAt' => iso($r['created_at']), 'info' => duel_info($opId)];
}

/** Данные соперника для дуэли — тот же формат, что и поиск PvP. */
function duel_info(int $targetId): ?array {
    $p = row('SELECT id,username,trophies,deck,tower_skin,banner_skin,equipped_emotes FROM users WHERE id=? AND banned=0', [$targetId]);
    if (!$p || $p['deck'] === '') return null;
    $lv = [];
    foreach (rows('SELECT card_id,level FROM owned_cards WHERE user_id=?', [$p['id']]) as $o) $lv[(int)$o['card_id']] = (int)$o['level'];
    $deck = array_values(array_filter(array_map('intval', explode(',', (string)$p['deck'])), fn($i) => isset($lv[$i])));
    if (count($deck) < 4) return null;
    $deck = array_slice($deck, 0, 8);
    $levels = new stdClass();
    foreach ($deck as $i) $levels->{(string)$i} = $lv[$i];
    return ['id' => (int)$p['id'], 'username' => $p['username'], 'trophies' => (int)$p['trophies'],
        'deck' => $deck, 'levels' => $levels, 'towerSkin' => $p['tower_skin'],
        'bannerSkin' => $p['banner_skin'], 'emotes' => jget($p, 'equipped_emotes', [])];
}

// ======================= ПИСЬМО ИЗ ПРОФИЛЯ =======================

function profile_send_mail(int $fromId, int $toId, string $title, string $body): void {
    clan_migrate();
    if ($toId === $fromId) fail('Нельзя написать самому себе.');
    $t = row('SELECT id,username,banned FROM users WHERE id=?', [$toId]);
    if (!$t || $t['banned']) fail('Игрок не найден.');
    if ($title === '' || $body === '') fail('Заполните тему и текст письма.');
    // Антиспам: не чаще 3 писем в минуту.
    $recent = (int)val('SELECT COUNT(*) FROM mail_messages WHERE sender_id=? AND created_at > ?', [$fromId, gmdate('Y-m-d H:i:s', time() - 60)]);
    if ($recent >= 3) fail('Слишком часто. Подождите минуту перед следующим письмом.');
    send_mail($toId, $title, $body, 0, 0, $fromId);
    ok('Письмо отправлено игроку ' . $t['username'] . '.');
}
