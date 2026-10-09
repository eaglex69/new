<?php
declare(strict_types=1);

// Игровая почта: письма от игры и администрации, к письму можно прикрепить награду.

/** Создаёт недостающие таблицы (квесты и почта) в уже установленной базе.
 * CREATE TABLE IF NOT EXISTS идемпотентен, поэтому отдельная проверка не нужна —
 * заодно не зависим от information_schema, закрытой на части хостингов. */
function run_migrations(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS daily_quests (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, quest_key VARCHAR(40) NOT NULL, title VARCHAR(120) NOT NULL,
        goal INT NOT NULL DEFAULT 1, progress INT NOT NULL DEFAULT 0, reward_gold INT NOT NULL DEFAULT 0, reward_gems INT NOT NULL DEFAULT 0,
        claimed TINYINT(1) NOT NULL DEFAULT 0, day DATE NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_quest_day (user_id, quest_key, day),
        CONSTRAINT fk_dq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    db()->exec("CREATE TABLE IF NOT EXISTS mail_messages (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, title VARCHAR(120) NOT NULL, body TEXT NOT NULL,
        reward_gold INT NOT NULL DEFAULT 0, reward_gems INT NOT NULL DEFAULT 0,
        is_read TINYINT(1) NOT NULL DEFAULT 0, claimed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_mail_user (user_id, id),
        CONSTRAINT fk_mail_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function send_mail(int $uid, string $title, string $body, int $gold = 0, int $gems = 0, ?int $senderId = null): void {
    run('INSERT INTO mail_messages(user_id,title,body,reward_gold,reward_gems,sender_id) VALUES(?,?,?,?,?,?)',
        [$uid, mb_substr($title, 0, 120), mb_substr($body, 0, 1000), max(0, $gold), max(0, $gems), $senderId]);
}

function mail_view(int $uid): array {
    $out = [];
    $sql = 'SELECT m.*, s.username AS sender_name, s.id AS sender_id FROM mail_messages m LEFT JOIN users s ON s.id=m.sender_id WHERE m.user_id=? ORDER BY m.id DESC LIMIT 40';
    foreach (rows($sql, [$uid]) as $r) {
        $out[] = [
            'id' => (int)$r['id'], 'title' => $r['title'], 'body' => $r['body'],
            'rewardGold' => (int)$r['reward_gold'], 'rewardGems' => (int)$r['reward_gems'],
            'read' => (bool)$r['is_read'], 'claimed' => (bool)$r['claimed'],
            'senderId' => $r['sender_id'] ? (int)$r['sender_id'] : null,
            'senderName' => (string)($r['sender_name'] ?? ''),
            'createdAt' => iso($r['created_at']),
        ];
    }
    return $out;
}

function mail_read(int $uid, int $id): void {
    run('UPDATE mail_messages SET is_read=1 WHERE id=? AND user_id=?', [$id, $uid]);
}

/** Забирает награду из одного письма (или из всех, если $id = 0). Возвращает выданные золото и кристаллы. */
function mail_claim(int $uid, int $id): array {
    return tx(function () use ($uid, $id) {
        $list = $id > 0
            ? rows('SELECT * FROM mail_messages WHERE id=? AND user_id=? FOR UPDATE', [$id, $uid])
            : rows('SELECT * FROM mail_messages WHERE user_id=? AND claimed=0 AND (reward_gold>0 OR reward_gems>0) FOR UPDATE', [$uid]);
        if ($id > 0 && !$list) throw new RuleError('Письмо не найдено.');
        $gold = 0; $gems = 0; $n = 0;
        foreach ($list as $r) {
            if ($r['claimed'] || ((int)$r['reward_gold'] <= 0 && (int)$r['reward_gems'] <= 0)) continue;
            if (!run('UPDATE mail_messages SET claimed=1, is_read=1 WHERE id=? AND user_id=? AND claimed=0', [$r['id'], $uid])) continue;
            $gold += (int)$r['reward_gold']; $gems += (int)$r['reward_gems']; $n++;
        }
        if ($n === 0) throw new RuleError($id > 0 ? 'В этом письме нет награды или она уже получена.' : 'Нет наград для получения.');
        if ($gold > 0) run('UPDATE users SET gold=gold+? WHERE id=?', [$gold, $uid]);
        if ($gems > 0) run('UPDATE users SET gems=gems+? WHERE id=?', [$gems, $uid]);
        return ['gold' => $gold, 'gems' => $gems, 'count' => $n];
    });
}

function mail_delete(int $uid, int $id): void {
    $r = row('SELECT reward_gold,reward_gems,claimed FROM mail_messages WHERE id=? AND user_id=?', [$id, $uid]);
    if (!$r) fail('Письмо не найдено.');
    if (!$r['claimed'] && ((int)$r['reward_gold'] > 0 || (int)$r['reward_gems'] > 0)) fail('Сначала заберите награду из письма.');
    run('DELETE FROM mail_messages WHERE id=? AND user_id=?', [$id, $uid]);
}
