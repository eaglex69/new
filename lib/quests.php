<?php
declare(strict_types=1);

// Ежедневные квесты: 5 заданий в день, прогресс копится за реальные действия.
const QUEST_POOL = [
    'win_battles' => ['title' => 'Победить в 3 боях', 'goal' => 3, 'gold' => 200, 'gems' => 5, 'hint' => 'Любой режим арены'],
    'open_chests' => ['title' => 'Открыть 2 сундука', 'goal' => 2, 'gold' => 150, 'gems' => 0, 'hint' => 'Бесплатный или за победу'],
    'claim_gift' => ['title' => 'Забрать ежедневный подарок', 'goal' => 1, 'gold' => 0, 'gems' => 10, 'hint' => 'Кнопка на главной'],
    'upgrade_cards' => ['title' => 'Улучшить любую карту', 'goal' => 1, 'gold' => 250, 'gems' => 0, 'hint' => 'Раздел «Карты»'],
    'start_battles' => ['title' => 'Сыграть 3 боя', 'goal' => 3, 'gold' => 180, 'gems' => 0, 'hint' => 'Даже поражение засчитывается'],
    'donate_cards' => ['title' => 'Подарить карту другу', 'goal' => 1, 'gold' => 120, 'gems' => 5, 'hint' => 'Чат клана'],
    'win_pvp' => ['title' => 'Победить в 1 PvP-бою', 'goal' => 1, 'gold' => 300, 'gems' => 8, 'hint' => 'Арена против живых игроков'],
    'earn_crowns' => ['title' => 'Собрать 5 корон в боях', 'goal' => 5, 'gold' => 220, 'gems' => 5, 'hint' => 'Короны за разрушенные башни'],
    'win_3_crowns' => ['title' => 'Победить с 3 коронами', 'goal' => 1, 'gold' => 350, 'gems' => 10, 'hint' => 'Разрушьте все башни соперника'],
    'buy_shop' => ['title' => 'Купить 2 карты в магазине', 'goal' => 2, 'gold' => 150, 'gems' => 5, 'hint' => 'Раздел «Магазин»'],
    'deck_update' => ['title' => 'Обновить боевую колоду', 'goal' => 1, 'gold' => 100, 'gems' => 3, 'hint' => 'Раздел «Карты»'],
    'buy_chest_shop' => ['title' => 'Купить 1 сундук в магазине', 'goal' => 1, 'gold' => 200, 'gems' => 5, 'hint' => 'Раздел «Сундуки»'],
    'claim_league' => ['title' => 'Забрать награду лиги', 'goal' => 1, 'gold' => 250, 'gems' => 10, 'hint' => 'Раздел «Лиги»'],
    'claim_tournament' => ['title' => 'Забрать награду турнира', 'goal' => 1, 'gold' => 300, 'gems' => 10, 'hint' => 'После финала турнира'],
    'tournament_battles' => ['title' => 'Сыграть 2 турнирных боя', 'goal' => 2, 'gold' => 250, 'gems' => 8, 'hint' => 'Режим турнира'],
    'equip_style' => ['title' => 'Сменить облик, знамя или эмоцию', 'goal' => 1, 'gold' => 120, 'gems' => 5, 'hint' => 'Раздел «Косметика»'],
    'chat_active' => ['title' => 'Написать 5 сообщений в чат', 'goal' => 5, 'gold' => 100, 'gems' => 3, 'hint' => 'Общий или клановый чат'],
    'request_fragments' => ['title' => 'Попросить фрагменты в клане', 'goal' => 1, 'gold' => 120, 'gems' => 3, 'hint' => 'Кнопка «Попросить»'],
    'friends_add' => ['title' => 'Добавить друга или принять заявку', 'goal' => 1, 'gold' => 150, 'gems' => 5, 'hint' => 'Раздел «Друзья»'],
    'mail_rewards' => ['title' => 'Забрать награду из почты', 'goal' => 1, 'gold' => 100, 'gems' => 5, 'hint' => 'Раздел «Почта»'],
    'pvp_search' => ['title' => 'Найти 2 соперников на PvP-арене', 'goal' => 2, 'gold' => 180, 'gems' => 5, 'hint' => 'Кнопка «Найти противника»'],
    'play_minigames' => ['title' => 'Сыграть в 5 мини-игр', 'goal' => 5, 'gold' => 200, 'gems' => 5, 'hint' => 'Слоты, «21» или кости'],
];

