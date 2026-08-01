/*
 * node-tests.js — 纯逻辑模块 + bundle 的真断言测试（用管理版 node 跑）。
 *   运行：node tests/node-tests.js
 *
 * 覆盖任务要求的全部断言：
 *   - tolerance(0)=24 / tolerance(1)=10 / tolerance(0.5)≈16.8
 *   - judge 真值表（覆盖不足 / 偏差超容差 / 通过）
 *   - rhythm.allocatePlan：空态 new=3 review=0；复习优先填满 BUDGET=8；new clamp 2..5
 *   - computeCoverageDeviation 对 u4e00「完美贴合」得 C≈1,D≈0 且 judge 通过；「远离」得 C 低/judge 失败
 *   - strokes-bundle.js 可被 require 且 50 字齐
 *   - storage v1→v2 迁移 + 读写 roundtrip
 */
'use strict';

var Tolerance = require('../js/tolerance.js');
var Tracing = require('../js/tracing.js');
var Rhythm = require('../js/rhythm.js');
var Storage = require('../js/storage.js');
var bundle = require('../js/strokes-bundle.js');

var pass = 0, fail = 0;
var fails = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name); console.log('  FAIL  ' + name + (extra ? '  >> ' + extra : '')); }
}
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-6 : eps); }

console.log('\n=== 1) Tolerance (GDD §4.3) ===');
ok('tolerance(0) === 24', Tolerance.tolerance(0) === 24, Tolerance.tolerance(0));
ok('tolerance(1) === 10', Tolerance.tolerance(1) === 10, Tolerance.tolerance(1));
ok('tolerance(0.5) ≈ 16.8', approx(Tolerance.tolerance(0.5), 16.8, 1e-6), Tolerance.tolerance(0.5));
ok('tolerance 恒 ≥10（P=1.5 夹紧）', Tolerance.tolerance(1.5) === 10, Tolerance.tolerance(1.5));
ok('tolerance 恒 ≥10（P=-1 夹紧）', Tolerance.tolerance(-1) === 24, Tolerance.tolerance(-1));

console.log('\n=== 2) Judge (GDD §4.2, AC1) ===');
var T = Tolerance.tolerance(0.5); // 16.8
ok('judge(0.85,5,16.8) === true (C够&D够)', Tracing.judge(0.85, 5, 16.8) === true);
ok('judge(0.7,5,16.8) === false (覆盖不足)', Tracing.judge(0.7, 5, 16.8) === false);
ok('judge(0.85,20,16.8) === false (偏差超容差)', Tracing.judge(0.85, 20, 16.8) === false);
ok('judge(1.0,10,10) === true (D 恰好=T_MIN 边界)', Tracing.judge(1.0, 10, 10) === true);
ok('judge(0.79,0,10) === false (C 恰好低于 0.8)', Tracing.judge(0.79, 0, 10) === false);

console.log('\n=== 3) Rhythm.allocatePlan (GDD §4.2, AC1/AC6) ===');
var ALL = Object.keys(bundle.STROKE_DATA).sort(); // 50 字，按表序
ok('bundle 提供 50 字', ALL.length === 50, ALL.length);

// 3a 空态：全给新字，new=3, review=0
var p0 = Rhythm.allocatePlan({ today: '2025-01-01', allChars: ALL, learned: {}, newPerDay: 3 });
ok('空态 newCount === 3 (NEW_MAX)', p0.newCount === 3, p0.newCount);
ok('空态 reviewCount === 0', p0.reviewCount === 0, p0.reviewCount);
ok('空态 items 长度 === 3', p0.items.length === 3, p0.items.length);

// 3b 复习优先填满 BUDGET=8：塞 10 个到期复习字 → review=8, new=0
var learned10 = {};
for (var i = 0; i < 10; i++) learned10[ALL[i]] = { stage: 'R0', next_date: '2025-01-01' };
var p1 = Rhythm.allocatePlan({ today: '2025-01-01', allChars: ALL, learned: learned10, newPerDay: 3 });
ok('10 到期复习 → reviewCount === 8 (填满 BUDGET)', p1.reviewCount === 8, p1.reviewCount);
ok('复习填满后 newCount === 0', p1.newCount === 0, p1.newCount);
ok('items 全为 review', p1.items.every(function (it) { return it.kind === 'review'; }));
ok('items 长度 === 8 (= BUDGET)', p1.items.length === 8, p1.items.length);

