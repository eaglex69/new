<?php
declare(strict_types=1);

// Мини-игры: слоты, «21» (блэкджек) и кости. Ставки — золото, вся математика на сервере.

const MG_BETS = [50, 100, 250, 500, 1000];
// символ => [вес, выплата за три одинаковых (множитель ставки)]
const MG_SLOTS = [
    '7' => [1, 10],
    '★' => [2, 6],
    '◆' => [3, 4],
    '♥' => [4, 3],
    '●' => [5, 2],
];
const MG_DICE_CHOICES = ['under7' => 'Меньше 7', 'seven' => 'Ровно 7', 'over7' => 'Больше 7'];

function mg_bet(array $b): int {
    $bet = (int)($b['bet'] ?? 0);
    if (!in_array($bet, MG_BETS, true)) fail('Выберите ставку: 50, 100, 250, 500 или 1000 золота.');
    return $bet;
}

function mg_take(int $uid, int $bet): void {
    if (!run('UPDATE users SET gold=gold-? WHERE id=? AND gold>=?', [$bet, $uid, $bet])) {
        fail('Недостаточно золота для ставки ' . $bet . '.');
    }
}

function mg_give(int $uid, int $amount): void {
    if ($amount > 0) run('UPDATE users SET gold=gold+? WHERE id=?', [$amount, $uid]);
}

function mg_gold(int $uid): int {
    return (int)val('SELECT gold FROM users WHERE id=?', [$uid]);
}

// ======================= СЛОТЫ =======================
function mg_spin_reel(): string {
    $total = 0;
    foreach (MG_SLOTS as $s) $total += $s[0];
    $r = random_int(1, $total);
    foreach (MG_SLOTS as $sym => $s) {
        $r -= $s[0];
        if ($r <= 0) return (string)$sym;
    }
    return '●';
}

function mg_slots(int $uid, array $b): void {
    $bet = mg_bet($b);
    $reels = [mg_spin_reel(), mg_spin_reel(), mg_spin_reel()];
    $win = 0;
    if ($reels[0] === $reels[1] && $reels[1] === $reels[2]) {
        $win = $bet * MG_SLOTS[$reels[0]][1];
    } elseif ($reels[0] === $reels[1] || $reels[1] === $reels[2] || $reels[0] === $reels[2]) {
        $win = (int)floor($bet * 0.4); // пара возвращает 40% ставки
    }
    tx(function () use ($uid, $bet, $win) {
        mg_take($uid, $bet);
        mg_give($uid, $win);
    });
    quest_bump($uid, 'play_minigames');
    out(['ok' => true, 'reels' => $reels, 'bet' => $bet, 'win' => $win, 'gold' => mg_gold($uid),
        'message' => $win > 0 ? "Выигрыш: $win золота!" : 'Повезёт в следующий раз!']);
}

// ======================= «21» (БЛЭКДЖЕК) =======================
function mg_bj_card(): array {
    $ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    $suits = ['♠', '♥', '♦', '♣'];
    return ['r' => $ranks[random_int(0, 12)], 's' => $suits[random_int(0, 3)]];
}

function mg_bj_value(array $cards): int {
    $v = 0; $aces = 0;
    foreach ($cards as $c) {
        $r = $c['r'];
        if ($r === 'A') { $v += 11; $aces++; }
        elseif (in_array($r, ['J', 'Q', 'K', '10'], true)) $v += 10;
        else $v += (int)$r;
    }
    while ($v > 21 && $aces > 0) { $v -= 10; $aces--; }
    return $v;
}

function mg_bj_get(): ?array {
    $g = $_SESSION['mg_bj'] ?? null;
    return is_array($g) && isset($g['bet'], $g['player'], $g['dealer']) ? $g : null;
}

function mg_bj_public(array $g): array {
    $done = !empty($g['done']);
    return [
        'bet' => (int)$g['bet'],
        'player' => $g['player'],
        'dealer' => $done ? $g['dealer'] : array_slice($g['dealer'], 0, 1),
        'dealerHidden' => !$done,
        'pVal' => mg_bj_value($g['player']),
        'dVal' => $done ? mg_bj_value($g['dealer']) : null,
        'done' => $done,
        'result' => $g['result'] ?? null,
        'win' => (int)($g['win'] ?? 0),
    ];
}

/** Расчёт оконченной партии: начисляет выигрыш и закрывает игру в сессии. */
function mg_bj_finish(int $uid, array $g, string $result, int $win): array {
    $g['done'] = true; $g['result'] = $result; $g['win'] = $win;
    if ($win > 0) mg_give($uid, $win);
    $_SESSION['mg_bj'] = $g;
    quest_bump($uid, 'play_minigames');
    $out = mg_bj_public($g);
    $out['gold'] = mg_gold($uid);
    $out['ok'] = true;
    return $out;
}

