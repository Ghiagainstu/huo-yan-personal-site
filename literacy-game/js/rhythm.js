/*
 * rhythm.js — 每日节奏调度（daily-rhythm GDD §4.2/§4.3, AC1/AC6/AC7）
 * 纯逻辑 / 无 DOM。classic script（window.Rhythm / module.exports）。
 *
 * 严格复刻 GDD 常量与公式（禁止自创）：
 *   BUDGET  = 8   （每日任务上限；GDD 范围 8–10，默认取 8）
 *   NEW_MAX = 3   （每日新字上限；clamp 到 2..5 硬上限）
 *   INTERVAL = {R0:0, R1:1, R2:3, R3:7, R4:16, GRAD:30}
 *
 *   复习取出 = 复习队列中「到期日 ≤ 今日」的字，按到期日升序
 *   复习实取 = 前 min(len, BUDGET) 个           // 超预算截断，余下顺延
 *   剩余槽位 = BUDGET − len(复习实取)
 *   新字数   = min(剩余槽位, NEW_MAX(clamp), 剩余未学字数)
 *   当日任务 = 复习实取 + 取前 新字数 个未学字   // 复习优先填满
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Rhythm = api;
  if (typeof global !== 'undefined') global.Rhythm = api;
})(this, function () {
  'use strict';

  var BUDGET = 8;
  var NEW_MAX = 3;          // 默认每日新字
  var NEW_MIN = 2;          // 新字下限
  var NEW_MAX_LIMIT = 5;    // 新字硬上限（绝不超 5）
  var INTERVAL = { R0: 0, R1: 1, R2: 3, R3: 7, R4: 16, GRAD: 30 };
  var STAGES = ['R0', 'R1', 'R2', 'R3', 'R4', 'GRAD'];

  // 设置夹紧：new_per_day 限定在 [2,5]（GDD §6.7 硬上限）
  function clampNewPerDay(v) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) v = NEW_MAX;
    if (v < NEW_MIN) return NEW_MIN;
    if (v > NEW_MAX_LIMIT) return NEW_MAX_LIMIT;
    return v;
  }

  // YYYY-MM-DD 加 n 天（本地日历日，不依赖绝对时间戳，规避改时间跳级 GDD §6.6）
  function addDays(dateStr, n) {
    var p = String(dateStr).split('-');
    var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
    var dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    var mm = ('0' + (dt.getMonth() + 1)).slice(-2);
    var dd = ('0' + dt.getDate()).slice(-2);
    return dt.getFullYear() + '-' + mm + '-' + dd;
  }

  // 阶段推进：R0→R1→…→R4→GRAD（GRAD 维持）
  function nextStage(stage) {
    var i = STAGES.indexOf(stage);
    if (i < 0) return 'R1';
    if (i >= STAGES.length - 1) return 'GRAD';
    return STAGES[i + 1];
  }

  // 给定达标后的下次复习/抽检日
  function reviewDate(today, stage) {
    var s = nextStage(stage);
    return addDays(today, INTERVAL[s]);
  }

  /*
   * allocatePlan(state)
   *  state = {
   *    today:     "YYYY-MM-DD",
   *    allChars:  [char_id, ...],          // 全部可用字（按引入顺序）
   *    learned:   { char_id: {stage, next_date}, ... },
   *    newPerDay: int (默认 3，会被 clamp 到 2..5)
   *  }
   *  返回 { date, items:[{char_id, kind:'review'|'new'}], newCount, reviewCount, dueCount }
   */
  function allocatePlan(state) {
    state = state || {};
    var today = state.today || addDays(new Date().toISOString().slice(0, 10), 0);
    var allChars = state.allChars || [];
    var learned = state.learned || {};
    var newPerDay = clampNewPerDay(state.newPerDay == null ? NEW_MAX : state.newPerDay);

    // 到期复习字：stage ∈ R0..R4 且 next_date ≤ today（字符串比较对 YYYY-MM-DD 有效）
    var due = [];
    for (var i = 0; i < allChars.length; i++) {
      var cid = allChars[i];
      var rec = learned[cid];
      if (!rec) continue;
      var stage = rec.stage;
      var nd = rec.next_date;
      if (stage && stage !== 'GRAD' && INTERVAL.hasOwnProperty(stage) && nd && nd <= today) {
        due.push({ char_id: cid, next_date: nd });
      }
    }
    // 按到期日升序（稳定：同日期保持 allChars 顺序）
    due.sort(function (a, b) {
      if (a.next_date < b.next_date) return -1;
      if (a.next_date > b.next_date) return 1;
      return 0;
    });

    var reviewCount = Math.min(due.length, BUDGET);
    var remaining = BUDGET - reviewCount;

    // 剩余未学字（不在 learned 中）
    var unlearned = [];
    for (var j = 0; j < allChars.length; j++) {
      if (!learned[allChars[j]]) unlearned.push(allChars[j]);
    }
    var newCount = Math.min(remaining, newPerDay, unlearned.length);

    var items = [];
    for (var r = 0; r < reviewCount; r++) items.push({ char_id: due[r].char_id, kind: 'review' });
    for (var n = 0; n < newCount; n++) items.push({ char_id: unlearned[n], kind: 'new' });

    return {
      date: today,
      items: items,
      newCount: newCount,
      reviewCount: reviewCount,
      dueCount: due.length
    };
  }

  return {
    allocatePlan: allocatePlan,
    clampNewPerDay: clampNewPerDay,
    addDays: addDays,
    nextStage: nextStage,
    reviewDate: reviewDate,
    BUDGET: BUDGET,
    NEW_MAX: NEW_MAX,
    NEW_MIN: NEW_MIN,
    NEW_MAX_LIMIT: NEW_MAX_LIMIT,
    INTERVAL: INTERVAL,
    STAGES: STAGES
  };
});
