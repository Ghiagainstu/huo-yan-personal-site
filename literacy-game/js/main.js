/*
 * main.js — 核心循环状态机 + 指针交互 + 音频占位（Web 垂直切片原型）
 * 依赖（均为 classic script 全局）：Tolerance, Tracing, Rhythm, Storage,
 *   STROKE_DATA, CHAR_META, Render。
 *
 * 循环：Home → 认字(字精灵占位+汉字+拼音+释义) → 描红(幽灵粉引导+珊瑚红描红,
 *        逐笔判定+笔顺校验,实时 C/D) → 结算(星级+鼓励占位,更新 P) →
 *        节奏调度(用 rhythm 分配次日复习) → 存档(localStorage 断点续学)。
 */
(function () {
  'use strict';

  var Tolerance = window.Tolerance, Tracing = window.Tracing, Rhythm = window.Rhythm,
      Storage = window.Storage, Render = window.Render;
  var STROKE_DATA = window.STROKE_DATA, CHAR_META = window.CHAR_META;

  // ---------- 画布 / DPR ----------
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var controls = document.getElementById('controls');
  var LOGICAL_W = 480, LOGICAL_H = 600;

  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();
  window.addEventListener('resize', setupCanvas);

  // ---------- 状态 ----------
  var save = Storage.load();
  var dayOffset = 0;                                  // 调试：模拟"明天"
  var ALL_CHARS = Object.keys(STROKE_DATA).sort();    // 按表序（= hex 排序）
  var plan = null, taskIndex = 0;
  var screen = 'HOME';
  var currentHex = null, currentData = null, currentMeta = null;
  var order = [];
  var doneCount = 0;
  var perStroke = [];     // 成功笔画的 {C,D}
  var written = [];       // 成功笔画的用户轨迹点（1024 空间），用于"写满"效果
  var drawing = false, activePointer = null;
  var curPts = [];        // 当前笔画点（1024 空间）
  var liveCD = null;      // {C,D,pass}
  var lastStrokeFailed = false;
  var message = '';
  var demo = { active: false, strokeIdx: 0, t0: 0 };
  var resultStars = 0, resultAvgC = 0, resultAvgD = 0, resultMsg = '';

  // ---------- 工具 ----------
  function pad2(n) { return ('0' + n).slice(-2); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function getToday() { return Rhythm.addDays(todayStr(), dayOffset); }
  function currentP() {
    var r = save.characters[currentHex];
    return r ? (r.proficiency || 0) : 0;
  }
  function mediansOf(si) {
    return currentData.strokes[si].waypoints.map(function (w) { return [w[0] * 1024, w[1] * 1024]; });
  }

  // ---------- 节奏：确保当日任务 ----------
  function ensurePlan() {
    if (save.daily_task && save.daily_task.date === getToday()) {
      plan = save.daily_task;
    } else {
      plan = Rhythm.allocatePlan({
        today: getToday(), allChars: ALL_CHARS,
        learned: save.characters, newPerDay: save.settings.new_per_day
      });
      save.daily_task = plan;
      Storage.save(save);
    }
    taskIndex = 0;
  }

  // ---------- 导航 ----------
  function goHome() { screen = 'HOME'; ensurePlan(); buildControls(); }

  function startTask() {
    while (taskIndex < plan.items.length && plan.items[taskIndex].state === 'DONE') taskIndex++;
    if (taskIndex >= plan.items.length) { screen = 'HOME'; buildControls(); return; }
    var item = plan.items[taskIndex];
    currentHex = item.char_id;
    currentData = STROKE_DATA[currentHex];
    currentMeta = CHAR_META[currentHex];
    order = currentData.order;
    screen = 'RECOGNIZE';
    playSound('char'); // 占位发音钩子（D1 真实人声延后）
    buildControls();
  }

  function startTrace() {
    screen = 'TRACE';
    doneCount = 0; perStroke = []; written = [];
    curPts = []; drawing = false; activePointer = null;
    liveCD = null; lastStrokeFailed = false; message = '';
    demo.active = false;
    buildControls();
    playSound('char');
  }

  function finishChar() {
    var T = Tolerance.tolerance(currentP());
    var avgD = 0, avgC = 0;
    perStroke.forEach(function (s) { avgD += s.D; avgC += s.C; });
    avgD /= perStroke.length; avgC /= perStroke.length;
    resultAvgC = avgC; resultAvgD = avgD;
    // 星级：偏差越小星越多（鼓励占位）
    resultStars = avgD <= T * 0.5 ? 3 : (avgD <= T * 0.85 ? 2 : 1);
    resultMsg = resultStars === 3 ? '太棒啦！写得真漂亮！'
              : resultStars === 2 ? '很好！继续加油～' : '写出来啦，真厉害！';

    // 进度系统回写（GDD tracing §5 / rhythm §4.3）
    var rec = save.characters[currentHex] || { stage: 'R0', next_date: '', last_result: false, proficiency: 0 };
    var ns = Rhythm.nextStage(rec.stage);
    rec.stage = ns;
    rec.next_date = Rhythm.addDays(getToday(), Rhythm.INTERVAL[ns]);
    rec.last_result = true;
    rec.proficiency = Math.min(1, (rec.proficiency || 0) + 0.2); // P += 0.2
    save.characters[currentHex] = rec;
    save.learned[currentHex] = true;
    if (plan.items[taskIndex]) plan.items[taskIndex].state = 'DONE';
    save.daily_task = plan;
    Storage.save(save);

    playSound('complete');
    screen = 'RESULT';
    buildControls();
  }

  function continueNext() { taskIndex++; startTask(); }

  function replayDemo() { demo.active = true; demo.strokeIdx = 0; demo.t0 = performance.now(); }

  // ---------- 判定 ----------
  function updateLiveCD() {
    if (curPts.length < 2) { liveCD = null; return; }
    var med = mediansOf(order[doneCount]);
    var T = Tolerance.tolerance(currentP());
    var r = Tracing.computeCoverageDeviation(curPts, med, T);
    liveCD = { C: r.C, D: r.D, pass: Tracing.judge(r.C, r.D, T) };
  }

  // 玩家这一笔实际描的是哪一笔（最近中位线匹配）
  function bestMatchingStroke(pts) {
    var best = -1, bestD = Infinity;
    for (var i = 0; i < currentData.strokes.length; i++) {
      var med = mediansOf(i);
      var sum = 0;
      for (var k = 0; k < pts.length; k++) sum += Tracing.polylineNearestDist(pts[k], med);
      var avg = sum / pts.length;
      if (avg < bestD) { bestD = avg; best = i; }
    }
    return best;
  }

  function finishStroke() {
    if (curPts.length < 2) { curPts = []; return; }   // 太短，忽略（断笔/误触）
    var T = Tolerance.tolerance(currentP());
    var expected = order[doneCount];
    var drawn = bestMatchingStroke(curPts);

    if (drawn !== expected) {
      // 笔顺错误：不通过、不罚，仅提示正确下一笔（GDD §4.4）
      message = '先写这一笔哦～';
      lastStrokeFailed = false;
      curPts = []; liveCD = null;
      playSound('retry');
      buildControls();
      return;
    }

    var med = mediansOf(expected);
    var r = Tracing.computeCoverageDeviation(curPts, med, T);
    var pass = Tracing.judge(r.C, r.D, T);
    if (pass) {
      perStroke.push({ C: r.C, D: r.D });
      written.push(curPts.slice());
      doneCount++;
      playSound('ding');
      curPts = []; liveCD = null; lastStrokeFailed = false;
      message = (doneCount < order.length) ? '这一笔写好啦！' : '全部写好啦！';
      if (doneCount >= order.length) finishChar();
      else buildControls();
    } else {
      // 覆盖不足 / 偏差大：不罚，再试（GDD §4.5 零惩罚）
      lastStrokeFailed = true;
      message = '再试一次也可以！';
      curPts = [];
      liveCD = { C: r.C, D: r.D, pass: false };
      playSound('retry');
      buildControls();
    }
  }

  // ---------- 指针交互（鼠标 + 触摸；优先 Pointer Events，老 iOS Safari(<13) 回退 Touch Events） ----------
  // 约束：pointer 与 touch 两条路径只挂其一（见底部 'PointerEvent' in window 二选一），
  // 共用同一套判定逻辑（beginStroke/moveStroke/endStroke/cancelStroke），避免逻辑分叉。
  var SUPPORT_POINTER = ('PointerEvent' in window);

  function pointFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (LOGICAL_W / rect.width),
      (e.clientY - rect.top) * (LOGICAL_H / rect.height)
    ];
  }
  function insideBox(sx, sy) {
    var b = Render.BOX;
    return sx >= b.x && sx <= b.x + b.size && sy >= b.y && sy <= b.y + b.size;
  }
  // 在触点列表里按 identifier 找指定手指（touch 路径用，单指锁定）
  function findTouch(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }

  // —— 共用逻辑（e 为带 clientX/clientY 的坐标源；pointerId 为单指锁定的 id）——
  function beginStroke(e, pointerId) {
    if (screen !== 'TRACE' || drawing || activePointer !== null) return false;
    var p = pointFromEvent(e);
    if (!insideBox(p[0], p[1])) return false;
    activePointer = pointerId;
    // setPointerCapture 仅 Pointer Events 可用；touch 路径用 identifier 锁定已够，直接跳过
    if (SUPPORT_POINTER) { try { canvas.setPointerCapture(pointerId); } catch (_) {} }
    drawing = true; curPts = [];
    curPts.push(Render.screenToGlyph(p[0], p[1], currentData._render_center));
    return true;
  }
  function moveStroke(e, pointerId) {
    if (screen !== 'TRACE' || !drawing || pointerId !== activePointer) return;
    var p = pointFromEvent(e);
    curPts.push(Render.screenToGlyph(p[0], p[1], currentData._render_center));
    updateLiveCD();
  }
  function endStroke(pointerId) {
    if (screen !== 'TRACE' || !drawing || pointerId !== activePointer) return;
    drawing = false; activePointer = null;
    finishStroke();
  }
  function cancelStroke(pointerId) {
    if (pointerId !== activePointer) return;
    drawing = false; activePointer = null; curPts = [];
  }

  // —— Pointer Events 路径（现代浏览器 / iPadOS 13+）——
  function onPointerDown(e) { if (beginStroke(e, e.pointerId)) e.preventDefault(); }
  function onPointerMove(e) { if (drawing && e.pointerId === activePointer) { e.preventDefault(); moveStroke(e, e.pointerId); } }
  function onPointerUp(e) { if (drawing && e.pointerId === activePointer) { e.preventDefault(); endStroke(e.pointerId); } }
  function onPointerCancel(e) { cancelStroke(e.pointerId); }

  // —— Touch Events 路径（iOS Safari <13 无 Pointer Events 时回退）——
  // 用 changedTouches/touches 的 identifier 做单指锁定；touch 事件用 e.preventDefault() 防 iOS 滚动/缩放。
  function onTouchStart(e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    if (beginStroke(t, t.identifier)) e.preventDefault();
  }
  function onTouchMove(e) {
    if (!drawing) return;
    var t = findTouch(e.touches, activePointer);
    if (!t) return;
    e.preventDefault();
    moveStroke(t, t.identifier);
  }
  function onTouchEnd(e) {
    if (!drawing) return;
    var t = findTouch(e.changedTouches, activePointer);
    if (!t) return;
    e.preventDefault();
    endStroke(activePointer);
  }
  function onTouchCancel(e) {
    if (!drawing) return;
    var t = findTouch(e.changedTouches, activePointer);
    if (!t) return;
    cancelStroke(activePointer);
  }

  // —— 二选一绑定：仅挂其一，绝不重复 ——
  if (SUPPORT_POINTER) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  } else {
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchCancel, { passive: false });
  }

  // ---------- 音频（WebAudio 占位"叮"；playSound('char') 为发音钩子，D1 真实人声延后） ----------
  var audioCtx = null;
  function getCtx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } }
    return audioCtx;
  }
  function resumeAudio() { var ac = getCtx(); if (ac && ac.state === 'suspended') ac.resume(); }
  function beep(ac, when, freq, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(when); o.stop(when + dur + 0.02);
  }
  function playSound(type) {
    if (save.settings && save.settings.sound_on === false) return;
    var ac = getCtx(); if (!ac) return;
    resumeAudio();
    var now = ac.currentTime;
    if (type === 'retry') beep(ac, now, 520, 0.16, 0.16);
    else if (type === 'ding' || type === 'char') beep(ac, now, 880, 0.18, 0.18);
    else if (type === 'complete') { beep(ac, now, 660, 0.16, 0.18); beep(ac, now + 0.12, 990, 0.22, 0.2); }
  }

  // ---------- 控件 ----------
  function setControls(list) {
    controls.innerHTML = '';
    list.forEach(function (b) {
      var el = document.createElement('button');
      el.className = 'btn ' + (b.cls || 'secondary');
      el.textContent = b.label;
      el.addEventListener('click', function () { resumeAudio(); b.onClick(); });
      controls.appendChild(el);
    });
  }
  function buildControls() {
    if (screen === 'HOME') {
      setControls([
        { label: '开始今日任务', cls: 'primary', onClick: startTask },
        { label: '（调试）明天再来', cls: 'secondary', onClick: function () { dayOffset++; ensurePlan(); buildControls(); } },
        { label: '重置存档', cls: 'secondary', onClick: function () { if (window.confirm('确定清空进度？')) { Storage.reset(); location.reload(); } } }
      ]);
    } else if (screen === 'RECOGNIZE') {
      setControls([
        { label: '开始描红', cls: 'primary', onClick: startTrace },
        { label: '返回首页', cls: 'secondary', onClick: goHome }
      ]);
    } else if (screen === 'TRACE') {
      var list = [{ label: '看示范', cls: 'secondary', onClick: replayDemo }];
      if (lastStrokeFailed) list.push({ label: '再试一次', cls: 'secondary', onClick: function () { lastStrokeFailed = false; message = ''; liveCD = null; buildControls(); } });
      list.push({ label: '返回首页', cls: 'secondary', onClick: goHome });
      setControls(list);
    } else if (screen === 'RESULT') {
      setControls([
        { label: (taskIndex < plan.items.length - 1) ? '继续' : '回到首页', cls: 'primary', onClick: continueNext },
        { label: '返回首页', cls: 'secondary', onClick: goHome }
      ]);
    }
  }

  // ---------- 绘制 ----------
  function drawHome() {
    Render.drawText(ctx, '今天的小任务', 240, 48, 30, Render.PALETTE.ink);
    var remain = plan.items.filter(function (i) { return i.state !== 'DONE'; });
    var newN = remain.filter(function (i) { return i.kind === 'new'; }).length;
    var revN = remain.filter(function (i) { return i.kind === 'review'; }).length;
    Render.drawText(ctx, '新字 ' + newN + ' · 复习 ' + revN, 240, 104, 40, Render.PALETTE.sun);
    if (remain.length === 0) {
      Render.drawSprite(ctx, 240, 300, 80, Render.PALETTE.mint, Render.PALETTE.sun, 'done', performance.now());
      Render.drawText(ctx, '今天都完成啦！', 240, 430, 34, Render.PALETTE.ink);
      Render.drawText(ctx, '明天再来玩～', 240, 472, 26, Render.PALETTE.fog);
    } else {
      drawGlyphRow(remain.filter(function (i) { return i.kind === 'new'; }), 210, Render.PALETTE.sun, '新字');
      drawGlyphRow(remain.filter(function (i) { return i.kind === 'review'; }), 360, Render.PALETTE.sky, '复习');
    }
    Render.drawText(ctx, '已学会 ' + Object.keys(save.learned).length + ' / ' + ALL_CHARS.length, 240, 560, 22, Render.PALETTE.fog);
  }
  function drawGlyphRow(items, y, color, label) {
    if (!items.length) return;
    Render.drawText(ctx, label, 240, y - 38, 22, Render.PALETTE.fog);
    var n = items.length, gap = 52, startX = 240 - (n - 1) * gap / 2;
    for (var i = 0; i < n; i++) {
      var d = STROKE_DATA[items[i].char_id];
      Render.drawChar(ctx, startX + i * gap, y, d ? d.char : '?', 40, color);
    }
  }
  function drawRecognize(t) {
    var mc = currentMeta || {};
    Render.drawSprite(ctx, 240, 168, 78, mc.main_color || Render.PALETTE.sky, mc.accent_color || Render.PALETTE.sun, 'happy', t);
    Render.drawChar(ctx, 240, 312, currentData.char, 120, Render.PALETTE.ink);
    Render.drawText(ctx, mc.pinyin || '', 240, 392, 36, Render.PALETTE.sky);
    Render.drawText(ctx, mc.meaning || '', 240, 436, 24, Render.PALETTE.fog);
    Render.drawText(ctx, '点下方按钮，开始描红吧！', 240, 490, 20, Render.PALETTE.fog);
  }
  function drawTrace(t) {
    var rc = currentData._render_center;
    Render.drawChar(ctx, 64, 46, currentData.char, 40, Render.PALETTE.ink);
    Render.drawText(ctx, (currentMeta && currentMeta.pinyin) || '', 104, 46, 26, Render.PALETTE.sky, '400');
    Render.drawText(ctx, '第 ' + (doneCount + 1) + ' / ' + order.length + ' 笔', 410, 46, 22, Render.PALETTE.fog, '400');

    Render.drawGrid(ctx);

    for (var i = 0; i < order.length; i++) {
      var si = order[i];
      var stroke = currentData.strokes[si];
      if (i < doneCount) Render.drawUserStroke(ctx, written[i] || [], rc);
      else if (i === doneCount) { Render.drawGhostStroke(ctx, stroke, rc, true); Render.drawStartPulse(ctx, stroke, rc, t); }
      else Render.drawGhostStroke(ctx, stroke, rc, false);
    }

    if (demo.active) drawDemo(t);
    if (curPts.length) Render.drawUserStroke(ctx, curPts, rc);
    drawHUD();
  }
  function drawDemo(t) {
    var idx = demo.strokeIdx;
    var elapsed = t - demo.t0;
    var dur = 450;
    var seg = Math.floor(elapsed / dur);
    if (seg >= order.length) { demo.active = false; return; }
    idx = seg;
    var wp = currentData.strokes[order[idx]].waypoints;
    var med = wp.map(function (w) { return [w[0] * 1024, w[1] * 1024]; });
    var local = (elapsed - seg * dur) / dur; if (local > 1) local = 1;
    var S = Tracing.densify(med, 24);
    var penIdx = Math.min(S.length - 1, Math.floor(local * (S.length - 1)));
    ctx.save();
    ctx.strokeStyle = Render.PALETTE.sun; ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (var k = 0; k <= penIdx; k++) {
      var p = Render.glyphToScreen(S[k][0], S[k][1], currentData._render_center);
      if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    var pp = Render.glyphToScreen(S[penIdx][0], S[penIdx][1], currentData._render_center);
    ctx.fillStyle = Render.PALETTE.sun;
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawHUD() {
    var y = 540;
    if (message) Render.drawText(ctx, message, 240, y - 8, 22, Render.PALETTE.ink, '700');
    if (liveCD) {
      var cd = liveCD;
      var col = cd.pass ? Render.PALETTE.success : Render.PALETTE.coral;
      Render.drawText(ctx, '覆盖 ' + Math.round(cd.C * 100) + '%   偏差 ' + Math.round(cd.D), 240, y + 22, 22, col, '700');
      Render.drawText(ctx, cd.pass ? '✓ 这一笔可以！' : '还差一点点～', 240, y + 50, 20, col, '400');
    } else if (order.length > 1 && !message) {
      Render.drawText(ctx, '照着粉色虚线，一笔一笔写', 240, y + 24, 20, Render.PALETTE.fog, '400');
    }
  }
  function drawResult(t) {
    Render.drawStars(ctx, 240, 110, resultStars, 3, 30);
    var bounce = save.settings.reduce_motion ? 0 : -Math.abs(Math.sin(t / 220)) * 12;
    Render.drawSprite(ctx, 240, 250 + bounce, 84, (currentMeta && currentMeta.main_color) || Render.PALETTE.sky, (currentMeta && currentMeta.accent_color) || Render.PALETTE.sun, 'done', t);
    Render.drawChar(ctx, 240, 392, currentData.char, 90, Render.PALETTE.ink);
    Render.drawText(ctx, resultMsg, 240, 460, 30, Render.PALETTE.ink, '700');
    Render.drawText(ctx, '平均覆盖 ' + Math.round(resultAvgC * 100) + '% · 平均偏差 ' + Math.round(resultAvgD), 240, 502, 20, Render.PALETTE.fog, '400');
  }
  function drawScreen(t) {
    Render.clear(ctx, LOGICAL_W, LOGICAL_H);
    Render.drawBackground(ctx, LOGICAL_W, LOGICAL_H);
    if (screen === 'HOME') drawHome();
    else if (screen === 'RECOGNIZE') drawRecognize(t);
    else if (screen === 'TRACE') drawTrace(t);
    else if (screen === 'RESULT') drawResult(t);
  }

  // ---------- 关于浮层 ----------
  var aboutEl = document.getElementById('about');
  document.getElementById('aboutBtn').addEventListener('click', function () { aboutEl.classList.add('show'); });
  document.getElementById('aboutClose').addEventListener('click', function () { aboutEl.classList.remove('show'); });
  aboutEl.addEventListener('click', function (e) { if (e.target === aboutEl) aboutEl.classList.remove('show'); });

  // ---------- 启动 ----------
  ensurePlan();
  buildControls();
  (function frame(t) { drawScreen(t); requestAnimationFrame(frame); })(performance.now());
})();