function mg_bj_start(int $uid, array $b): void {
    $cur = mg_bj_get();
    if ($cur && empty($cur['done'])) {
        $out = mg_bj_public($cur);
        $out['ok'] = true; $out['resumed'] = true; $out['gold'] = mg_gold($uid);
        $out['message'] = 'Продолжаем текущую партию.';
        out($out);
    }
    $bet = mg_bet($b);
    mg_take($uid, $bet);
    $g = ['bet' => $bet, 'player' => [mg_bj_card(), mg_bj_card()], 'dealer' => [mg_bj_card(), mg_bj_card()], 'done' => false];
    $pv = mg_bj_value($g['player']); $dv = mg_bj_value($g['dealer']);
    if ($pv === 21 || $dv === 21) {
        if ($pv === 21 && $dv === 21) out(mg_bj_finish($uid, $g, 'push', $bet) + ['message' => 'Ничья: у обоих 21. Ставка возвращена.']);
        if ($pv === 21) out(mg_bj_finish($uid, $g, 'blackjack', (int)floor($bet * 2.5)) + ['message' => 'Блэкджек! Выигрыш ×2.5!']);
        out(mg_bj_finish($uid, $g, 'lose', 0) + ['message' => 'У дилера 21. Повезёт в следующий раз!']);
    }
    $_SESSION['mg_bj'] = $g;
    $out = mg_bj_public($g);
    $out['ok'] = true; $out['gold'] = mg_gold($uid);
    $out['message'] = 'Ваш ход: ещё или хватит?';
    out($out);
}

function mg_bj_dealer_plays(array $dealer): array {
    while (mg_bj_value($dealer) < 17) $dealer[] = mg_bj_card();
    return $dealer;
}

function mg_bj_hit(int $uid): void {
    $g = mg_bj_get();
    if (!$g || !empty($g['done'])) fail('Нет активной партии. Начните новую игру.');
    $g['player'][] = mg_bj_card();
    $pv = mg_bj_value($g['player']);
    if ($pv > 21) out(mg_bj_finish($uid, $g, 'lose', 0) + ['message' => "Перебор: $pv. Ставка сгорела."]);
    if ($pv === 21) { mg_bj_stand($uid, $g); return; }
    $_SESSION['mg_bj'] = $g;
    $out = mg_bj_public($g);
    $out['ok'] = true; $out['gold'] = mg_gold($uid);
    $out['message'] = "У вас $pv. Ещё или хватит?";
    out($out);
}

function mg_bj_stand(int $uid, ?array $g = null): void {
    $g = $g ?? mg_bj_get();
    if (!$g || !empty($g['done'])) fail('Нет активной партии. Начните новую игру.');
    $g['dealer'] = mg_bj_dealer_plays($g['dealer']);
    $pv = mg_bj_value($g['player']); $dv = mg_bj_value($g['dealer']);
    $bet = (int)$g['bet'];
    if ($dv > 21) out(mg_bj_finish($uid, $g, 'win', $bet * 2) + ['message' => "Дилер перебрал ($dv). Выигрыш: " . ($bet * 2) . " золота!"]);
    if ($pv > $dv) out(mg_bj_finish($uid, $g, 'win', $bet * 2) + ['message' => "Выигрыш: $pv против $dv! +" . ($bet * 2) . " золота."]);
    if ($pv < $dv) out(mg_bj_finish($uid, $g, 'lose', 0) + ['message' => "$pv против $dv — победа дилера."]);
    out(mg_bj_finish($uid, $g, 'push', $bet) + ['message' => "Ничья $pv:$dv. Ставка возвращена."]);
}

// ======================= КОСТИ =======================
function mg_dice(int $uid, array $b): void {
    $bet = mg_bet($b);
    $choice = (string)($b['choice'] ?? '');
    if (!isset(MG_DICE_CHOICES[$choice])) fail('Выберите: меньше 7, ровно 7 или больше 7.');
    $d1 = random_int(1, 6); $d2 = random_int(1, 6); $sum = $d1 + $d2;
    $win = 0;
    if ($choice === 'seven' && $sum === 7) $win = $bet * 5;
    elseif ($choice === 'under7' && $sum < 7) $win = (int)floor($bet * 2.2);
    elseif ($choice === 'over7' && $sum > 7) $win = (int)floor($bet * 2.2);
    tx(function () use ($uid, $bet, $win) {
        mg_take($uid, $bet);
        mg_give($uid, $win);
    });
    quest_bump($uid, 'play_minigames');
    out(['ok' => true, 'dice' => [$d1, $d2], 'sum' => $sum, 'choice' => $choice, 'bet' => $bet,
        'win' => $win, 'gold' => mg_gold($uid),
        'message' => $win > 0 ? "Выпало $sum — выигрыш: $win золота!" : "Выпало $sum. Повезёт в следующий раз!"]);
}
