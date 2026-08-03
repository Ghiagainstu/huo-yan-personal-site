/*
 * render.js — Canvas 绘制层（原型占位美术，Sprint 02 换真实精灵 PNG）
 * classic script：window.Render。无 DOM 依赖，只画。
 *
 * 坐标：逻辑画布 480×600（DPR 由 main.js 处理）。所有绘制用逻辑坐标。
 * 色板严格取自 art-bible §2；字精灵 = 圆润团子占位（天空蓝/阳光黄基调）。
 */
(function (root, factory) {
  var api = factory();
  if (typeof window !== 'undefined') window.Render = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof global !== 'undefined') global.Render = api;
})(this, function () {
  'use strict';

  var PALETTE = {
    sky: '#6FC3E4', skyDeep: '#3E9FC9',
    peach: '#FFB3C1', mint: '#9FE0C3', lemon: '#FFD66B',
    sun: '#FFC93C', success: '#7FD8A8', coral: '#FF9E80',
    ink: '#2E3A4B', fog: '#6B7686',
    cream: '#FFF8F0', cloud: '#FFFFFF',
    ghost: '#F2C9D2', trace: '#FF6B8A', grid: '#EAD9C9'
  };

  // 描红区（≥ 最小触控 48pt，此处 420px 远超；见 a11y-matrix #3）
  var BOX = { x: 30, y: 96, size: 420 };

  function pad2(n) { return ('0' + n).slice(-2); }

  function darken(hex, amt) {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    r = Math.round(r * (1 - amt)); g = Math.round(g * (1 - amt)); b = Math.round(b * (1 - amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // 笔迹 1024 空间坐标 -> 屏幕逻辑坐标。
  // ⚠️ 朝向勘误（ADR-002 §4 原判断有误，2026-08-03 订正）：
  // hanzi-writer-data / makemeahanzi 的 medians 是 **y-up** 坐标系（原点左下、y 向上），
  // 而 Canvas 是 y-down。必须翻转 Y，否则汉字上下颠倒。
  // 笔迹数据在 build 期已做包围盒居中（bbox 中心≈0.5），直接按 [0,1] 映射到描红框即可，
  // 无需再减 _render_center（数据本身已居中；减 rc 反而错位）。rc 仅保留形参兼容调用方。
  function glyphToScreen(gx, gy, rc) {
    var nx = gx / 1024, ny = gy / 1024;
    return [BOX.x + nx * BOX.size, BOX.y + (1 - ny) * BOX.size];
  }
  // 屏幕逻辑坐标 -> 笔迹 1024 空间坐标（指针输入用；glyphToScreen 的严格逆变换，必须同步翻转 Y）
  function screenToGlyph(sx, sy, rc) {
    var nx = (sx - BOX.x) / BOX.size;
    var ny = 1 - (sy - BOX.y) / BOX.size;
    return [nx * 1024, ny * 1024];
  }

  function clear(ctx, w, h) { ctx.clearRect(0, 0, w, h); }

  function drawBackground(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#EAF7FB');
    g.addColorStop(1, PALETTE.cream);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // 田字格淡线（#EAD9C9 @20%）
  function drawGrid(ctx) {
    var b = BOX;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(b.x, b.y, b.size, b.size);
    ctx.strokeStyle = 'rgba(234,217,201,0.5)'; // 网格线 @~20-50%
    ctx.lineWidth = 2;
    // 外框
    ctx.strokeRect(b.x, b.y, b.size, b.size);
    // 米字格（横/竖/两对角）
    var cx = b.x + b.size / 2, cy = b.y + b.size / 2;
    ctx.beginPath();
    ctx.moveTo(b.x, cy); ctx.lineTo(b.x + b.size, cy);
    ctx.moveTo(cx, b.y); ctx.lineTo(cx, b.y + b.size);
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.size, b.y + b.size);
    ctx.moveTo(b.x + b.size, b.y); ctx.lineTo(b.x, b.y + b.size);
    ctx.stroke();
    ctx.restore();
  }

  function drawText(ctx, text, cx, cy, size, color, weight) {
    ctx.save();
    ctx.fillStyle = color || PALETTE.ink;
    ctx.font = (weight || '700') + ' ' + size + 'px "PingFang SC","Microsoft YaHei","Hiragino Sans GB","Heiti SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  // 汉字（认字主角字占位：用系统楷体栈；Sprint 02 换霞鹜文楷）
  function drawChar(ctx, cx, cy, ch, size, color) {
    ctx.save();
    ctx.fillStyle = color || PALETTE.ink;
    ctx.font = '700 ' + size + 'px "KaiTi","STKaiti","Kaiti SC","SimSun","Songti SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy);
    ctx.restore();
  }

  // 字精灵·团子占位
  function drawSprite(ctx, cx, cy, r, mainColor, accentColor, expression, t) {
    t = t || 0;
    mainColor = mainColor || PALETTE.sky;
    accentColor = accentColor || PALETTE.sun;
    var dark = darken(mainColor, 0.18);
    ctx.save();
    // 身体
    ctx.fillStyle = mainColor;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.05, r * 0.98, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // 顶部柔光高光（美术圣经 §1 左上柔光）
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.32, cy - r * 0.36, r * 0.3, r * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 腮红
    ctx.fillStyle = PALETTE.peach;
    ctx.beginPath(); ctx.arc(cx - r * 0.46, cy + r * 0.12, r * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.46, cy + r * 0.12, r * 0.17, 0, Math.PI * 2); ctx.fill();
    // 眼
    var eyeY = cy - r * 0.08, eyeDX = r * 0.33, eyeR = r * 0.14;
    ctx.fillStyle = PALETTE.ink;
    if (expression === 'done' || expression === 'happy') {
      ctx.beginPath(); ctx.arc(cx - eyeDX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeDX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - eyeDX + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeDX + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.38, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx - eyeDX, eyeY, eyeR * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeDX, eyeY, eyeR * 0.75, 0, Math.PI * 2); ctx.fill();
    }
    // 嘴
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (expression === 'done' || expression === 'happy') ctx.arc(cx, cy + r * 0.16, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (expression === 'think') ctx.arc(cx, cy + r * 0.26, r * 0.16, 1.1 * Math.PI, 1.9 * Math.PI);
    else { ctx.moveTo(cx - r * 0.14, cy + r * 0.2); ctx.lineTo(cx + r * 0.14, cy + r * 0.2); }
    ctx.stroke();
    // 头顶小装饰（用 accent 色点，呼应字义配色）
    ctx.fillStyle = accentColor;
    ctx.beginPath(); ctx.arc(cx, cy - r * 1.02, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 幽灵引导层（#F2C9D2 @30%）；highlight 时略强 + 加粗
  function drawGhostStroke(ctx, stroke, rc, highlight) {
    var wp = stroke.waypoints;
    ctx.save();
    ctx.strokeStyle = highlight ? 'rgba(242,201,210,0.55)' : 'rgba(242,201,210,0.30)';
    ctx.lineWidth = highlight ? 16 : 12;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < wp.length; i++) {
      var p = glyphToScreen(wp[i][0] * 1024, wp[i][1] * 1024, rc);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 用户描红（珊瑚红 #FF6B8A）
  function drawUserStroke(ctx, pts, rc) {
    if (!pts || pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = PALETTE.trace;
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = glyphToScreen(pts[i][0], pts[i][1], rc);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 起点脉冲（阳光黄 #FFC93C，半径随 t 脉冲）
  function drawStartPulse(ctx, stroke, rc, t) {
    var s = stroke.start;
    var p = glyphToScreen(s[0] * 1024, s[1] * 1024, rc);
    var pulse = 14 + Math.sin(t / 220) * 4;
    ctx.save();
    ctx.fillStyle = 'rgba(255,201,60,0.9)';
    ctx.beginPath(); ctx.arc(p[0], p[1], pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,201,60,0.35)';
    ctx.beginPath(); ctx.arc(p[0], p[1], pulse + 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 星级
  function drawStars(ctx, cx, cy, n, total, size) {
    size = size || 26;
    var gap = size * 1.6;
    var startX = cx - (total - 1) * gap / 2;
    for (var i = 0; i < total; i++) {
      star(ctx, startX + i * gap, cy, size / 2, i < n ? PALETTE.sun : 'rgba(46,58,75,0.18)');
    }
  }
  function star(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rad = (i % 2 === 0) ? r : r * 0.45;
      var x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {
    PALETTE: PALETTE,
    BOX: BOX,
    glyphToScreen: glyphToScreen,
    screenToGlyph: screenToGlyph,
    clear: clear,
    drawBackground: drawBackground,
    drawGrid: drawGrid,
    drawText: drawText,
    drawChar: drawChar,
    drawSprite: drawSprite,
    drawGhostStroke: drawGhostStroke,
    drawUserStroke: drawUserStroke,
    drawStartPulse: drawStartPulse,
    drawStars: drawStars,
    darken: darken
  };
});
