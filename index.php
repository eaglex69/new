<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
if (!installed()) { header('Location: install.php'); exit; }
// Вход по одноразовой ссылке, созданной администратором
if (isset($_GET['login'])) {
    $t = row('SELECT user_id FROM login_tokens WHERE token=? AND expires_at > ?', [(string)$_GET['login'], now_s()]);
    $u = $t ? row('SELECT id,banned FROM users WHERE id=?', [$t['user_id']]) : null;
    if ($u && !$u['banned']) login_user((int)$u['id']);
    header('Location: index.php'); exit;
}
header('Cache-Control: no-store');
?><!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Crownfall — Королевская арена</title>
<meta name="description" content="Соберите колоду, сражайтесь на арене, создавайте кланы и станьте легендой Crownfall.">
<meta name="theme-color" content="#0a5fa8">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="data:,">
<link rel="preload" as="image" href="images/loading.jpg">
<link rel="stylesheet" href="css/app.css?v=15"></head><body>
<div id="app"><div class="boot-shell"><div class="boot-screen" id="boot">
  <div class="boot-art"></div><div class="boot-shade"></div>
  <div class="boot-hint">Сундуки за победы и бесплатные сундуки зависят от вашей текущей арены</div>
  <div class="boot-bottom">
    <div class="boot-tip" id="boot-tip">Загружаем королевство…</div>
    <div class="boot-bar"><i id="boot-fill"></i><b id="boot-pct">0%</b></div>
    <div class="boot-step" id="boot-step">Подключение к серверу</div>
  </div>
</div></div></div>
<div id="toast-root"></div>
<script>
/* AJAX-загрузчик: качает скрипты, состояние игры и картинки с реальным процентом. */
(function () {
  'use strict';
  var V = '15';
  var tips = ['Совет: держите в колоде дешёвые карты для быстрых контратак.', 'Совет: эликсир копится сам — не тратьте всё сразу.', 'Совет: забирайте ежедневный подарок каждый день.', 'Совет: в клане можно просить карты у друзей.', 'Совет: лиги сбрасываются раз в месяц — успейте забрать сундук.'];
  var el = function (id) { return document.getElementById(id); };
  var tipI = 0, tipT = setInterval(function () { tipI = (tipI + 1) % tips.length; var t = el('boot-tip'); if (t) t.textContent = tips[tipI]; }, 2600);
  el('boot-tip').textContent = tips[0];

  // Каждая задача: вес и доля выполнения 0..1
  var tasks = [];
  function task(w) { var t = { w: w, p: 0 }; tasks.push(t); return t; }
  var target = 0, shown = 0, finished = false;
  function recalc() { var tw = 0, d = 0; tasks.forEach(function (t) { tw += t.w; d += t.w * t.p; }); target = tw ? d / tw : 0; }
  function frame() {
    shown += Math.max((target - shown) * 0.12, finished ? 0.02 : 0); if (target - shown < 0.002) shown = target;
    var pct = Math.min(100, Math.floor(shown * 100));
    el('boot-fill').style.width = pct + '%'; el('boot-pct').textContent = pct + '%';
    if (!finished || shown < 0.999) setTimeout(frame, 16);
  }
  frame();
  function step(t) { var s = el('boot-step'); if (s) s.textContent = t; }

  function xhr(url, type, t) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.setRequestHeader('X-Requested-With', 'fetch');
      x.withCredentials = true;
      x.onprogress = function (e) { t.p = e.lengthComputable && e.total ? Math.min(0.98, e.loaded / e.total) : Math.min(0.9, t.p + 0.15); recalc(); };
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) { t.p = 1; recalc(); resolve(type === 'json' ? JSON.parse(x.responseText) : x.responseText); }
        else { var m = 'HTTP ' + x.status; try { m = JSON.parse(x.responseText).error || m; } catch (e) {} reject(new Error(m)); }
      };
      x.onerror = function () { reject(new Error('Нет соединения с сервером')); };
      x.send();
    });
  }
  function img(src, t) {
    return new Promise(function (resolve) { var i = new Image(); i.onload = i.onerror = function () { t.p = 1; recalc(); resolve(); }; i.src = src; });
  }

  var scripts = [['js/engine.js', 8], ['js/app.js', 6], ['js/battle.js', 2], ['js/admin.js', 3]];
  var sTasks = scripts.map(function (s) { return task(s[1]); });
  var stateTask = task(6);
  var baseImgs = ['images/arena.jpg', 'images/chest.jpg'];
  var baseTasks = baseImgs.map(function () { return task(3); });
  var cardTask = task(6);

  function fail(err) {
    finished = true; clearInterval(tipT);
    step('Ошибка: ' + (err && err.message ? err.message : err));
    var b = document.querySelector('.boot-bottom');
    if (b && !b.querySelector('button')) { var r = document.createElement('button'); r.className = 'boot-retry'; r.textContent = 'Повторить'; r.onclick = function () { location.reload(); }; b.appendChild(r); }
  }

  step('Загрузка ресурсов игры');
  var codeP = Promise.all(scripts.map(function (s, i) { return xhr(s[0] + '?v=' + V, 'text', sTasks[i]); }));
  var stateP = xhr('api.php?r=game', 'json', stateTask);
  var imgP = Promise.all(baseImgs.map(function (src, i) { return img(src, baseTasks[i]); }));

  stateP.then(function (data) {
    step('Загрузка карт');
    var seen = {}, list = [];
    (data.cards || []).forEach(function (c) { var src = String(c.image || '').split('@')[0].replace(/^\//, ''); if (src && !seen[src]) { seen[src] = 1; list.push(src); } });
    if (!list.length) { cardTask.p = 1; recalc(); return data; }
    var done = 0;
    return Promise.all(list.map(function (src) { return new Promise(function (res) { var i = new Image(); i.onload = i.onerror = function () { done++; cardTask.p = done / list.length; recalc(); res(); }; i.src = src; }); })).then(function () { return data; });
  }).catch(function (e) { throw e; });

  Promise.all([codeP, stateP, imgP]).then(function (res) {
    step('Запуск арены');
    res[0].forEach(function (code, i) { var sc = document.createElement('script'); sc.text = code + '\n//# sourceURL=' + scripts[i][0]; document.body.appendChild(sc); });
    var data = res[1];
    // ждём картинки карт, но не дольше 4 секунд
    var cardWait = new Promise(function (r) { var t0 = Date.now(); (function chk() { if (cardTask.p >= 1 || Date.now() - t0 > 4000) { cardTask.p = 1; recalc(); r(); } else setTimeout(chk, 80); })(); });
    return cardWait.then(function () {
      finished = true; target = 1;
      return new Promise(function (r) { (function wait() { if (shown >= 0.995) r(); else setTimeout(wait, 40); })(); });
    }).then(function () {
      clearInterval(tipT);
      var boot = el('boot'); if (boot) boot.classList.add('boot-done');
      setTimeout(function () { window.CF.boot(data); }, 380);
    });
  }).catch(fail);
})();
</script>
</body></html>
