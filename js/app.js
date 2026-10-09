/* Crownfall · клиент PHP-версии: чистый JavaScript + AJAX (fetch) + Canvas. Без фреймворков. */
(function () {
'use strict';
const C = window.Crown, CF = window.CF = {};
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
const S = CF.S = { data: null, nav: 'lobby', busy: false, deckSlot: 0, shopFilter: 'Все', rankTab: 'players', chatTab: 'global', mgTab: 'slots', mgBet: 100, mgDice: 'over7', mgBusy: false, slotRes: null, diceRes: null, bj: null, more: false, modal: null, profileId: null, profile: null, profileLoading: false, badgeModal: false, authMode: 'register', authError: '', rival: { look: {}, emotes: [] }, pvpOpp: null, reveal: null };
CF.esc = esc; CF.fmt = fmt; CF.$ = $;

async function api(route, body, form) {
  const o = { method: body || form ? 'POST' : 'GET', headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin', cache: 'no-store' };
  if (form) o.body = form; else if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  let r, j = {};
  try { r = await fetch('api.php?r=' + route, o); j = await r.json(); } catch (e) { return { ok: false, status: 0, j: { error: 'Нет соединения с сервером.' } }; }
  return { ok: r.ok, status: r.status, j };
}
CF.api = api;
let toastT = 0;
function toast(m) { const el = $('#toast-root'); el.innerHTML = `<div class="toast-message">${esc(m)}<button data-act="toast-x">×</button></div>`; clearTimeout(toastT); toastT = setTimeout(() => el.innerHTML = '', 4500); }
CF.toast = toast;
async function refresh() { const r = await api('game'); if (r.ok) { S.data = r.j; render(); } }
CF.refresh = refresh;
async function action(payload, silent) {
  S.busy = true; const r = await api('game', payload); S.busy = false;
  if (!silent) toast(r.j.message || r.j.error || 'Ошибка');
  if (r.status === 401) { await refresh(); return null; }
  if (r.ok) { await refresh(); return r.j; }
  return null;
}
CF.action = action;

// ---------- графические примитивы (чистый CSS, без эмодзи и SVG) ----------
const ico = (n, s = 28, cls = '') => `<span class="ico ico-${n} ${cls}" style="width:${s}px;height:${s}px" aria-hidden="true"><i class="p1"></i><i class="p2"></i><i class="p3"></i><i class="p4"></i></span>`;
const art = (image, alt) => { const a = C.parseArt(image); return `<span role="img" aria-label="${esc(alt)}" class="card-art"><i style="background-image:url('${esc(a.src.replace(/^\//, ''))}');${a.hue ? 'filter:hue-rotate(' + a.hue + 'deg)' : ''}"></i></span>`; };
CF.art = art; CF.ico = ico;
function cosView(it, size) {
  size = size || 'md';
  const st = `--c1:${esc(it.color1)};--c2:${esc(it.color2)}`, img = it.image ? `background-image:url('${esc(it.image)}');background-size:cover;background-position:center` : '';
  if (it.type === 'banner') return `<span class="cos cos-banner ${size}" style="${st}"><i class="pole"></i><i class="cloth" style="${img}">${it.image ? '' : '<b>' + esc(it.label) + '</b>'}</i></span>`;
  if (it.type === 'towerSkin') return `<span class="cos cos-tower ${size}" style="${st}"><i class="t-top" style="${img}"></i><i class="t-body"></i><i class="t-door"></i><i class="t-crown"></i></span>`;
  return `<span class="cos cos-emote ${size}" style="${st}">${it.image ? '<i class="e-img" style="' + img + '"></i>' : '<b>' + esc(it.label || it.name) + '</b>'}</span>`;
}
CF.cosView = cosView;
function tile(c, o) {
  o = o || {}; const lv = o.level || 1;
  return `<button class="card-tile ${o.small ? 'small ' : ''}${c.rarity.toLowerCase()}${o.locked ? ' locked' : ''}${o.selected ? ' selected-slot' : ''}" data-act="${o.act || 'card-info'}" data-id="${c.id}"><span class="card-cost">${c.cost}</span>${art(c.image, c.name)}<span class="card-tile-name">${esc(c.name)}</span><span class="card-level">${o.locked ? 'Закрыта' : 'Ур. ' + lv + ' <b>' + (o.copies || 0) + '/' + lv * 10 + '</b>'}</span></button>`;
}

// ---------- данные ----------
const D = () => S.data, U = () => S.data.user;
const ownedOf = (id) => D().owned.find((o) => o.cardId === id);
const cardById = (id) => D().cards.find((c) => c.id === id);
const deckCards = () => D().deck.map(cardById).filter(Boolean);
const catalogBy = (type, name) => D().cosmeticCatalog.find((c) => c.type === type && c.name === name);
const NAV = [['quests', 'Квесты', 'Ежедневные задания', 'scroll'], ['lobby', 'Арена', 'Главная', 'swords'], ['cards', 'Карты', 'Моя колода', 'cards'], ['shop', 'Магазин', 'Особые предложения', 'chest'], ['chests', 'Сундуки', 'Награды и сокровища', 'chest'], ['cosmetics', 'Косметика', 'Облики, знамёна, эмоции', 'star'], ['leagues', 'Лиги', 'Лига и сезон', 'trophy'], ['pvp', 'PvP-арена', 'Бои с игроками', 'swords'], ['tournament', 'Турнир', 'Бои недели', 'trophy'], ['clan', 'Кланы', 'Ваша команда', 'shield'], ['chat', 'Чат', 'Общение', 'chat'], ['friends', 'Друзья', 'Играйте вместе', 'friends'], ['ranking', 'Рейтинг', 'Лучшие игроки', 'trophy'], ['history', 'История', 'Прошлые бои', 'scroll']];
const PRIMARY = ['lobby', 'cards', 'shop', 'clan', 'chat'];
const CHEST_TITLE = { wood: 'Деревянный сундук', silver: 'Серебряный сундук', gold: 'Золотой сундук', magic: 'Магический сундук', legendary: 'Легендарный сундук', tournament: 'Турнирный сундук' };
const chestImg = '<img src="images/chest.jpg" alt="Сундук">';
const CLAN_RANKS = { newbie: 'Новичок', member: 'Боец', elder: 'Старейшина', leader: 'Глава' };
const CLAN_TYPES = { open: 'Открытый', closed: 'Закрытый' };
const CLAN_EMBLEMS = ['blue', 'red', 'purple', 'green', 'gold', 'orange', 'teal', 'black'];
const clanCrest = (c, cls) => `<span class="clan-emblem ${esc((c && c.badge) || 'blue')} ${cls || ''}">${esc((c && c.emblem) || (c && c.name ? c.name.charAt(0) : 'C'))}</span>`;

// ---------- вход / регистрация ----------
function pageAuth() {
  const reg = S.authMode === 'register';
  return `<div class="app-shell"><div class="app-frame auth-frame">
  <div class="auth-hero"><div class="auth-hero-art"></div><div class="auth-hero-shade"></div></div>
  <div class="auth-panel"><div class="auth-tabs"><button class="${reg ? 'active' : ''}" data-act="auth-mode" data-id="register">Регистрация</button><button class="${reg ? '' : 'active'}" data-act="auth-mode" data-id="login">Вход</button></div>
  <form class="auth-form" data-form="auth">${reg ? '<label>Имя игрока<input class="field" name="username" placeholder="Как вас будут звать на арене?" required minlength="3" maxlength="20" autocomplete="nickname"></label>' : ''}
  <label>Электронная почта<input class="field" type="email" name="email" placeholder="you@example.com" required autocomplete="email"></label>
  <label>Пароль<input class="field" type="password" name="password" placeholder="${reg ? 'Не менее 8 символов' : 'Ваш пароль'}" required minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
  ${S.authError ? `<div class="form-error">${esc(S.authError)}</div>` : ''}<button class="cr-btn cr-yellow auth-submit" type="submit">${reg ? 'Начать игру' : 'В бой!'}</button></form>
  <small class="auth-foot">${reg ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <button data-act="auth-mode" data-id="${reg ? 'login' : 'register'}">${reg ? 'Войти' : 'Зарегистрироваться'}</button></small>
  <div class="auth-features"><span>${ico('cards', 22)}<b>${D().cards.length}</b> карт</span><span>${ico('shield', 22)}<b>Кланы</b></span><span>${ico('trophy', 22)}<b>Лиги</b></span><span>${ico('chest', 22)}<b>Сундуки</b></span></div></div>
  </div></div>`;
}

// ---------- оболочка ----------
const lvlOf = (xp) => Math.max(1, Math.floor((xp || 0) / 500) + 1);
const hasRew = (m) => !!(m.rewardGold || m.rewardGems);
const mailNew = () => (D().mail || []).filter((m) => !m.read || (hasRew(m) && !m.claimed)).length;
const TAB_BAR = [['shop', 'Магазин', 'chest'], ['cards', 'Карты', 'cards'], ['lobby', 'Бой', 'swords'], ['clan', 'Клан', 'shield']];
function moreItems() {
  const u = U();
  return [['minigames', 'Мини-игры', 'dice'], ['mail', 'Почта', 'mail'], ['chests', 'Сундуки', 'chest'], ['quests', 'Квесты', 'scroll'], ['chat', 'Чат', 'chat'], ['tournament', 'Турнир', 'trophy'], ['pvp', 'PvP-арена', 'swords'], ['leagues', 'Лиги', 'trophy'], ['ranking', 'Рейтинг', 'star'], ['friends', 'Друзья', 'friends'], ['cosmetics', 'Косметика', 'star'], ['history', 'История', 'scroll']].concat(u.role === 'admin' ? [['admin', 'Админ', 'gear']] : []);
}
function hud() {
  const u = U(), lvl = lvlOf(u.xp), xin = (u.xp || 0) % 500;
  return `<header class="hud"><button class="hud-level" data-act="menu" data-id="settings" aria-label="Профиль"><span class="lvl-shield"><b>${lvl}</b></span><span class="hud-xp"><i style="width:${Math.round(xin / 5)}%"></i><b>${fmt(xin)}/500</b></span></button>
  <div class="hud-cur"><button class="hud-plus" data-act="nav" data-id="shop" aria-label="Купить золото">+</button><b>${fmt(u.gold)}</b><span class="coin-icon"></span></div>
  <div class="hud-cur gem"><button class="hud-plus" data-act="nav" data-id="shop" aria-label="Купить кристаллы">+</button><b>${fmt(u.gems)}</b><span class="gem-icon"></span></div></header>`;
}
function settingsMenu() {
  const u = U();
  const items = [['profile', 'Мой профиль', 'shield'], ['cosmetics', 'Мой стиль', 'star'], ['history', 'История боёв', 'scroll'], ['ranking', 'Рейтинг', 'trophy'], ['friends', 'Друзья', 'friends']].concat(u.role === 'admin' ? [['admin', 'Админ-панель', 'gear']] : []);
  return `<div class="dd-menu dd-settings" id="dd-settings"><div class="dd-head"><span class="lvl-shield sm"><b>${lvlOf(u.xp)}</b></span><div><strong>${esc(u.username)}</strong><small>${esc(u.email || '')}</small></div></div>
  ${items.map((m) => `<button class="dd-item ${S.nav === m[0] ? 'active' : ''}" data-act="nav" data-id="${m[0]}">${ico(m[2], 22)}<span>${m[1]}</span><i>›</i></button>`).join('')}
  <button class="dd-item danger" data-act="logout">${ico('arrow', 22)}<span>Выйти из аккаунта</span><i>›</i></button></div>`;
}
function shell() {
  const more = moreItems(), moreActive = more.some((m) => m[0] === S.nav);
  return `<div class="app-shell"><div class="app-frame">
  ${hud()}
  <main class="main-content" id="page">${page()}</main>
  <div class="dd-backdrop" data-act="menu-close"></div>
  ${settingsMenu()}
  <footer class="tabbar">
    <div class="dd-menu dd-more" id="dd-more"><div class="dd-more-title">Все разделы</div><div class="dd-grid">${more.map((m) => `<button class="${S.nav === m[0] ? 'active' : ''}" data-act="nav" data-id="${m[0]}"><span>${ico(m[2], 30)}</span><b>${m[1]}</b>${m[0] === 'mail' && mailNew() ? `<em class="q-badge">${mailNew()}</em>` : ''}</button>`).join('')}</div></div>
    ${TAB_BAR.map((n) => `<button class="tab ${n[0] === 'lobby' ? 'tab-main ' : ''}${S.nav === n[0] ? 'active' : ''}" data-act="nav" data-id="${n[0]}"><span class="tab-ico">${ico(n[2], n[0] === 'lobby' ? 38 : 30)}</span><b>${n[1]}</b></button>`).join('')}
    <button class="tab ${moreActive ? 'active' : ''}" data-act="menu" data-id="more"><span class="tab-ico">${ico('more', 30)}</span><b>Ещё</b>${D().chests.length + mailNew() ? `<em class="tab-badge">${D().chests.length + mailNew()}</em>` : ''}</button>
  </footer></div></div>`;
}

async function openProfile(id) {
  S.profileId = +id; S.profile = null; S.profileLoading = true; S.badgeModal = false; go('profile');
  const r = await api('profile&user=' + (+id));
  S.profileLoading = false;
  if (!r.ok) { toast(r.j.error || 'Профиль недоступен.'); S.profile = null; render(); return; }
  S.profile = r.j; render();
}
CF.openProfile = openProfile;
function pRankName(r) { return r === 'leader' ? 'Глава' : r === 'elder' ? 'Старейшина' : 'Участник'; }

// ---------- страницы ----------
function head(eyebrow, title, text, chip) { return `<div class="section-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${text}</p></div>${chip ? `<div class="heading-chip">${chip}</div>` : ''}</div>`; }
function page() {
  const fn = { minigames: pMinigames, profile: pProfile, mail: pMail, quests: pQuests, lobby: pLobby, cards: pCards, shop: pShop, chests: pChests, cosmetics: pCosmetics, leagues: pLeagues, pvp: pPvp, tournament: pTournament, clan: pClan, chat: pChat, friends: pFriends, ranking: pRanking, history: pHistory, admin: () => CF.pageAdmin() }[S.nav] || pLobby;
  return fn();
}
function avgCost(list) { return list.length ? (list.reduce((a, c) => a + c.cost, 0) / list.length).toFixed(1) : '0.0'; }

function giftLeft() { const u = U(); return u.lastGiftAt ? Math.max(0, new Date(u.lastGiftAt).getTime() + 864e5 - Date.now()) : 0; }
function hm(ms) { const m = Math.ceil(ms / 60000); return Math.floor(m / 60) + 'ч. ' + String(m % 60).padStart(2, '0') + 'м.'; }
function dhm(ms) { const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5); return d > 0 ? d + ' дн. ' + h + ' ч.' : hm(ms); }
function pLobby() {
  const d = D(), u = U(), ai = Math.max(0, d.arenas.findIndex((a) => a.id === d.arena.id)), na = d.arenas[ai + 1];
  const clan = d.clans.find((c) => c.id === u.clanId), left = giftLeft();
  const qs = d.quests || [], qDone = qs.filter((q) => q.done && !q.claimed).length, qReady = qs.filter((q) => q.done).length;
  const prog = na ? Math.max(0, Math.min(100, Math.round(((u.trophies - d.arena.minTrophies) / Math.max(1, na.minTrophies - d.arena.minTrophies)) * 100))) : 100;
  const slots = [0, 1, 2, 3].map((i) => {
    const ch = d.chests[i];
    if (!ch) return `<div class="slot empty"><span class="slot-top">Пусто</span><div class="slot-chest"></div><b>Слот ${i + 1}</b></div>`;
    return `<button class="slot ready ${esc(ch.type)}" data-act="open-chest" data-id="${ch.id}"><span class="slot-top">${ch.source === 'victory' ? 'За победу' : ch.source === 'shop' ? 'Покупка' : 'Награда'}</span><div class="slot-chest"><img src="images/chest.jpg" alt=""></div><b>Открыть</b><small>${esc((CHEST_TITLE[ch.type] || 'Сундук').replace(' сундук', ''))}</small></button>`;
  }).join('');
  return `<div class="home">
  <div class="home-profile"><button class="home-banner" data-act="profile-me" aria-label="Мой профиль">${ico('shield', 34)}</button><button class="home-name" data-act="profile-me"><strong>${esc(u.username)}</strong><small>${esc(clan ? clan.name : 'Без клана')}</small></button>
    <button class="home-trophies" data-act="nav" data-id="leagues">${ico('trophy', 24, 'trophy-icon')}<b>${fmt(u.trophies)}</b></button>
    <button class="home-gear" data-act="menu" data-id="settings" aria-label="Настройки">${ico('gear', 30)}</button></div>
  <div class="home-row">
    <button class="home-card quests" data-act="nav" data-id="quests"><span class="quest-book">${ico('scroll', 34)}${qDone ? `<em class="q-badge">${qDone}</em>` : ''}</span><b>Квесты</b></button>
    <button class="home-card royal ${left ? '' : 'ready'}" data-act="gift" ${left ? 'disabled' : ''}><div><span class="rc-title">Подарок дня</span>${left ? `<small>Доступен через:</small><strong data-countdown="${new Date(u.lastGiftAt).getTime() + 864e5}">${hm(left)}</strong>` : '<strong class="rc-ready">Забрать!</strong>'}</div><img src="images/chest.jpg" alt=""></button>
  </div>
  <div class="home-arena">
    <div class="side-btns left"><button data-act="nav" data-id="ranking" aria-label="Рейтинг">${ico('trophy', 34)}</button><button data-act="nav" data-id="mail" aria-label="Почта">${ico('mail', 34)}${mailNew() ? `<em class="q-badge">${mailNew()}</em>` : ''}</button></div>
    <div class="arena-stage"><div class="arena-island"></div><div class="arena-label"><b>${esc(d.arena.name)}</b><span class="arena-prog"><i style="width:${prog}%"></i><em>${fmt(u.trophies)} / ${na ? fmt(na.minTrophies) : 'MAX'}</em></span></div></div>
    <div class="side-btns right"><button data-act="nav" data-id="leagues" aria-label="Лиги">${ico('crown', 34)}</button><button data-act="nav" data-id="friends" aria-label="Друзья">${ico('friends', 34)}</button></div>
  </div>
  <div class="home-play"><button class="cr-btn cr-yellow" data-act="battle">В бой</button><button class="cr-btn cr-blue" data-act="nav" data-id="pvp">PvP<small>1 на 1</small></button></div>
  <div class="slots">${slots}</div>
  </div>`;
}

function badgeChip(b, size) {
  const cls = 'bdg bdg-' + (b.color || 'blue');
  return `<span class="${cls} ${size || ''}" title="${esc(b.descr || b.name)}"><span class="bdg-ico ico ico-${b.icon}"><i class="p1"></i><i class="p2"></i><i class="p3"></i><i class="p4"></i></span></span>`;
}
// ---------- мини-игры: слоты, «21», кости ----------
const MG_BETS = [50, 100, 250, 500, 1000];
const MG_SYMS = ['7', '★', '◆', '♥', '●'];
function slotSym(ch, extra) {
  const cls = ch === '7' ? 'sl-7' : ch === '★' ? 'sl-star' : ch === '◆' ? 'sl-dia' : ch === '♥' ? 'sl-heart' : 'sl-dot';
  return `<span class="slot-sym ${cls} ${extra || ''}">${esc(ch)}</span>`;
}
function diceFace(v, extra) {
  const on = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[v] || [5];
  let cells = '';
  for (let i = 1; i <= 9; i++) cells += `<i class="${on.includes(i) ? 'pip' : ''}"></i>`;
  return `<span class="mg-die ${extra || ''}">${cells}</span>`;
}
function bjCard(c, hidden) {
  if (hidden) return '<span class="bj-card back"><b>?</b></span>';
  const red = c.s === '♥' || c.s === '♦';
  return `<span class="bj-card ${red ? 'red' : 'blk'}"><b>${esc(c.r)}</b><i>${esc(c.s)}</i></span>`;
}
function mgBetRow(u) {
  return `<div class="mg-bets">${MG_BETS.map((b) => `<button class="mg-bet ${S.mgBet === b ? 'on' : ''} ${u.gold < b ? 'poor' : ''}" data-act="mg-bet" data-id="${b}">${fmt(b)}</button>`).join('')}</div>`;
}
function pMinigames() {
  const u = U(), t = S.mgTab;
  const tabs = [['slots', 'Слоты'], ['bj', 'Двадцать одно'], ['dice', 'Кости']];
  let body = '';
  // --- слоты ---
  if (t === 'slots') {
    const r = S.slotRes, busy = S.mgBusy;
    body = `<div class="mg-machine">
      <div class="mg-reels ${busy ? 'spinning' : ''}">${(r ? r.reels : ['7', '★', '◆']).map((ch) => `<span class="mg-reel">${slotSym(ch)}</span>`).join('')}</div>
      ${r && !busy ? `<div class="mg-result ${r.win > 0 ? 'win' : 'lose'}">${r.win > 0 ? `Выигрыш: <b>${fmt(r.win)}</b> золота` : 'Не повезло — крутите ещё!'}</div>` : busy ? '<div class="mg-result spin">Крутится…</div>' : '<div class="mg-result idle">Три одинаковых — крупный выигрыш!</div>'}
      <button class="cr-btn cr-yellow mg-spin" data-act="slot-spin" ${busy || u.gold < S.mgBet ? 'disabled' : ''}>Крутить за ${fmt(S.mgBet)}</button>
      <div class="mg-pay"><span>3×${slotSym('7')} = ×10</span><span>3×${slotSym('★')} = ×6</span><span>3×${slotSym('◆')} = ×4</span><span>3×${slotSym('♥')} = ×3</span><span>3×${slotSym('●')} = ×2</span><span>Пара = 40% ставки</span></div>
    </div>`;
  }
  // --- «21» ---
  if (t === 'bj') {
    const g = S.bj;
    if (!g) {
      body = `<div class="mg-machine"><div class="mg-result idle">Наберите 21 очко, но не больше.<br>Дилер останавливается на 17. Блэкджек платит ×2.5!</div>
      <button class="cr-btn cr-yellow mg-spin" data-act="bj-start" ${u.gold < S.mgBet ? 'disabled' : ''}>Играть за ${fmt(S.mgBet)}</button></div>`;
    } else {
      const resTxt = g.result === 'blackjack' ? 'БЛЭКДЖЕК!' : g.result === 'win' ? 'ПОБЕДА!' : g.result === 'push' ? 'НИЧЬЯ' : g.result === 'lose' ? 'ДИЛЕР ЗАБРАЛ СТАВКУ' : '';
      body = `<div class="bj-table">
        <div class="bj-side"><small>Дилер${g.done && g.dVal != null ? ` · ${g.dVal}` : ''}</small><div class="bj-cards">${g.dealer.map((c) => bjCard(c)).join('')}${g.dealerHidden ? bjCard(null, true) : ''}</div></div>
        <div class="bj-mid"><span class="bj-bet-chip">Ставка ${fmt(g.bet)}</span></div>
        <div class="bj-side"><small>Вы · ${g.pVal}</small><div class="bj-cards">${g.player.map((c) => bjCard(c)).join('')}</div></div>
        ${g.done ? `<div class="mg-result ${g.result === 'lose' ? 'lose' : 'win'}">${resTxt}${g.win > 0 ? `: <b>+${fmt(g.win)}</b>` : ''}</div>
        <button class="cr-btn cr-yellow mg-spin" data-act="bj-start" ${S.mgBusy || u.gold < S.mgBet ? 'disabled' : ''}>Ещё раз за ${fmt(S.mgBet)}</button>`
        : `<div class="bj-actions"><button class="cr-btn cr-yellow" data-act="bj-hit" ${S.mgBusy ? 'disabled' : ''}>Ещё</button><button class="cr-btn cr-blue" data-act="bj-stand" ${S.mgBusy ? 'disabled' : ''}>Хватит</button></div>`}
      </div>`;
    }
  }
  // --- кости ---
  if (t === 'dice') {
    const r = S.diceRes, busy = S.mgBusy;
    const ch = [['under7', 'Меньше 7', '×2.2'], ['seven', 'Ровно 7', '×5'], ['over7', 'Больше 7', '×2.2']];
    body = `<div class="mg-machine">
      <div class="dice-choices">${ch.map((c) => `<button class="dice-choice ${S.mgDice === c[0] ? 'on' : ''}" data-act="dice-choice" data-id="${c[0]}"><b>${c[1]}</b><small>${c[2]}</small></button>`).join('')}</div>
      <div class="dice-row">${(r ? r.dice : [1, 6]).map((v) => diceFace(v, busy ? 'rolling' : '')).join('')}<span class="dice-sum">${r && !busy ? 'Сумма: <b>' + r.sum + '</b>' : ''}</span></div>
      ${r && !busy ? `<div class="mg-result ${r.win > 0 ? 'win' : 'lose'}">${r.win > 0 ? `Выигрыш: <b>${fmt(r.win)}</b> золота` : 'Мимо — попробуйте ещё!'}</div>` : busy ? '<div class="mg-result spin">Кости катятся…</div>' : '<div class="mg-result idle">Угадайте сумму двух костей!</div>'}
      <button class="cr-btn cr-yellow mg-spin" data-act="dice-roll" ${busy || u.gold < S.mgBet ? 'disabled' : ''}>Бросить за ${fmt(S.mgBet)}</button>
    </div>`;
  }
  return head('ЗОЛОТО И УДАЧА', 'Мини-игры', 'Ставки — золото. Выигрыш падает на баланс сразу.', `<span class="coin-icon"></span> ${fmt(u.gold)}`) +
  `<div class="segmented mg-tabs">${tabs.map((x) => `<button class="${t === x[0] ? 'active' : ''}" data-act="mg-tab" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
  <div class="mg-balance"><small>Ваша ставка:</small>${mgBetRow(u)}</div>${body}`;
}

function pProfile() {
  const d = D(), u = U();
  if (S.profileLoading || !S.profile) return `<div class="profile"><div class="panel padded empty-state">${S.profileLoading ? 'Загрузка профиля…' : 'Профиль недоступен.'}</div></div>`;
  const p = S.profile, me = p.isMe, st = p.stats, clan = p.clan;
  const roleName = clan ? (CLAN_RANKS[clan.role] || 'Участник') : '';
  const duel = p.duel;
  let duelBtns = '';
  if (!me && p.canDuel) {
    if (duel && duel.status === 'accepted') duelBtns = `<button class="cr-btn cr-yellow prof-act" data-act="duel-start">Начать дуэль!</button>`;
    else if (duel && duel.side === 'incoming') duelBtns = `<button class="cr-btn cr-yellow prof-act" data-act="duel-accept" data-id="${duel.id}">Принять дуэль</button><button class="cr-btn cr-blue prof-act" data-act="duel-decline" data-id="${duel.id}">Отклонить</button>`;
    else if (duel) duelBtns = `<button class="cr-btn cr-blue prof-act" data-act="duel-decline" data-id="${duel.id}">${duel.status === 'accepted' ? 'Отменить дуэль' : 'Отменить вызов'}</button>`;
    else duelBtns = `<button class="cr-btn cr-blue prof-act" data-act="duel-offer" data-id="${p.id}">Предложить дуэль</button>`;
  }
  const banner = p.bannerSkin ? (d.cosmeticCatalog.find((c) => c.name === p.bannerSkin) || null) : null;
  const invs = d.clanInvites || [];
  const fav = p.favoriteCard;
  return `<div class="profile">
  <div class="prof-hero">
    <div class="prof-hero-top">
      <span class="prof-banner">${banner ? CF.cosView(banner, 'sm') : ico('shield', 40)}</span>
      <div class="prof-name"><strong>${esc(p.username)}</strong><small>${esc(p.tag)}</small></div>
      <span class="prof-lvl"><span class="lvl-shield sm"><b>${p.level}</b></span></span>
    </div>
    <div class="prof-chips">
      <span class="prof-chip">${ico('trophy', 20, 'trophy-icon')}<b>${fmt(p.trophies)}</b> трофеев</span>
      <span class="prof-chip">${ico('swords', 20)}<b>${fmt(p.wins)}</b> побед</span>
      <span class="prof-chip">${ico('star', 20)}<b>${p.arena ? esc(p.arena.name) : '—'}</b></span>
    </div>
    ${clan ? `<button class="prof-clan" data-act="nav" data-id="clan">${clanCrest(clan)}<span class="prof-clan-copy"><strong>${esc(clan.name)}</strong><small>Ур. ${clan.level || 1} · ${CLAN_TYPES[clan.type] || 'Открытый'} · ${roleName}</small></span><i>›</i></button>`
      : (p.tutorialDone ? `<div class="prof-noclan">Без клана</div>` : `<div class="prof-noclan">Обучение не завершено</div>`)}
    ${!me || p.canInvite ? `<div class="prof-actions">
      ${!me ? `<button class="cr-btn cr-blue prof-act" data-act="compose-mail" data-id="${p.id}" data-name="${esc(p.username)}">Написать в почту</button>` : ''}
      ${duelBtns}
      ${p.canInvite ? `<button class="cr-btn cr-yellow prof-act" data-act="clan-invite" data-id="${p.id}">Пригласить в клан</button>` : ''}
    </div>` : ''}
    ${me && invs.length ? `<div class="prof-invites"><h4>Приглашения в клан</h4>${invs.map((i) => `<div class="simple-row"><span class="clan-emblem blue">C</span><div class="grow"><strong>${esc(i.clanName)}</strong><small>пригласил ${esc(i.inviter)}</small></div><button class="tiny-btn" data-act="clan-invite-answer" data-id="${i.id}" data-accept="1">Принять</button><button class="tiny-btn danger" data-act="clan-invite-answer" data-id="${i.id}" data-accept="0">Отклонить</button></div>`).join('')}</div>` : ''}
  </div>

  <div class="prof-badges">
    <div class="prof-sec-head"><h3>Значки</h3><span class="count-badge">${p.badges.length}/8 · получено ${p.badgesEarnedCount}</span></div>
    <div class="badge-grid">${p.badges.length ? p.badges.map((b) => badgeChip(b)).join('') : '<span class="muted">Значки не выбраны</span>'}</div>
    <button class="cr-btn cr-blue prof-collection" data-act="badges-open">Показать коллекцию</button>
  </div>

  ${p.inLeagues ? `<div class="prof-leagues"><div class="prof-sec-head"><h3>Лига</h3></div>
    <div class="league-card"><span class="league-card-title">Этот сезон</span>
      <div class="league-card-row"><span class="lc-trophy">${ico('trophy', 26, 'trophy-icon')}</span><div><small>Максимум в сезоне</small><b>${fmt(p.season.current.trophies)}</b></div><div class="lc-sep"></div><div class="lc-place"><small>Место в топе</small><b>${p.season.current.place ? '#' + p.season.current.place : '—'}</b></div><div class="lc-sep"></div><div><small>До конца</small><b data-countdown="${new Date(d.leagues.resetAt).getTime()}" data-long="1">—</b></div></div>
      <p class="league-note">Количество трофеев сбрасывается в конце каждого сезона лиги.</p></div>
    <div class="league-two">
      <div class="league-card small"><span class="league-card-title">Прошлый сезон</span>${p.season.previous ? `<div class="lc-mini"><span class="league-emblem lg-${(p.league && p.league.color) || 'blue'}">${esc((p.league && p.league.name[0]) || 'Л')}</span><div><small>Максимум</small><b>${fmt(p.season.previous.trophies)}</b></div><div><small>Место</small><b>#${p.season.previous.place}</b></div></div>` : '<p class="muted">Нет данных</p>'}</div>
      <div class="league-card small"><span class="league-card-title">Лучший сезон</span>${p.season.best ? `<div class="lc-mini"><span class="league-emblem lg-gold">${esc((p.league && p.league.name[0]) || 'Л')}</span><div><small>Максимум</small><b>${fmt(p.season.best.trophies)}</b></div><div><small>Место</small><b>#${p.season.best.place}</b></div></div>` : '<p class="muted">Нет данных</p>'}</div>
    </div></div>` : ''}

  <div class="prof-stats">
    <div class="prof-sec-head"><h3>Статистика Royale</h3></div>
    <div class="stat-grid-2">
      <div class="stat-cell"><small>Победы</small><b>${fmt(st.wins)}</b></div>
      <div class="stat-cell"><small>Победы с тремя коронами</small><b>${fmt(st.crowns3)}</b></div>
      <div class="stat-cell"><small>Максимум трофеев</small><b>${fmt(p.maxTrophies)}</b></div>
      <div class="stat-cell"><small>Найдено карт</small><b>${fmt(st.cardsFound)}</b></div>
      <div class="stat-cell"><small>Карт пожертвовано</small><b>${fmt(st.cardsDonated)}</b></div>
      <div class="stat-cell">${fav ? `<small>Любимая карта сейчас</small><b class="stat-card">${art(fav.image, fav.name)}<span>${esc(fav.name)}</span></b>` : `<small>Любимая карта сейчас</small><b class="muted">не выбрана</b>`}</div>
    </div>
    ${me ? `<div class="prof-fav"><span class="muted">Выбрать любимую карту:</span><div class="fav-row">${d.cards.filter((c) => d.owned.some((o) => o.cardId === c.id)).slice(0, 24).map((c) => `<button class="fav-btn ${fav && fav.id === c.id ? 'on' : ''}" data-act="fav-set" data-id="${c.id}">${art(c.image, c.name)}</button>`).join('')}</div></div>` : ''}
  </div>

  <div class="prof-deck">
    <div class="prof-sec-head"><h3>Боевая колода</h3><span class="count-badge">${p.deck.length}/8</span></div>
    <div class="cards-grid deck-grid prof-deck-grid">${p.deck.map((c) => `<button class="card-tile ${c.rarity.toLowerCase()}" data-act="card-info" data-id="${c.id}">${art(c.image, c.name)}<span class="card-tile-name">${esc(c.name)}</span><span class="card-cost">${c.cost}</span></button>`).join('') || '<p class="muted">Колода не собрана</p>'}</div>
  </div>

  ${S.badgeModal ? `<div class="badge-modal" data-act="badges-close-bg"><div class="badge-sheet">
    <div class="badge-sheet-head"><h3>Коллекция значков</h3><button class="badge-x" data-act="badges-close">×</button></div>
    <p class="muted">Выберите до 8 значков — их увидят все, кто откроет ваш профиль.</p>
    <div class="badge-grid all">${p.badgesAll.map((b) => `<button class="badge-pick ${b.earned ? '' : 'locked'} ${(p.badges.some((x) => x.key === b.key)) ? 'on' : ''}" ${b.earned ? `data-act="badge-toggle" data-key="${b.key}"` : 'disabled'}>${badgeChip(b)}<small>${esc(b.name)}</small><em>${b.earned ? esc(b.descr) : 'не получен'}</em></button>`).join('')}</div>
    <div class="badge-sheet-foot"><span class="muted">Выбрано: <b id="badge-count">${(S.badgePick || p.badges.map((b) => b.key)).length}</b>/8</span><button class="cr-btn cr-yellow" data-act="badges-save" ${(S.badgePick || p.badges).length ? '' : 'disabled'}>Сохранить</button></div>
  </div></div>` : ''}
  </div>`;
}

function pMail() {
  const d = D(), u = U(), list = d.mail || [], open = S.mailOpen, todo = list.filter((m) => hasRew(m) && !m.claimed), fresh = mailNew();
  const when = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const item = (m) => {
    const rew = hasRew(m), isOpen = open === m.id;
    return `<div class="mail-item ${m.read ? '' : 'new'} ${isOpen ? 'open' : ''}">
    <button class="mail-head" data-act="mail-open" data-id="${m.id}"><span class="mail-ico">${ico('mail', 30)}${m.read ? '' : '<em class="mail-dot"></em>'}</span>
      <span class="mail-title"><strong>${esc(m.title)}</strong><small>${when(m.createdAt)}${m.senderName ? ` · от <b class="mail-from">${esc(m.senderName)}</b>` : ''}${rew && !m.claimed ? ' · <b class="mail-gift">есть награда</b>' : ''}</small></span><i class="mail-chev">›</i></button>
    ${isOpen ? `<div class="mail-body"><p>${esc(m.body).replace(/\n/g, '<br>')}</p>
      ${rew ? `<div class="mail-reward">${m.rewardGold ? `<span><i class="coin-icon"></i>${fmt(m.rewardGold)}</span>` : ''}${m.rewardGems ? `<span><i class="gem-icon"></i>${fmt(m.rewardGems)}</span>` : ''}</div>` : ''}
      <div class="mail-actions">${rew && !m.claimed ? `<button class="cr-btn cr-yellow cr-mini" data-act="mail-claim" data-id="${m.id}">Забрать</button>` : (rew ? '<span class="mail-done">Награда получена</span>' : '')}
      ${!rew || m.claimed ? `<button class="cr-btn cr-blue cr-mini" data-act="mail-delete" data-id="${m.id}">Удалить</button>` : ''}</div></div>` : ''}</div>`;
  };
  return head('ПОЧТА', 'Письма', `Сообщения от игры и администрации. Почта вашего аккаунта: <b class="mail-addr">${esc(u.email || '—')}</b>`, fresh ? fresh + ' нов.' : '') +
  (todo.length ? `<button class="cr-btn cr-yellow mail-all" data-act="mail-claim-all">Забрать все награды (${todo.length})</button>` : '') +
  (list.length ? `<div class="mail-list">${list.map(item).join('')}</div>`
   : `<div class="panel empty-chests"><h3>Писем пока нет</h3><p>Здесь появятся подарки, новости и сообщения от администрации.</p></div>`);
}

function pQuests() {
  const qs = (D().quests || []).slice().sort((a, b) => (a.claimed ? 1 : 0) - (b.claimed ? 1 : 0) || (b.done ? 1 : 0) - (a.done ? 1 : 0));
  const ready = qs.filter((q) => q.done && !q.claimed).length;
  return head('ЕЖЕДНЕВНЫЕ ЗАДАНИЯ', 'Квесты', 'Задания обновляются каждый день. Забрать награду нужно вручную — она не сгорает до конца дня.', ready ? ready + ' готово' : '0 готово') +
  (qs.length ? `<div class="quest-list">${qs.map((q) => {
    const pct = Math.round(Math.min(1, q.progress / Math.max(1, q.goal)) * 100);
    return `<div class="quest-card ${q.claimed ? 'claimed' : q.done ? 'ready' : ''}">
      <div class="quest-info"><strong>${esc(q.title)}</strong><small>${esc(q.hint || '')}</small>
        <div class="quest-bar"><i style="width:${pct}%"></i><b>${Math.min(q.progress, q.goal)}/${q.goal}</b></div></div>
      <div class="quest-side"><div class="quest-reward">${q.rewardGold ? `<span><i class="coin-icon"></i>${fmt(q.rewardGold)}</span>` : ''}${q.rewardGems ? `<span><i class="gem-icon"></i>${fmt(q.rewardGems)}</span>` : ''}</div>
        ${q.claimed ? '<button class="cr-btn cr-mini off" disabled>Получено</button>'
        : q.done ? `<button class="cr-btn cr-mini" data-act="quest-claim" data-id="${q.id}">Забрать</button>`
        : '<button class="cr-btn cr-mini dim" disabled>В процессе</button>'}</div></div>`;
  }).join('')}</div>` : `<div class="panel empty-chests"><h3>Заданий пока нет</h3><p>Загляните позже — новые квесты появятся каждый день.</p></div>`) +
  `<div class="panel quest-note"><h3>Как это работает</h3><p>Прогресс копится автоматически: бои и короны, PvP и турниры, сундуки и магазин, улучшения карт, подарок дня, чат, клан, друзья, почта, лиги, стиль и мини-игры. Каждый день выдаётся 5 заданий из 22 — набор меняется каждые сутки.</p></div>`;
}

function reqClock() {
  const u = U(), cd = D().requestCooldownMinutes * 60000, left = u.lastRequestAt ? Math.max(0, new Date(u.lastRequestAt).getTime() + cd - Date.now()) : 0;
  return { left, text: String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0') };
}
function pCards() {
  const d = D(), deck = deckCards(), own = new Map(d.owned.map((o) => [o.cardId, o])), mine = d.cards.filter((c) => own.has(c.id)), rc = reqClock();
  return head('БОЕВОЙ НАБОР', 'Моя колода', 'Нажмите слот, затем карту в коллекции — замена сохранится сразу. Карта, уже стоящая в колоде, поменяется местами.', deck.length + ' / 8 карт') +
  `<div class="collection-panel deck-editor-panel"><div class="collection-head"><div><h3>Выберите карты для боя</h3><span>Слот ${S.deckSlot + 1} выбран · средняя стоимость ${avgCost(deck)}</span></div><div class="collection-head-actions"><button class="btn btn-outline" data-act="nav" data-id="chests">Открыть сундуки</button><button class="btn btn-gold req-btn" id="req-btn" data-act="req-open">${rc.left > 0 ? 'Попросить через ' + rc.text : 'Попросить фрагмент'}</button></div></div>
  <div class="cards-grid deck-grid">${Array.from({ length: 8 }, (_, i) => { const c = deck[i]; if (!c) return `<div class="empty-deck-slot ${S.deckSlot === i ? 'selected' : ''}" data-act="deck-slot" data-id="${i}">СЛОТ ${i + 1}<small>Выберите карту</small></div>`; const o = own.get(c.id); return tile(c, { level: o.level, copies: o.copies, selected: S.deckSlot === i, act: 'deck-slot' }).replace(`data-id="${c.id}"`, `data-id="${i}"`); }).join('')}</div></div>
  <div class="collection-panel spaced-panel"><div class="collection-head"><div><h3>Доступные карты</h3><span>Нажмите на любую карту, чтобы заменить слот ${S.deckSlot + 1}. Карты из вашей колоды переставляются местами.</span></div></div><div class="cards-grid collection-grid deck-pick-grid">${mine.map((c) => { const o = own.get(c.id), at = d.deck.indexOf(c.id); return `<div class="deck-pick-cell">${tile(c, { level: o.level, copies: o.copies, selected: at === S.deckSlot, act: 'deck-pick' })}<small>${at >= 0 ? 'В колоде · слот ' + (at + 1) : 'Нажмите, чтобы поставить'}</small><button class="tiny-btn" data-act="card-info" data-id="${c.id}">Подробнее</button></div>`; }).join('')}</div></div>
  <details class="collection-panel locked-collection"><summary>Все карты арены · ${d.cards.length} карт, включая ещё не открытые</summary><div class="cards-grid collection-grid">${d.cards.filter((c) => !own.has(c.id)).map((c) => tile(c, { locked: true })).join('')}</div></details>`;
}

function chestShop() {
  return `<div class="chest-shop-grid">${[['silver', 'Серебряный', '450', 'coin-icon'], ['gold', 'Золотой', '1 250', 'coin-icon'], ['magic', 'Магический', '85', 'gem-icon'], ['legendary', 'Легендарный', '300', 'gem-icon']].map((c) => `<div class="chest-shop-card"><img src="images/chest.jpg" alt=""><strong>${c[1]}</strong><button class="btn btn-gold" data-act="buy-chest" data-id="${c[0]}"><span class="${c[3]}"></span>${c[2]}</button></div>`).join('')}</div>`;
}
function pShop() {
  const d = D(), own = new Map(d.owned.map((o) => [o.cardId, o])), f = S.shopFilter;
  return head('КОРОЛЕВСКАЯ ЛАВКА', 'Магазин', 'Пополните коллекцию и укрепите свою армию.') + `<div class="shop-hero"><div><span class="eyebrow">ВСЕ КАРТЫ ИГРЫ</span><h2>Время усилить колоду</h2><p>Каждая купленная карта открывает нового бойца и даёт копии для улучшения.</p></div><img src="images/chest.jpg" alt="Сундук"></div>
  <div class="filter-row">${['Все', 'Обычная', 'Редкая', 'Эпическая', 'Легендарная', 'Чемпион'].map((x) => `<button class="${f === x ? 'active' : ''}" data-act="shop-filter" data-id="${x}">${x === 'Все' ? 'Все карты' : x}</button>`).join('')}</div>
  <div class="shop-grid">${d.cards.filter((c) => f === 'Все' || c.rarity === f).map((c) => { const o = own.get(c.id); return `<div class="shop-item">${tile(c, { locked: !o, level: o && o.level, copies: o && o.copies })}<strong>${esc(c.name)}</strong><span class="rarity-label">${c.rarity} · ${esc(c.role)}</span><button class="btn btn-gold full" data-act="buy" data-id="${c.id}"><i class="coin-icon"></i>${C.cardPrice(c.rarity)}</button></div>`; }).join('')}</div>
  <div class="section-title-row"><div><span class="eyebrow">СОКРОВИЩНИЦА</span><h3>Сундуки</h3><p class="muted">Покупайте сундуки за золото или кристаллы.</p></div></div>${chestShop()}`;
}

function pChests() {
  const d = D(), u = U(), wl = { common: 'обычные', rare: 'редкие', epic: 'эпические', legendary: 'легендарные', champion: 'чемпионы' };
  return head('НАГРАДЫ ЗА ПОБЕДЫ', 'Сундуки', 'Открывайте сундуки за бои, покупайте их или забирайте турнирные награды.', d.chests.length + ' закрыто') +
  `<div class="chest-wallet"><div><span class="coin-icon"></span><b>${fmt(u.gold)}</b><small>Золото</small></div><div><span class="gem-icon"></span><b>${fmt(u.gems)}</b><small>Кристаллы</small></div><div class="evolution-wallet"><b>${fmt(u.evolutionFragments)}</b><small>Фрагменты эволюции</small></div>${Object.entries(u.wildcards || {}).map(([k, v]) => `<div class="wildcard-wallet"><b>${fmt(v)}</b><small>Дикие карты · ${wl[k] || k}</small></div>`).join('')}</div>` +
  (d.chests.length ? `<div class="chest-inventory">${d.chests.map((ch) => `<div class="inventory-chest"><div class="big-chest ${ch.type}"><img src="images/chest.jpg" alt="Сундук"></div><div class="inventory-chest-copy"><span class="eyebrow">${ch.source === 'victory' ? 'ЗА ПОБЕДУ' : ch.source === 'shop' ? 'ПОКУПКА' : ch.source === 'league' ? 'ЗА ЛИГУ' : ch.source.includes('tournament') ? 'ТУРНИР' : 'НАГРАДА'}</span><h3>${CHEST_TITLE[ch.type] || 'Сундук'}</h3><small>${new Date(ch.createdAt).toLocaleDateString('ru-RU')}</small></div><button class="btn btn-gold" data-act="open-chest" data-id="${ch.id}" data-type="${ch.type}">Открыть</button></div>`).join('')}</div>`
    : `<div class="panel empty-chests"><img src="images/chest.jpg" alt="Пустой сундук"><h3>Пока сундуков нет</h3><p>Побеждайте на арене, покупайте сундуки или участвуйте в турнирах.</p><button class="btn btn-green" data-act="nav" data-id="lobby">В бой</button></div>`) +
  `<div class="section-title-row"><div><span class="eyebrow">МАГАЗИН СУНДУКОВ</span><h3>Сундуки за валюту</h3></div></div>${chestShop()}<div class="collection-panel cosmetic-panel"><h3>Косметика</h3><p class="muted">Облики башен, боевые знамёна и эмоции выпадают из сундуков. У вас предметов: ${(u.cosmetics || []).length} из ${d.cosmeticCatalog.length}.</p><button class="btn btn-gold" data-act="nav" data-id="cosmetics">Открыть коллекцию косметики</button></div>`;
}

function pCosmetics() {
  const d = D(), u = U();
  return head('СТИЛЬ ИГРОКА', 'Косметика', 'Выбирайте облик башни, боевое знамя и эмоции — они видны в бою. Новые предметы выпадают из сундуков.', (u.cosmetics || []).length + ' / ' + d.cosmeticCatalog.length) +
  [['towerSkin', 'Облики башни'], ['banner', 'Боевые знамёна'], ['emote', 'Эмоции (до 6 в бою)']].map(([type, title]) => {
    const items = d.cosmeticCatalog.filter((c) => c.type === type), owned = new Set((u.cosmetics || []).filter((c) => c.type === type).map((c) => c.name));
    const on = (n) => type === 'towerSkin' ? u.towerSkin === n : type === 'banner' ? u.bannerSkin === n : (u.equippedEmotes || []).includes(n);
    return `<div class="collection-panel cosmetic-section"><div class="collection-head"><div><h3>${title}</h3><span>${owned.size} из ${items.length} получено</span></div></div><div class="cosmetic-grid">${items.map((it) => { const have = owned.has(it.name), act = on(it.name); return `<div class="cosmetic-card ${have ? '' : 'locked '}${act ? 'on' : ''}">${cosView(it)}<strong>${esc(it.name)}</strong><small class="rar-${it.rarity}">${it.rarity}</small>${have ? `<button class="btn ${act ? 'btn-outline' : 'btn-gold'}" data-act="equip" data-type="${type}" data-name="${esc(it.name)}" data-off="${act ? 1 : 0}">${act ? 'Снять' : 'Надеть'}</button>` : '<span class="cos-locked">Выпадает из сундуков</span>'}</div>`; }).join('') || '<p class="muted">Предметов этого типа пока нет.</p>'}</div></div>`;
  }).join('');
}

function pLeagues() {
  const d = D(), u = U(), lg = d.league, nl = d.nextLeague;
  return head('СЕЗОННАЯ ЛИГА', 'Лиги', 'Ваша лига зависит от кубков. За первое попадание в лигу вы получаете сундук и награды.', 'СБРОС ' + new Date(d.leagues.resetAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })) +
  `<div class="league-hero league-${lg ? lg.color : 'blue'}"><div class="league-cup">${ico('trophy', 44)}</div><div class="league-hero-copy"><span class="eyebrow">ВАША ЛИГА</span><h2>${esc(lg ? lg.name : 'Без лиги')}</h2><p>${nl ? 'До лиги «' + esc(nl.name) + '»: ' + Math.max(0, nl.minTrophies - u.trophies) + ' кубков' : 'Вы в высшей лиге сезона!'}</p><div class="league-bar"><i style="width:${nl ? Math.min(100, u.trophies / (nl.minTrophies || 1) * 100) : 100}%"></i></div><small>${fmt(u.trophies)} кубков</small></div>
  <div class="league-actions">${d.leagueChestReady && lg ? '<button class="btn btn-gold" data-act="league-claim">Забрать награду лиги</button>' : '<span class="league-claimed">Награда за сезон получена</span>'}<button class="btn btn-outline" data-act="nav" data-id="ranking">Рейтинг игроков</button></div></div>
  <div class="panel padded league-list-panel"><h3>Все лиги сезона</h3><div class="league-ladder">${d.leagues.list.map((l) => `<div class="league-step ${lg && l.id === lg.id ? 'current' : ''}"><span class="league-emblem lg-${l.color}">${esc(l.name[0])}</span><div class="league-step-copy"><strong>${esc(l.name)}</strong><small>От ${fmt(l.minTrophies)} кубков · сундук: ${l.chestType} · ${fmt(l.rewardGold)} золота</small></div>${lg && l.id === lg.id ? '<span class="league-badge">ВЫ ЗДЕСЬ</span>' : ''}</div>`).join('')}</div><p class="muted league-note">В первый понедельник каждого месяца сезон обновляется: кубки всех игроков уменьшаются на 30%, а награды за лиги можно получить заново.</p></div>`;
}

function pPvp() {
  const d = D(), at = d.pvp.attacks;
  return head('БОИ С РЕАЛЬНЫМИ ИГРОКАМИ', 'PvP-арена', 'Ваша колода защищает башню, а вы атакуете колоды других игроков. Результаты сохраняются для обеих сторон.', at.length ? at.length + ' новых атак' : 'Атак нет') +
  `<div class="pvp-arena-panel"><div class="pvp-arena-art"><div class="pvp-glow"></div><div class="pvp-badge">${ico('swords', 38)}</div><div class="pvp-arena-copy"><span class="eyebrow">НАЙТИ ПРОТИВНИКА</span><h2>${d.pvp.enabled ? 'Готовы к бою?' : 'PvP отключено'}</h2><p>${d.pvp.enabled ? 'Подберём игрока с похожим количеством кубков. Вы увидите его настоящую колоду.' : 'Администратор временно отключил PvP-арену.'}</p><button class="btn btn-green" data-act="pvp-find" ${d.pvp.enabled ? '' : 'disabled'}>Найти противника</button></div></div></div>
  <div class="two-columns pvp-columns"><div class="panel padded"><h3>Вашу башню атаковали <span class="count-badge">${at.length}</span></h3>${at.map((a) => `<div class="pvp-attack"><span class="rank-avatar">${esc(a.username[0].toUpperCase())}</span><div class="grow"><strong>${esc(a.username)}</strong><small>${new Date(a.createdAt).toLocaleString('ru-RU')} · ${a.attackerCrowns}:${a.defenderCrowns}</small></div><span class="history-result ${a.result === 'win' ? 'loss' : a.result === 'loss' ? 'win' : 'draw'}">${a.result === 'win' ? 'ОН ПОБЕДИЛ' : a.result === 'loss' ? 'ВЫ ОТБИЛИ' : 'НИЧЬЯ'}</span></div>`).join('') || '<div class="empty-state">Пока никто не атаковал вашу башню.</div>'}<button class="tiny-btn" data-act="pvp-seen">Отметить как прочитанные</button></div>
  <div class="panel padded"><h3>Как работает PvP</h3><p class="muted">Противник выбирается среди реальных игроков с похожими кубками. В бою используется его настоящая колода и уровни карт, а ваша колода защищает башню.</p><p class="muted">За победу вы получаете кубки, золото и сундук. Проигравший теряет кубки.</p><button class="btn btn-outline" data-act="nav" data-id="cards">Изменить колоду</button></div></div>`;
}

function pTournament() {
  const d = D(), t = d.tournament, me = d.tournamentMe;
  if (!t) return head('ТУРНИР НЕДЕЛИ', 'Турнир', 'Еженедельный турнир создаётся автоматически.', 'НЕТ ТУРНИРА') + '<div class="panel empty-chests"><img src="images/chest.jpg" alt=""><h3>Турнир недоступен</h3><p>Новый турнир недели создаётся автоматически.</p></div>';
  const ended = new Date(t.endsAt).getTime() <= Date.now();
  return head('ТУРНИР НЕДЕЛИ', esc(t.name), esc(t.description), 'До ' + new Date(t.endsAt).toLocaleDateString('ru-RU')) +
  `<div class="tournament-hero"><div class="tournament-badge">${ico('trophy', 42)}</div><div class="tournament-info"><span class="eyebrow">ПРИЗОВОЙ СУНДУК</span><h2>Турнирная таблица</h2><p>Одерживайте победы в турнирном режиме, чтобы набирать короны. Топ-3 — легендарный сундук, топ-10 — магический, остальным — турнирный.</p><div class="tourney-progress"><span>Ваш результат: <b>${me ? me.score + ' корон · ' + me.wins + ' побед' : 'нет боёв'}</b></span><div><i style="width:${Math.min(100, ((me ? me.score : 0) / 30) * 100)}%"></i></div></div></div>
  <div class="tournament-actions"><button class="btn btn-green" data-act="battle-tournament">Турнирный бой</button>${ended ? '<button class="btn btn-gold" data-act="tournament-claim">Забрать награду</button>' : ''}<button class="btn btn-outline" data-act="nav" data-id="chests">Мои сундуки (${d.chests.length})</button></div></div>
  <div class="panel padded tournament-table"><h3>Участники <span class="count-badge">${d.tournamentStandings.length}</span></h3>${d.tournamentStandings.slice(0, 20).map((r, i) => `<div class="rank-row ${r.userId === U().id ? 'me' : ''}"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span><div class="rank-avatar">${esc(r.username[0].toUpperCase())}</div><div class="rank-person"><strong>${esc(r.username)}${r.userId === U().id ? ' <em>ВЫ</em>' : ''}</strong><small>Побед: ${r.wins} · боёв: ${r.battles}</small></div><span class="rank-score">${ico('trophy', 22, 'trophy-icon')}${r.score}</span></div>`).join('') || '<div class="empty-state">Пока нет участников. Станьте первым!</div>'}</div>`;
}

function pClan() {
  const d = D(), u = U(), my = d.clans.find((c) => c.id === u.clanId);
  const hd = head('СИЛА В ЕДИНСТВЕ', 'Кланы', 'Объединяйтесь с друзьями и покоряйте арену вместе.');
  if (my) {
    const role = u.clanRole || (my.ownerId === u.id ? 'leader' : 'member');
    const isLeader = role === 'leader', canEdit = role === 'leader' || role === 'elder';
    const lv = my.level || 1, xp = my.xp || 0, need = lv * lv * 100, prev = (lv - 1) * (lv - 1) * 100;
    const pct = Math.max(0, Math.min(100, need > prev ? Math.round((xp - prev) / Math.max(1, need - prev) * 100) : 100));
    const ranks = ['newbie', 'member', 'elder'];
    const members = d.clanMembers.map((m) => {
      const rr = m.role || 'member';
      let up = '', dn = '';
      if (m.id !== u.id && rr !== 'leader' && canEdit) {
        const i = ranks.indexOf(rr);
        if (i >= 0 && i < 2 && !(role === 'elder' && ranks[i + 1] === 'elder')) up = `<button class="tiny-btn rank-ctl" data-act="clan-rank" data-id="${m.id}" data-rank="${ranks[i + 1]}" title="Повысить">▲</button>`;
        if (i > 0) dn = `<button class="tiny-btn rank-ctl" data-act="clan-rank" data-id="${m.id}" data-rank="${ranks[i - 1]}" title="Понизить">▼</button>`;
      }
      return `<div class="simple-row member-row"><span class="rank-avatar">${esc(m.username[0])}</span><button class="simple-link grow" data-act="profile-open" data-id="${m.id}"><strong>${esc(m.username)}</strong><small>${ico('trophy', 13, 'trophy-icon')} ${fmt(m.trophies)}</small></button><span class="rank-chip r-${rr}">${CLAN_RANKS[rr] || 'Участник'}</span>${up}${dn}</div>`;
    }).join('');
    const settings = canEdit ? `<div class="panel padded clan-settings"><div class="clan-set-head"><h3>Настройки клана</h3><span class="type-badge t-${my.type || 'open'}">${CLAN_TYPES[my.type] || 'Открытый'}</span></div>
      <form class="form-stack" data-form="clanSettings">
        <label>Тип клана<select class="field" name="type" ${isLeader ? '' : 'disabled'}><option value="open" ${(my.type || 'open') === 'open' ? 'selected' : ''}>Открытый — вступает любой</option><option value="closed" ${my.type === 'closed' ? 'selected' : ''}>Закрытый — по приглашению</option></select></label>
        <label>Символ эмблемы<input class="field" name="emblem" maxlength="4" value="${esc(my.emblem || (my.name || 'C').charAt(0))}"></label>
        <label class="wide">Описание<input class="field" name="description" maxlength="180" value="${esc(my.description || '')}" placeholder="О клане"></label>
        <div class="emblem-row"><span>Эмблема:</span>${CLAN_EMBLEMS.map((b) => `<button type="button" class="emblem-swatch ${b} ${my.badge === b ? 'on' : ''}" data-act="clan-emblem" data-id="${b}" title="${b}"></button>`).join('')}</div>
        <button class="btn btn-gold" type="submit">Сохранить</button>
      </form>
      <p class="muted">Приглашать в клан могут только старейшина и глава — новичкам и бойцам это недоступно.</p></div>`
      : `<div class="panel padded clan-settings"><h3>Звания клана</h3><p class="muted">Приглашать игроков, менять описание и тип клана могут только старейшины и глава. Ваше звание: <span class="rank-chip r-${role}">${CLAN_RANKS[role] || 'Участник'}</span></p></div>`;
    return hd + `<div class="clan-hero">${clanCrest(my, 'large')}<div class="clan-hero-copy"><span class="eyebrow">ВАШ КЛАН · ${CLAN_TYPES[my.type] || 'Открытый'}</span><h2>${esc(my.name)}</h2><p>${esc(my.description || 'Одна команда. Одна цель. Победа.')}</p>
      <div class="clan-xp-row"><span class="clan-lvl">Ур. ${lv}</span><div class="clan-xp-bar"><i style="width:${pct}%"></i></div><small>${fmt(Math.max(0, xp - prev))} / ${fmt(Math.max(1, need - prev))} XP</small></div></div>
      <button class="btn btn-outline" data-act="clan-leave">Покинуть</button></div>
  <div class="two-columns"><div class="panel padded"><div class="clan-set-head"><h3>Участники <span class="count-badge">${d.clanMembers.length}</span></h3><span class="rank-chip r-${role}">${CLAN_RANKS[role] || 'Участник'}</span></div>${members}</div>
  <div class="panel padded clan-chat"><h3>Чат клана</h3>${chatBox('clan')}</div></div>${settings}`;
  }
  const invs = {};
  (d.clanInvites || []).forEach((i) => { invs[i.clanId] = i; });
  return hd + (d.clanInvites && d.clanInvites.length ? `<div class="prof-invites"><h4>Вас приглашают</h4>${d.clanInvites.map((i) => `<div class="simple-row"><span class="clan-emblem blue">C</span><div class="grow"><strong>${esc(i.clanName)}</strong><small>пригласил ${esc(i.inviter)}</small></div><button class="tiny-btn" data-act="clan-invite-answer" data-id="${i.id}" data-accept="1">Принять</button><button class="tiny-btn danger" data-act="clan-invite-answer" data-id="${i.id}" data-accept="0">Нет</button></div>`).join('')}</div>` : '') +
  `<div class="two-columns"><div class="panel padded"><h3>Найти клан</h3><input class="field" id="clan-search" placeholder="Поиск клана"><div class="clan-list" id="clan-list">${clanList('')}</div></div>
  <div class="panel padded"><h3>Создать клан</h3><p class="muted">Соберите команду за 1 000 золота. В закрытый клан попасть можно только по приглашению.</p><form class="form-stack" data-form="createClan"><label>Название клана<input class="field" name="name" placeholder="Например, Легенды арены" required minlength="3" maxlength="25"></label><label>Описание<textarea class="field" name="description" rows="3" placeholder="Расскажите о вашем клане"></textarea></label><label>Тип клана<select class="field" name="type"><option value="open">Открытый</option><option value="closed">Закрытый — по приглашению</option></select></label><label>Эмблема<select class="field" name="badge">${CLAN_EMBLEMS.map((b) => `<option value="${b}">${b}</option>`).join('')}</select></label><button class="btn btn-gold full" type="submit">Создать за 1 000 золота</button></form></div></div>`;
}
function clanList(q) {
  const d = D();
  const invs = {};
  (d.clanInvites || []).forEach((i) => { invs[i.clanId] = i; });
  const l = d.clans.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return l.map((c) => {
    const closed = (c.type || 'open') === 'closed', inv = invs[c.id];
    const btn = inv ? `<button class="tiny-btn" data-act="clan-invite-answer" data-id="${inv.id}" data-accept="1">Принять приглашение</button>`
      : closed ? '<span class="type-badge t-closed" title="Вступить можно только по приглашению">Закрытый</span>'
      : `<button class="tiny-btn" data-act="clan-join" data-id="${c.id}">Вступить</button>`;
    return `<div class="simple-row clan-row">${clanCrest(c)}<div class="grow"><strong>${esc(c.name)}</strong><small>${esc(c.description || 'Клан арены')} · ${CLAN_TYPES[c.type] || 'Открытый'} · ур. ${c.level || 1}</small></div>${btn}</div>`;
  }).join('') || '<p class="muted">Пока нет кланов. Создайте первый!</p>';
}

function chatBox(scope) { return `<div class="chat-wrap"><div class="chat-list" id="chat-list" data-scope="${scope}"><div class="empty-state">Загрузка чата...</div></div><form class="chat-form" data-form="chat" data-scope="${scope}"><input class="field" name="body" maxlength="${scope === 'global' ? 200 : 300}" placeholder="${scope === 'global' ? 'Написать в общий чат...' : 'Написать клану...'}" autocomplete="off"><button class="btn btn-gold">Отправить</button></form></div>`; }
function pChat() { return head('ОБЩЕНИЕ', 'Чат', 'Общайтесь с игроками арены и просите фрагменты у соклановцев.') + `<div class="panel padded chat-page-panel"><div class="segmented"><button class="${S.chatTab === 'global' ? 'active' : ''}" data-act="chat-tab" data-id="global">Общий чат</button><button class="${S.chatTab === 'clan' ? 'active' : ''}" data-act="chat-tab" data-id="clan">Чат клана</button></div>${chatBox(S.chatTab)}</div>`; }
const clock = (s) => new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
async function loadChat() {
  const el = $('#chat-list'); if (!el || !S.data || !S.data.user) return;
  const scope = el.dataset.scope, r = await api('chat&scope=' + scope); if (!r.ok || $('#chat-list') !== el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60, j = r.j, me = U().id, d = D();
  if (j.noClan) { el.innerHTML = '<div class="empty-state">Вы не состоите в клане. Вступите в клан, чтобы общаться с соклановцами и просить у них фрагменты карт.</div>'; $('.chat-form', el.parentNode).style.display = 'none'; return; }
  el.innerHTML = j.messages.map((m) => {
    if (m.kind === 'request') {
      const rq = j.requests.find((x) => x.id === m.requestId), card = rq && cardById(rq.cardId);
      if (!rq || !card) return `<div class="cmsg"><p>${esc(m.body)}</p></div>`;
      const done = rq.received >= rq.amount, exp = new Date(rq.expiresAt).getTime() < Date.now(), mine = rq.userId === me, have = (ownedOf(rq.cardId) || {}).copies || 0;
      const label = mine ? 'Ваша просьба' : done ? 'Выполнено' : exp ? 'Истекла' : have < 1 ? 'Нет копий' : 'Дать 1 (у вас ' + have + ')';
      return `<div class="req-card"><div class="req-thumb">${art(card.image, card.name)}</div><div class="req-body"><span><button class="cmsg-user" data-act="profile-open" data-id="${rq.userId}">${esc(rq.username)}</button> просит фрагменты</span><span class="req-title">${esc(card.name)} <small>(${card.rarity})</small></span><div class="req-bar"><i style="width:${Math.min(100, rq.received / rq.amount * 100)}%"></i></div><div class="req-meta"><span>Получено ${rq.received} из ${rq.amount}</span><span>${clock(m.createdAt)}</span></div>${rq.donors.length ? '<div class="req-donors">Помогли: ' + rq.donors.map((x) => esc(x.username) + (x.count > 1 ? ' ×' + x.count : '')).join(', ') + '</div>' : ''}${!mine && !done && !exp ? '<div class="req-donors">Награда: +' + C.donateReward(card.rarity) + ' золота за копию</div>' : ''}</div><button class="tiny-btn" data-act="donate" data-id="${rq.id}" ${mine || done || exp || have < 1 ? 'disabled' : ''}>${label}</button></div>`;
    }
    return `<div class="cmsg ${m.userId === me ? 'mine' : ''}"><div class="cmsg-head"><button class="cmsg-user" data-act="profile-open" data-id="${m.userId}">${esc(m.username)}</button>${m.role === 'admin' ? '<span class="cbadge">АДМИН</span>' : ''}<small>${clock(m.createdAt)}</small></div><p>${esc(m.body)}</p></div>`;
  }).join('') || '<div class="empty-state">Здесь пока тихо. Напишите первым!</div>';
  if (near) el.scrollTop = el.scrollHeight;
}

function pFriends() {
  const d = D(), u = U(), fs = d.friendships, other = (f) => f.requesterId === u.id ? f.recipient : f.requester;
  return head('ВМЕСТЕ СИЛЬНЕЕ', 'Друзья', 'Находите игроков и собирайте команду.') + `<div class="panel padded friend-add"><h3>Добавить друга</h3><p class="muted">Найдите игрока по его точному имени.</p><form data-form="friendRequest"><input class="field" name="username" placeholder="Имя игрока" required><button class="btn btn-gold">Отправить заявку</button></form></div>
  <div class="two-columns"><div class="panel padded"><h3>Мои друзья</h3>${fs.filter((f) => f.status === 'accepted').map((f) => `<div class="simple-row"><span class="rank-avatar">${esc(other(f)[0])}</span><button class="simple-link grow" data-act="profile-open" data-id="${f.requesterId === u.id ? f.recipientId : f.requesterId}"><strong>${esc(other(f))}</strong></button><button class="tiny-btn danger" data-act="friend-remove" data-id="${f.id}">Удалить</button></div>`).join('') || '<div class="empty-state">Пока нет друзей. Пригласите кого-нибудь!</div>'}</div>
  <div class="panel padded"><h3>Заявки в друзья</h3>${fs.filter((f) => f.status === 'pending').map((f) => `<div class="simple-row"><span class="rank-avatar">${esc(f.requester[0])}</span><strong class="grow">${f.requesterId === u.id ? 'Вы → ' + esc(f.recipient) : esc(f.requester)}</strong>${f.recipientId === u.id ? `<button class="tiny-btn" data-act="friend-accept" data-id="${f.id}">Принять</button>` : '<span class="muted">Ожидание</span>'}<button class="tiny-btn danger" data-act="friend-remove" data-id="${f.id}">×</button></div>`).join('') || '<div class="empty-state">Новых заявок нет.</div>'}</div></div>`;
}
function pRanking() {
  const d = D(), u = U();
  return head('ЗАЛ СЛАВЫ', 'Таблица лидеров', 'Лучшие бойцы и кланы королевства.', 'СЕЗОН 01') + `<div class="panel ranking-panel"><div class="segmented"><button class="${S.rankTab === 'players' ? 'active' : ''}" data-act="rank-tab" data-id="players">Игроки</button><button class="${S.rankTab === 'clans' ? 'active' : ''}" data-act="rank-tab" data-id="clans">Кланы</button></div><div class="rank-list">${S.rankTab === 'players' ? d.leaderboard.map((p, i) => `<div class="rank-row ${p.id === u.id ? 'me' : ''} clickable" data-act="profile-open" data-id="${p.id}"><span class="rank-number pos-${i}">${String(i + 1).padStart(2, '0')}</span><div class="rank-avatar">${esc(p.username[0].toUpperCase())}</div><div class="rank-person"><strong>${esc(p.username)} ${p.id === u.id ? '<em>ВЫ</em>' : ''}</strong><small>${esc((d.clans.find((c) => c.id === p.clanId) || {}).name || 'Без клана')} · ${p.wins} побед</small></div><span class="rank-score">${ico('trophy', 22, 'trophy-icon')}${fmt(p.trophies)}</span></div>`).join('') : d.clans.map((c, i) => `<div class="rank-row clickable" data-act="nav" data-id="clan"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span>${clanCrest(c)}<div class="rank-person"><strong>${esc(c.name)}</strong><small>${esc(c.description || 'Клан бойцов арены')}</small></div><span class="rank-score">КЛАН</span></div>`).join('') || '<div class="empty-state">Пока нет кланов. Создайте первый!</div>'}</div></div>`;
}
function pHistory() {
  const h = D().history;
  return head('ПУТЬ ГЕРОЯ', 'История боёв', 'Все ваши победы и сражения в одном месте.') + `<div class="panel padded"><h3>Последние сражения</h3>${h.map((b) => `<div class="history-row"><span class="history-result ${b.result}">${b.result === 'win' ? 'ПОБЕДА' : b.result === 'draw' ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ'}</span><div class="grow">${b.opponentId ? `<button class="simple-link" data-act="profile-open" data-id="${b.opponentId}"><strong>Против: ${esc(b.opponent)}</strong></button>` : `<strong>Против: ${esc(b.opponent)}</strong>`}<small>${new Date(b.createdAt).toLocaleString('ru-RU')} · ${b.crowns} короны</small></div><div class="history-rewards"><span class="${b.trophies > 0 ? 'positive' : 'negative'}">${b.trophies > 0 ? '+' : ''}${b.trophies} кубков</span><small>+${b.gold} золота</small></div></div>`).join('') || '<div class="empty-state">Здесь появятся ваши бои. Отправляйтесь на арену!<br><button class="btn btn-green" data-act="nav" data-id="lobby">На арену</button></div>'}</div>`;
}

// ---------- модальные окна ----------
function modalHtml() {
  const m = S.modal; if (!m) return '';
  const d = D(), u = U();
  if (m.type === 'card') {
    const c = cardById(m.id), o = ownedOf(c.id), lv = o ? o.level : 1, mul = Math.pow(1.1, lv - 1), spell = c.kind === 'spell', inDeck = d.deck.includes(c.id), canAdd = !inDeck && d.deck.length < 8;
    const rows = [['Тип', C.kindLabel(c.kind)], ['Цели', C.targetLabel(c.targets, c.kind)]];
    if (!spell) rows.push(['Здоровье', fmt(Math.round(c.health * mul)) + (c.count > 1 ? ' × ' + c.count : '')]);
    rows.push([spell ? (c.ability === 'poison' ? 'Урон в секунду' : 'Урон') : 'Урон за удар', fmt(Math.round(c.damage * mul))]);
    if (!spell && c.damage > 0) rows.push(['Урон в секунду', fmt(Math.round(c.damage * mul / c.attackSpeed)) + (c.count > 1 ? ' × ' + c.count : '')], ['Скорость атаки', c.attackSpeed.toFixed(1) + ' с']);
    if (!spell && c.kind !== 'building') rows.push(['Скорость', C.speedLabel(c.speed)]);
    if (!spell && c.range > 1.6) rows.push(['Дальность', c.range.toFixed(1) + ' кл.']);
    if (c.splash > 0) rows.push([spell ? 'Радиус' : 'Урон по площади', c.splash.toFixed(1) + ' кл.']);
    if (c.kind === 'building') rows.push(['Время жизни', c.lifetime + ' с']);
    return `<div class="modal-backdrop" data-act="close-modal-bg"><div class="card-modal wide"><button class="close-btn" data-act="close-modal">×</button><div class="card-modal-head"><span class="eyebrow">${esc(c.rarity.toUpperCase())} · ${esc(c.role.toUpperCase())}</span><h2>${esc(c.name)}${o ? ' · уровень ' + lv : ''}</h2></div>
    <div class="card-modal-body">${tile(c, { locked: !o, level: lv, copies: o ? o.copies : 0, act: 'noop' })}<div class="card-details"><p>${esc(c.description)}</p>${rows.map((r) => `<div class="detail-stat"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}</div></div>
    <div class="proscons"><div class="pros"><h4>Сильные стороны</h4><p>${esc(c.pros)}</p></div><div class="cons"><h4>Слабые стороны</h4><p>${esc(c.cons)}</p></div></div>
    ${o ? `<div class="deck-swap"><h4>${inDeck ? 'Эта карта уже в вашей колоде' : canAdd ? 'В колоде есть свободное место' : 'Поставить в колоду вместо:'}</h4>${canAdd ? `<button class="btn btn-outline" data-act="deck-add" data-id="${c.id}">Добавить в колоду</button>` : ''}${!inDeck && !canAdd ? `<div class="deck-swap-row">${deckCards().map((x) => `<button title="${esc(x.name)}" data-act="deck-swap" data-id="${c.id}" data-out="${x.id}">${art(x.image, x.name)}<span>${x.cost}</span></button>`).join('')}</div>` : ''}</div>` : ''}
    <div class="card-modal-foot">${o ? `<span>Улучшение: ${lv * 10} копий (у вас ${o.copies}) и ${fmt(lv * 500)} золота</span><button class="btn btn-green" data-act="upgrade" data-id="${c.id}">Улучшить</button>` : `<span>Карта ещё не открыта</span><button class="btn btn-gold" data-act="buy" data-id="${c.id}"><i class="coin-icon"></i>${C.cardPrice(c.rarity)} · Купить</button>`}</div></div></div>`;
  }
  if (m.type === 'request') {
    const own = new Map(d.owned.map((o) => [o.cardId, o]));
    return `<div class="modal-backdrop" data-act="close-modal-bg"><div class="card-modal wide"><button class="close-btn" data-act="close-modal">×</button><div class="card-modal-head"><span class="eyebrow">ПОМОЩЬ КЛАНА</span><h2>Попросить фрагмент</h2></div><p class="req-help">Выберите карту: просьба появится в чате клана, а соклановцы смогут подарить вам копии. Просить можно раз в ${d.requestCooldownMinutes} мин.</p><div class="req-grid">${d.cards.filter((c) => own.has(c.id)).map((c) => `<div class="req-cell">${tile(c, { level: own.get(c.id).level, copies: own.get(c.id).copies, act: 'req-pick' })}<span>до ${C.requestAmount(c.rarity)} шт.</span></div>`).join('')}</div></div></div>`;
  }
  if (m.type === 'compose') return `<div class="modal-backdrop" data-act="close-modal-bg"><div class="card-modal"><button class="close-btn" data-act="close-modal">×</button>
    <div class="card-modal-head"><span class="eyebrow">ПОЧТА</span><h2>Написать ${esc(m.username || 'игроку')}</h2></div>
    <p class="req-help">Письмо придёт в раздел «Почта». Не чаще 3 писем в минуту.</p>
    <form class="form-stack" data-form="profileMail"><input type="hidden" name="userId" value="${m.userId || 0}">
    <input class="field" name="title" placeholder="Тема" maxlength="80" required>
    <textarea class="field" name="body" rows="4" placeholder="Сообщение" maxlength="500" required></textarea>
    <button class="btn btn-gold" type="submit">Отправить письмо</button></form></div></div>`;

  if (m.type === 'reveal') return `<div class="modal-backdrop" data-act="close-modal-bg"><div class="chest-reveal-modal"><button class="close-btn" data-act="close-modal">×</button><div class="chest-burst"><img src="images/chest.jpg" alt="Открытый сундук"></div><span class="eyebrow">СОДЕРЖИМОЕ СУНДУКА</span><h2>${esc(m.title)}</h2><div class="loot-grid">${m.rewards.map((r) => { const it = r.kind === 'cosmetic' ? catalogBy(String(r.image), r.name) : null; return `<div class="loot-item loot-${r.kind}">${r.kind === 'card' && r.image ? art(r.image, r.name) : ''}${it ? cosView(it, 'sm') : ''}<b>${esc(r.name)}</b><span>${r.kind === 'card' ? '×' + r.amount : r.kind === 'gold' ? '+' + r.amount + ' золота' : r.kind === 'gems' ? '+' + r.amount + ' кристаллов' : r.kind === 'wildcard' || r.kind === 'evolution' ? '×' + r.amount : r.kind === 'cosmetic' ? 'Новая косметика' : ''}</span></div>`; }).join('')}</div><button class="btn btn-gold full" data-act="close-modal">Забрать награды</button></div></div>`;
  return '';
}

// ---------- отрисовка ----------
function render() {
  const app = $('#app');
  if (!S.data) return;
  if (!S.data.user) { app.innerHTML = pageAuth(); modalRoot(); return; }
  const scroll = window.scrollY, ae = document.activeElement, keep = ae && ae.form ? null : null;
  app.innerHTML = shell(); modalRoot();
  window.scrollTo(0, scroll);
  if (S.nav === 'admin') CF.adminInit(); else if ($('#chat-list')) loadChat();
}
function modalRoot() {
  let el = $('#modal-root'); if (!el) { el = document.createElement('div'); el.id = 'modal-root'; document.body.appendChild(el); }
  el.innerHTML = S.data && S.data.user ? modalHtml() : '';
}
CF.render = render;
function go(n) { S.nav = n; S.more = false; closeMenus(); render(); window.scrollTo({ top: 0 }); if (n !== 'admin' && S.data && S.data.user) refresh(); }

// ---------- бой ----------
function randomRival() {
  const pick = (t) => { const l = D().cosmeticCatalog.filter((c) => c.type === t); return l.length ? l[Math.floor(Math.random() * l.length)] : null; };
  const b = Math.random() < 0.7 ? pick('banner') : null, t = Math.random() < 0.5 ? pick('towerSkin') : null;
  const em = D().cosmeticCatalog.filter((c) => c.type === 'emote').sort(() => Math.random() - 0.5).slice(0, 3);
  return { look: sideLook(t && t.name, b && b.name), emotes: emoteDefs(em.map((x) => x.name)) };
}
function sideLook(tower, banner) {
  const t = tower && tower !== 'classic' ? catalogBy('towerSkin', tower) : null, b = banner ? catalogBy('banner', banner) : null;
  return { tower: t ? [t.color1, t.color2] : undefined, banner: b ? { c1: b.color1, c2: b.color2, label: b.label } : undefined };
}
function emoteDefs(names) { return (names || []).map((n) => catalogBy('emote', n)).filter(Boolean).map((c) => ({ name: c.name, label: c.label || c.name, color: c.color1 })); }
function battleCards(ids, levels) { return ids.map((id) => { const c = cardById(id); return c ? Object.assign({}, c, { level: (levels && levels[id]) || 1 }) : null; }).filter(Boolean); }
async function battleStartRequest(payload) {
  let r = await api('game', payload);
  if (!r.ok && r.j && r.j.stuck) {
    if (!confirm((r.j.error || 'Предыдущий бой завис.') + '\n\nСбросить зависший бой и начать новый?')) return null;
    const c = await api('game', { action: 'battleCancel' });
    if (!c.ok) { toast(c.j.error || 'Не удалось сбросить бой.'); return null; }
    r = await api('game', payload);
  }
  if (r.status === 401) { await refresh(); }
  if (!r.ok) { toast(r.j.error || 'Не удалось начать бой.'); return null; }
  await refresh();
  return r.j;
}
async function startBattle(mode) {
  if (D().deck.length !== 8) { toast('Соберите колоду ровно из 8 карт.'); go('cards'); return; }
  if (!(await battleStartRequest({ action: 'battleStart', mode }))) return;
  const d = D(), own = new Map(d.owned.map((o) => [o.cardId, o.level]));
  const deck = battleCards(d.deck, Object.fromEntries(own)), lvls = deck.map((c) => c.level), avg = Math.max(1, Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length));
  S.rival = randomRival();
  CF.runBattle({ deck, allCards: d.cards.map((c) => Object.assign({}, c, { level: 1 })), level: avg, difficulty: d.arena.difficulty, pvp: false, opponentName: null, cosmetics: { own: sideLook(U().towerSkin, U().bannerSkin), rival: S.rival.look, emotes: emoteDefs(U().equippedEmotes), rivalEmotes: S.rival.emotes } });
}
function pvpCfg(o) {
  const d = D(), own = Object.fromEntries(d.owned.map((x) => [x.cardId, x.level])), deck = battleCards(d.deck, own);
  const avg = deck.length ? Math.max(1, Math.round(deck.reduce((a, c) => a + c.level, 0) / deck.length)) : 1;
  return { deck, allCards: battleCards(o.deck, o.levels), level: avg, difficulty: 5, pvp: true, opponentName: o.username,
    cosmetics: { own: sideLook(U().towerSkin, U().bannerSkin), rival: sideLook(o.towerSkin, o.bannerSkin), emotes: emoteDefs(U().equippedEmotes), rivalEmotes: emoteDefs(o.emotes) } };
}
async function startPvp() {
  if (D().deck.length !== 8) { toast('Соберите колоду ровно из 8 карт.'); go('cards'); return; }
  const r = await api('game', { action: 'pvpFind' });
  if (!r.ok) { toast(r.j.error || 'Не удалось найти противника.'); return; }
  const o = r.j.opponent;
  if (!(await battleStartRequest({ action: 'battleStart', mode: 'pvp', opponentId: o.id }))) return;
  CF.runBattle(pvpCfg(o));
}
async function startDuel(o) {
  if (!o) { toast('Соперник недоступен для дуэли.'); return; }
  if (D().deck.length !== 8) { toast('Соберите колоду ровно из 8 карт.'); go('cards'); return; }
  if (!(await battleStartRequest({ action: 'battleStart', mode: 'pvp', opponentId: o.id }))) return;
  CF.runBattle(pvpCfg(o));
}
CF.finishBattle = async function (result, crowns, opponent, lost) {
  const r = await api('game', { action: 'battle', result, crowns, opponent, crownsLost: lost || 0 });
  return r.ok ? { reward: r.j.reward, chest: r.j.chest } : { error: r.j.error || 'Ошибка' };
};
CF.exitBattle = function () { refresh(); };

// ---------- обработчики ----------
async function act(name, el, ev) {
  const id = el.dataset.id, d = S.data;
  switch (name) {
    case 'noop': return;
    case 'toast-x': $('#toast-root').innerHTML = ''; return;
    case 'nav': if (id === 'profile') { closeMenus(); return openProfile(U().id); } return go(id);
    case 'more': return toggleMenu('more');
    case 'menu': return toggleMenu(id);
    case 'menu-close': return closeMenus();
    case 'logout': await api('auth', { action: 'logout' }); S.data.user = null; S.nav = 'lobby'; S.authMode = 'login'; await refresh(); return;
    case 'auth-mode': S.authMode = id; S.authError = ''; return render();
    case 'battle': return startBattle('ladder');
    case 'battle-tournament': return startBattle('tournament');
    case 'pvp-find': return startPvp();
    case 'pvp-seen': return void action({ action: 'pvpSeen' }, true);
    case 'profile-me': return openProfile(U().id);
    case 'profile-open': return openProfile(+id);
    case 'clan-rank': return void action({ action: 'clanRank', userId: +id, rank: el.dataset.rank });
    case 'gift': return void action({ action: 'gift' });
    case 'clan-invite': return void action({ action: 'clanInvite', userId: +id });
    case 'clan-invite-answer': return void action({ action: 'clanInviteAnswer', id: +id, accept: el.dataset.accept === '1' });
    case 'badges-open': S.badgeModal = true; S.badgePick = (S.profile && S.profile.badges || []).map((b) => b.key); return render();
    case 'badges-close': S.badgeModal = false; S.badgePick = null; return render();
    case 'badges-close-bg': if (ev && ev.target === el) { S.badgeModal = false; S.badgePick = null; } return;
    case 'badge-toggle': {
      const key = el.dataset.key; S.badgePick = S.badgePick || (S.profile.badges || []).map((b) => b.key);
      const i = S.badgePick.indexOf(key);
      if (i >= 0) S.badgePick.splice(i, 1);
      else { if (S.badgePick.length >= 8) { toast('Можно выбрать не более 8 значков.'); return; } S.badgePick.push(key); }
      const all = S.profile.badgesAll, cnt = document.getElementById('badge-count');
      if (cnt) cnt.textContent = S.badgePick.length;
      document.querySelectorAll('.badge-pick').forEach((b) => b.classList.toggle('on', S.badgePick.includes(b.dataset.key)));
      const sb = document.querySelector('[data-act="badges-save"]'); if (sb) sb.disabled = S.badgePick.length === 0;
      return;
    }
    case 'badges-save': { const keys = S.badgePick || []; await action({ action: 'badgesSaveKeys', keys }); S.badgeModal = false; S.badgePick = null; return openProfile(S.profileId); }
    case 'fav-set': return void action({ action: 'favoriteCard', cardId: +id }).then(() => openProfile(S.profileId));
    case 'mail-open': {
      const mid = +id, m = (D().mail || []).find((x) => x.id === mid); S.mailOpen = S.mailOpen === mid ? null : mid;
      const wasNew = m && !m.read; if (wasNew) m.read = true; render();
      if (wasNew) api('game', { action: 'mailRead', id: mid });
      return;
    }
    case 'mail-claim': return void action({ action: 'mailClaim', id: +id });
    case 'mail-claim-all': return void action({ action: 'mailClaimAll' });
    case 'mail-delete': { if (S.mailOpen === +id) S.mailOpen = null; return void action({ action: 'mailDelete', id: +id }); }
    case 'mg-tab': S.mgTab = id; return render();
    case 'mg-bet': S.mgBet = +id; return render();
    case 'dice-choice': S.mgDice = id; return render();
    case 'slot-spin': {
      if (S.mgBusy) return;
      S.mgBusy = true; render();
      const reels = () => Array.from(document.querySelectorAll('.mg-reel'));
      const timer = setInterval(() => { reels().forEach((el) => { const c = MG_SYMS[Math.floor(Math.random() * MG_SYMS.length)]; el.innerHTML = slotSym(c); }); }, 90);
      const t0 = Date.now();
      const r = await api('game', { action: 'slotSpin', bet: S.mgBet });
      await new Promise((res) => setTimeout(res, Math.max(0, 1000 - (Date.now() - t0))));
      clearInterval(timer);
      S.mgBusy = false;
      if (!r.ok) { toast(r.j.error || 'Ошибка'); if (r.status === 401) await refresh(); render(); return; }
      S.slotRes = { reels: r.j.reels, win: r.j.win, bet: r.j.bet };
      const g = await api('game'); if (g.ok) S.data = g.j;
      render();
      toast(r.j.message || (r.j.win > 0 ? 'Выигрыш!' : 'Не повезло'));
      return;
    }
    case 'dice-roll': {
      if (S.mgBusy) return;
      S.mgBusy = true; render();
      const t0 = Date.now();
      const r = await api('game', { action: 'diceRoll', bet: S.mgBet, choice: S.mgDice });
      await new Promise((res) => setTimeout(res, Math.max(0, 850 - (Date.now() - t0))));
      S.mgBusy = false;
      if (!r.ok) { toast(r.j.error || 'Ошибка'); if (r.status === 401) await refresh(); render(); return; }
      S.diceRes = { dice: r.j.dice, sum: r.j.sum, win: r.j.win, bet: r.j.bet };
      const g = await api('game'); if (g.ok) S.data = g.j;
      render();
      toast(r.j.message || (r.j.win > 0 ? 'Выигрыш!' : 'Мимо'));
      return;
    }
    case 'bj-start': {
      if (S.mgBusy) return;
      S.mgBusy = true;
      const r = await api('game', { action: 'bjStart', bet: S.mgBet });
      S.mgBusy = false;
      if (!r.ok) { toast(r.j.error || 'Ошибка'); if (r.status === 401) await refresh(); render(); return; }
      S.bj = r.j;
      const g = await api('game'); if (g.ok) S.data = g.j;
      render();
      if (r.j.done) toast(r.j.message || 'Партия завершена.');
      return;
    }
    case 'bj-hit': case 'bj-stand': {
      if (S.mgBusy) return;
      S.mgBusy = true;
      const r = await api('game', { action: name === 'bj-hit' ? 'bjHit' : 'bjStand' });
      S.mgBusy = false;
      if (!r.ok) { toast(r.j.error || 'Ошибка'); if (r.status === 401) { await refresh(); } else { S.bj = null; render(); } return; }
      S.bj = r.j;
      const g = await api('game'); if (g.ok) S.data = g.j;
      render();
      if (r.j.done) toast(r.j.message || 'Партия завершена.');
      return;
    }
    case 'quest-claim': return void action({ action: 'questClaim', questId: +id });
    case 'card-info': S.modal = { type: 'card', id: +id }; return modalRoot();
    case 'close-modal': S.modal = null; return modalRoot();
    case 'close-modal-bg': if (ev && ev.target === el) { S.modal = null; modalRoot(); } return;
    case 'upgrade': return void action({ action: 'upgrade', cardId: +id });
    case 'buy': return void action({ action: 'buy', cardId: +id });
    case 'deck-slot': S.deckSlot = +id; return render();
    case 'deck-pick': case 'deck-swap': case 'deck-add': {
      const cid = +id, next = d.deck.slice();
      if (name === 'deck-add') next.push(cid);
      else if (name === 'deck-swap') { const k = next.indexOf(+el.dataset.out); if (k >= 0) next[k] = cid; }
      else { const slot = S.deckSlot, at = next.indexOf(cid); if (at === slot) return toast('Эта карта уже стоит в выбранном слоте.'); if (at >= 0) { next[at] = next[slot]; next[slot] = cid; } else next[slot] = cid; }
      const c = cardById(cid), ok = await action({ action: 'setDeck', deck: next }, true);
      if (ok) { if (name === 'deck-pick') S.deckSlot = (S.deckSlot + 1) % 8; S.modal = null; modalRoot(); render(); toast('Колода сохранена: ' + c.name + '.'); } else toast('Не удалось сохранить колоду.');
      return;
    }
    case 'shop-filter': S.shopFilter = id; return render();
    case 'rank-tab': S.rankTab = id; return render();
    case 'chat-tab': S.chatTab = id; return render();
    case 'buy-chest': return void action({ action: 'buyChest', type: id });
    case 'open-chest': {
      const r = await api('game', { action: 'openChest', chestId: +id });
      if (!r.ok) return toast(r.j.error || 'Не удалось открыть сундук.');
      S.modal = { type: 'reveal', title: CHEST_TITLE[el.dataset.type] || 'Сундук', rewards: r.j.rewards || [] }; await refresh(); return;
    }
    case 'equip': return void action({ action: 'equipCosmetic', type: el.dataset.type, name: el.dataset.name, unequip: el.dataset.off === '1' });
    case 'league-claim': return void action({ action: 'leagueClaim' });
    case 'tournament-claim': return void action({ action: 'tournamentClaim' });
    case 'req-open': {
      const u = U(); if (!u.clanId) { toast('Чтобы просить фрагменты, вступите в клан.'); return go('clan'); }
      const rc = reqClock(); if (rc.left > 0) return toast('Следующую просьбу можно отправить через ' + rc.text + '.');
      S.modal = { type: 'request' }; return modalRoot();
    }
    case 'req-pick': { const ok = await action({ action: 'requestCards', cardId: +id }); if (ok) { S.modal = null; modalRoot(); } return; }
    case 'clan-join': return void action({ action: 'joinClan', clanId: +id });
    case 'clan-emblem': return void action({ action: 'clanUpdate', badge: id });
    case 'compose-mail': S.modal = { type: 'compose', userId: +id, username: el.dataset.name || '' }; return modalRoot();
    case 'duel-offer': { const r = await action({ action: 'duelOffer', userId: +id }); if (r) await openProfile(+id); return; }
    case 'duel-accept': {
      const r = await action({ action: 'duelAccept', id: +id });
      if (!r) return;
      const info = (S.profile && S.profile.duel && S.profile.duel.info) || null;
      await openProfile(S.profileId);
      startDuel((S.profile && S.profile.duel && S.profile.duel.info) || info);
      return;
    }
    case 'duel-decline': { const r = await action({ action: 'duelDecline', id: +id }); if (r) await openProfile(S.profileId); return; }
    case 'duel-start': { const dl = S.profile && S.profile.duel; if (dl && dl.info) startDuel(dl.info); else toast('Соперник недоступен.'); return; }
    case 'clan-leave': if (confirm('Покинуть клан?')) action({ action: 'leaveClan' }); return;
    case 'donate': { const ok = await action({ action: 'donate', requestId: +id }); loadChat(); return; }
    case 'friend-accept': return void action({ action: 'acceptFriend', id: +id });
    case 'friend-remove': return void action({ action: 'removeFriend', id: +id });
    default: if (name.indexOf('admin-') === 0) return CF.adminAct(name, el);
  }
}
document.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (!t || t.disabled) return; if (t.tagName === 'A') e.preventDefault(); act(t.dataset.act, t, e).catch((er) => { console.error(er); toast('Что-то пошло не так.'); }); });
document.addEventListener('input', (e) => { if (e.target.id === 'clan-search') $('#clan-list').innerHTML = clanList(e.target.value); });
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  const fd = Object.fromEntries(new FormData(f)), kind = f.dataset.form;
  if (kind.indexOf('admin-') === 0) return CF.adminSubmit(kind, fd, f);
  if (kind === 'auth') {
    const r = await api('auth', Object.assign({ action: S.authMode }, fd));
    if (!r.ok) { S.authError = r.j.error || 'Не удалось войти.'; let er = $('.form-error'); if (!er) { er = document.createElement('div'); er.className = 'form-error'; f.querySelector('button[type=submit]').before(er); } er.textContent = S.authError; return; }
    S.authError = ''; S.nav = 'lobby'; await refresh(); return;
  }
  if (kind === 'chat') {
    const r = await api('chat', { scope: f.dataset.scope, body: fd.body });
    if (!r.ok) return toast(r.j.error || 'Не удалось отправить сообщение.');
    f.reset(); const el = $('#chat-list'); if (el) { el.scrollTop = el.scrollHeight; } loadChat(); return;
  }
  if (kind === 'createClan') { await action(Object.assign({ action: 'createClan' }, fd)); return; }
  if (kind === 'friendRequest') { if (await action({ action: 'friendRequest', username: fd.username })) return; }
  if (kind === 'profileMail') { const r = await action(Object.assign({ action: 'profileMail' }, fd)); if (r) { S.modal = null; modalRoot(); } return; }
  if (kind === 'clanSettings') { await action(Object.assign({ action: 'clanUpdate' }, fd)); return; }
});
setInterval(() => { if (!document.hidden) loadChat(); }, 4000);
setInterval(() => { const b = $('#req-btn'); if (b && S.data && S.data.user) { const rc = reqClock(); b.textContent = rc.left > 0 ? 'Попросить через ' + rc.text : 'Попросить фрагмент'; } }, 1000);

// ---------- выпадающие меню ----------
function closeMenus() { document.querySelectorAll('.dd-menu.open,.fit-more.open').forEach((m) => m.classList.remove('open')); const b = $('.dd-backdrop'); if (b) b.classList.remove('open'); document.querySelectorAll('[data-act="menu"].on').forEach((x) => x.classList.remove('on')); }
function toggleMenu(id) {
  const m = $('#dd-' + id); if (!m) return;
  const wasOpen = m.classList.contains('open'); closeMenus();
  if (!wasOpen) { m.classList.add('open'); const b = $('.dd-backdrop'); if (b) b.classList.add('open'); document.querySelectorAll(`[data-act="menu"][data-id="${id}"]`).forEach((x) => x.classList.add('on')); }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
document.addEventListener('click', (e) => { if (!e.target.closest('.fit-more')) document.querySelectorAll('.fit-more.open').forEach((m) => m.classList.remove('open')); });

// Строки вкладок, которые не помещаются, получают красивое выпадающее «Ещё ▾».
let fitting = false;
function fitRow(row) {
  row.querySelectorAll(':scope > .fit-more').forEach((n) => n.remove());
  const items = Array.from(row.children).filter((c) => c.tagName === 'BUTTON');
  items.forEach((b) => b.classList.remove('fit-hidden'));
  row.classList.add('fit-row');
  if (row.scrollWidth <= row.clientWidth + 1 || items.length < 3) return;
  const wrap = document.createElement('div'); wrap.className = 'fit-more';
  wrap.innerHTML = '<button type="button" class="fit-more-btn">Ещё <i>▾</i></button><div class="fit-menu"></div>';
  row.appendChild(wrap);
  for (let i = items.length - 1; i >= 0 && row.scrollWidth > row.clientWidth + 1; i--) { if (!items[i].classList.contains('active')) items[i].classList.add('fit-hidden'); }
  const hidden = items.filter((b) => b.classList.contains('fit-hidden')), menu = wrap.querySelector('.fit-menu');
  if (!hidden.length) { wrap.remove(); return; }
  hidden.forEach((b) => { const c = document.createElement('button'); c.type = 'button'; c.textContent = b.textContent.trim(); c.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.remove('open'); b.click(); }); menu.appendChild(c); });
  wrap.querySelector('.fit-more-btn').addEventListener('click', (e) => { e.stopPropagation(); const o = wrap.classList.contains('open'); document.querySelectorAll('.fit-more.open').forEach((x) => x.classList.remove('open')); if (!o) wrap.classList.add('open'); });
}
function fitAll() { if (fitting) return; fitting = true; try { document.querySelectorAll('#app .filter-row, #app .admin-tabs').forEach(fitRow); } finally { fitObs.takeRecords(); fitting = false; } }
let fitRaf = 0;
const fitObs = new MutationObserver(() => { if (fitting) return; clearTimeout(fitRaf); fitRaf = setTimeout(fitAll, 30); });
window.addEventListener('resize', () => { clearTimeout(fitRaf); fitRaf = setTimeout(fitAll, 30); });

// Таймеры на главной (подарок дня)
setInterval(() => {
  document.querySelectorAll('[data-countdown]').forEach((n) => { const left = +n.dataset.countdown - Date.now(); if (left <= 0) { n.removeAttribute('data-countdown'); if (S.data && S.data.user && S.nav === 'lobby') render(); } else n.textContent = n.dataset.long ? dhm(left) : hm(left); });
}, 1000);

CF.boot = async function (pre) { fitObs.observe($('#app'), { childList: true, subtree: true }); const r = pre ? { ok: true, j: pre } : await api('game'); if (r.ok) { S.data = r.j; render(); fitAll(); } else $('#app').innerHTML = '<div class="boot-error">Не удалось загрузить игру: ' + esc(r.j.error || '') + '</div>'; };
})();