// 3c new clamp 2..5（当仍有剩余槽位时）
function planWith(newPerDay, learned) {
  return Rhythm.allocatePlan({ today: '2025-01-01', allChars: ALL, learned: learned || {}, newPerDay: newPerDay });
}
ok('clampNewPerDay(1) === 2', Rhythm.clampNewPerDay(1) === 2);
ok('clampNewPerDay(6) === 5', Rhythm.clampNewPerDay(6) === 5);
ok('clampNewPerDay(0) === 2', Rhythm.clampNewPerDay(0) === 2);
ok('clampNewPerDay(10) === 5', Rhythm.clampNewPerDay(10) === 5);
ok('clampNewPerDay(3) === 3', Rhythm.clampNewPerDay(3) === 3);
ok('newPerDay=1 → newCount 被 clamp 到 2', planWith(1).newCount === 2, planWith(1).newCount);
ok('newPerDay=6 → newCount 被 clamp 到 5', planWith(6).newCount === 5, planWith(6).newCount);
ok('newPerDay=2 → newCount === 2', planWith(2).newCount === 2, planWith(2).newCount);

// 3d 剩余槽位限制新字（6 复习 → 剩 2 槽）
var learned6 = {};
for (var j = 0; j < 6; j++) learned6[ALL[j]] = { stage: 'R0', next_date: '2025-01-01' };
var p2 = Rhythm.allocatePlan({ today: '2025-01-01', allChars: ALL, learned: learned6, newPerDay: 3 });
ok('6 复习 → reviewCount === 6', p2.reviewCount === 6, p2.reviewCount);
ok('6 复习(剩2槽) → newCount === 2（受剩余槽位限制, 非 clamp）', p2.newCount === 2, p2.newCount);
ok('总量不超 BUDGET (6+2=8)', p2.reviewCount + p2.newCount <= Rhythm.BUDGET);

// 3e 阶段推进 + 复习日
ok("nextStage('R0')==='R1'", Rhythm.nextStage('R0') === 'R1');
ok("nextStage('R4')==='GRAD'", Rhythm.nextStage('R4') === 'GRAD');
ok("nextStage('GRAD')==='GRAD' (维持)", Rhythm.nextStage('GRAD') === 'GRAD');
ok("reviewDate R0 达标 → R1(次日)", Rhythm.reviewDate('2025-01-01', 'R0') === '2025-01-02', Rhythm.reviewDate('2025-01-01', 'R0'));
ok("reviewDate R3 达标 → R4(+16天)", Rhythm.reviewDate('2025-01-01', 'R3') === '2025-01-17', Rhythm.reviewDate('2025-01-01', 'R3'));
ok("reviewDate R4 达标 → GRAD(+30天 SPOT_T)", Rhythm.reviewDate('2025-01-01', 'R4') === '2025-01-31', Rhythm.reviewDate('2025-01-01', 'R4'));
ok("reviewDate GRAD 抽检 → +30 天(SPOT_T)", Rhythm.reviewDate('2025-01-01', 'GRAD') === '2025-01-31', Rhythm.reviewDate('2025-01-01', 'GRAD'));

console.log('\n=== 4) Tracing.computeCoverageDeviation (u4e00=一, GDD §4.2) ===');
var d1 = bundle.STROKE_DATA['4E00'];
ok('u4e00 存在且为「一」', d1 && d1.char === '一', d1 && d1.char);
ok('u4e00 含 _render_center', Array.isArray(d1._render_center) && d1._render_center.length === 2);
var med = d1.strokes[0].waypoints.map(function (p) { return [p[0] * 1024, p[1] * 1024]; });
var S = Tracing.densify(med, 24);
// 完美贴合：用户点 = 中位线采样点
var perfect = S.map(function (p) { return [p[0], p[1]]; });
var rPerfect = Tracing.computeCoverageDeviation(perfect, med, 16.8);
ok('完美贴合 → C ≈ 1', rPerfect.C > 0.99, 'C=' + rPerfect.C);
ok('完美贴合 → D ≈ 0', rPerfect.D < 1e-6, 'D=' + rPerfect.D);
ok('完美贴合 → judge 通过', Tracing.judge(rPerfect.C, rPerfect.D, 16.8) === true);
// 远离：用户点整体偏移 +200
var far = S.map(function (p) { return [p[0] + 200, p[1] + 200]; });
var rFar = Tracing.computeCoverageDeviation(far, med, 16.8);
ok('远离 → C 低 (<0.5)', rFar.C < 0.5, 'C=' + rFar.C);
ok('远离 → D 大 (>100)', rFar.D > 100, 'D=' + rFar.D);
ok('远离 → judge 失败', Tracing.judge(rFar.C, rFar.D, 16.8) === false);