const QUESTS_PER_DAY = 5;

function quest_day(): string { return gmdate('Y-m-d'); }

/** Выдаёт задания на сегодня, если их ещё нет. Набор детерминирован по дню и игроку. */
function ensure_daily_quests(int $uid): void {
    $day = quest_day();
    if ((int)val('SELECT COUNT(*) FROM daily_quests WHERE user_id=? AND day=?', [$uid, $day]) > 0) return;
    $keys = array_keys(QUEST_POOL);
    $start = ((int)gmdate('z') + $uid) % count($keys);
    for ($i = 0; $i < QUESTS_PER_DAY; $i++) {
        $k = $keys[($start + $i) % count($keys)];
        $q = QUEST_POOL[$k];
        run('INSERT IGNORE INTO daily_quests(user_id,quest_key,title,goal,reward_gold,reward_gems,day) VALUES(?,?,?,?,?,?,?)',
            [$uid, $k, $q['title'], $q['goal'], $q['gold'], $q['gems'], $day]);
    }
}

/** Накидывает прогресс по заданию (сразу всем сегодняшним заданиям с таким ключом). */
function quest_bump(int $uid, string $key, int $inc = 1): void {
    if ($inc <= 0 || !isset(QUEST_POOL[$key])) return;
    ensure_daily_quests($uid);
    run('UPDATE daily_quests SET progress=LEAST(goal, progress+?) WHERE user_id=? AND quest_key=? AND day=? AND claimed=0',
        [$inc, $uid, $key, quest_day()]);
}

function quests_view(int $uid): array {
    ensure_daily_quests($uid);
    $out = [];
    foreach (rows('SELECT * FROM daily_quests WHERE user_id=? AND day=? ORDER BY id', [$uid, quest_day()]) as $r) {
        $out[] = [
            'id' => (int)$r['id'], 'key' => $r['quest_key'], 'title' => $r['title'],
            'goal' => (int)$r['goal'], 'progress' => (int)$r['progress'],
            'rewardGold' => (int)$r['reward_gold'], 'rewardGems' => (int)$r['reward_gems'],
            'claimed' => (bool)$r['claimed'],
            'done' => (int)$r['progress'] >= (int)$r['goal'],
            'hint' => QUEST_POOL[$r['quest_key']]['hint'] ?? '',
        ];
    }
    return $out;
}

function quest_claim(int $uid, int $questId): array {
    ensure_daily_quests($uid);
    return tx(function () use ($uid, $questId) {
        $r = row('SELECT * FROM daily_quests WHERE id=? AND user_id=? AND day=? FOR UPDATE', [$questId, $uid, quest_day()]);
        if (!$r) throw new RuleError('Задание не найдено.');
        if ($r['claimed']) throw new RuleError('Награда уже получена.');
        if ((int)$r['progress'] < (int)$r['goal']) throw new RuleError('Задание ещё не выполнено.');
        if (!run('UPDATE daily_quests SET claimed=1 WHERE id=? AND user_id=? AND claimed=0', [$questId, $uid])) throw new RuleError('Награда уже получена.');
        $g = (int)$r['reward_gold']; $m = (int)$r['reward_gems'];
        if ($g > 0) run('UPDATE users SET gold=gold+? WHERE id=?', [$g, $uid]);
        if ($m > 0) run('UPDATE users SET gems=gems+? WHERE id=?', [$m, $uid]);
        return ['gold' => $g, 'gems' => $m];
    });
}
