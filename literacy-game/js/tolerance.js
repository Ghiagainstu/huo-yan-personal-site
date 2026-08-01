/*
 * tolerance.js — 描红容差模型（tracing-judgment GDD §4.3, AC4）
 * 纯逻辑 / 无 DOM / 无副作用。classic script：浏览器挂 window.Tolerance，
 * node 下 module.exports，便于测试。
 *
 * 严格复刻 GDD 公式（禁止自创）：
 *   T = max(T_MIN, T0 * (1 - K * P))
 *   P ∈ [0,1] 熟练度；T 单位 = 1024 虚拟坐标系（与笔迹数据同尺度）。
 *   T0=24, T_MIN=10, K=0.6。
 *   恒 T≥10 保零挫败（AC4）。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Tolerance = api;
  if (typeof global !== 'undefined') global.Tolerance = api;
})(this, function () {
  'use strict';

  var T0 = 24.0;       // 新手基准容差（1024 空间单位）
  var T_MIN = 10.0;    // 容差下限（恒宽松，保零挫败）
  var K = 0.6;         // 收紧系数

  // T = max(T_MIN, T0 * (1 - K * P))
  function tolerance(P) {
    P = Number(P);
    if (!isFinite(P)) P = 0;
    if (P < 0) P = 0;
    if (P > 1) P = 1;
    return Math.max(T_MIN, T0 * (1.0 - K * P));
  }

  return {
    tolerance: tolerance,
    T0: T0,
    T_MIN: T_MIN,
    K: K
  };
});