console.log('\n=== 5) isOrderCorrect (GDD §4.4, AC2/AC7) ===');
ok('顺序正确前缀 → true', Tracing.isOrderCorrect([0, 1], [0, 1, 2]) === true);
ok('顺序错位 → false', Tracing.isOrderCorrect([0, 2], [0, 1, 2]) === false);
ok('空序列对非空 order → true', Tracing.isOrderCorrect([], [0, 1]) === true);
ok('超长序列 → false', Tracing.isOrderCorrect([0, 1, 2], [0, 1]) === false);
ok('order 缺失(null) → 退化为任意顺序 true', Tracing.isOrderCorrect([2, 0, 1], null) === true);

console.log('\n=== 6) Storage v1→v2 迁移 + 读写 (GDD §5) ===');
function fakeBackend() {
  var m = {};
  return {
    getItem: function (k) { return (k in m) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; }
  };
}
// 6a 缺档 → 默认存档（含全部必填字段）
var be1 = fakeBackend();
var fresh = Storage.load(be1);
ok('缺档 → version === 2', fresh.version === 2, fresh.version);
ok('缺档 → settings 存在', !!fresh.settings);
ok('缺档 → learned 对象', fresh.learned && typeof fresh.learned === 'object');
ok('缺档 → characters 对象', fresh.characters && typeof fresh.characters === 'object');
ok('缺档 → daily_task === null', fresh.daily_task === null);
ok('缺档 → active_minutes_today === 0', fresh.active_minutes_today === 0);

// 6b 写入 → 读回 roundtrip（含 settings 持久化）
fresh.settings.new_per_day = 4;
fresh.learned['4E00'] = true;
fresh.characters['4E00'] = { stage: 'R1', next_date: '2025-01-02', last_result: true, proficiency: 0.2 };
fresh.active_minutes_today = 7;
Storage.save(fresh, be1);
var back = Storage.load(be1);
ok('roundtrip settings.new_per_day === 4', back.settings.new_per_day === 4, back.settings.new_per_day);
ok('roundtrip learned 持久化', back.learned['4E00'] === true);
ok('roundtrip characters 持久化', back.characters['4E00'] && back.characters['4E00'].stage === 'R1');
ok('roundtrip active_minutes_today === 7', back.active_minutes_today === 7, back.active_minutes_today);

// 6c v1 → v2 迁移：learned 为数组，补 characters/daily_task
var be2 = fakeBackend();
be2.setItem(Storage.KEY, JSON.stringify({
  version: 1,
  learned: ['4E00', '4E8C'],
  settings: { new_per_day: 5 }
}));
var migrated = Storage.load(be2);
ok('v1 迁移 → version === 2', migrated.version === 2, migrated.version);
ok('v1 迁移 → learned["4E00"]===true', migrated.learned['4E00'] === true);
ok('v1 迁移 → learned["4E8C"]===true', migrated.learned['4E8C'] === true);
ok('v1 迁移 → characters 由 learned 派生(stage R0)', migrated.characters['4E00'] && migrated.characters['4E00'].stage === 'R0');
ok('v1 迁移 → settings.new_per_day 保留为 5', migrated.settings.new_per_day === 5, migrated.settings.new_per_day);
ok('v1 迁移 → daily_task === null (补齐)', migrated.daily_task === null);
ok('v1 迁移 → active_minutes_today === 0 (补齐)', migrated.active_minutes_today === 0);

// 6d 损坏 JSON → 回退默认（不抛）
var be3 = fakeBackend();
be3.setItem(Storage.KEY, '{not valid json');
var recovered = Storage.load(be3);
ok('损坏 JSON → 回退默认 version===2', recovered.version === 2);

console.log('\n=== 7) Bundle 完整性 ===');
ok('STROKE_DATA 含 50 字', Object.keys(bundle.STROKE_DATA).length === 50, Object.keys(bundle.STROKE_DATA).length);
ok('CHAR_META 含 50 字', Object.keys(bundle.CHAR_META).length === 50, Object.keys(bundle.CHAR_META).length);
ok('每字都含 _render_center', Object.keys(bundle.STROKE_DATA).every(function (k) {
  return Array.isArray(bundle.STROKE_DATA[k]._render_center);
}));
ok('CHAR_META 含拼音(一=yī)', bundle.CHAR_META['4E00'] && bundle.CHAR_META['4E00'].pinyin === 'yī', bundle.CHAR_META['4E00'] && bundle.CHAR_META['4E00'].pinyin);
ok('CHAR_META 含配色(一 main=#FFC93C)', bundle.CHAR_META['4E00'] && bundle.CHAR_META['4E00'].main_color === '#FFC93C');

console.log('\n========================================');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) {
  console.log('FAILED: ' + fails.join('; '));
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED ✅');
}
