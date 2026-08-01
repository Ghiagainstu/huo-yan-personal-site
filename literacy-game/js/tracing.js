/*
 * tracing.js — 描红判定（无 OCR，tracing-judgment GDD §4.2/§4.3, AC1/AC2/AC4）
 * 纯几何：覆盖率 C + 偏差 D + 规范笔顺。classic script（window.Tracing / module.exports）。
 *
 * 坐标约定：所有几何在 1024 虚拟坐标系下运算（与笔迹数据同尺度），
 * 因此容差 T（由 Tolerance.tolerance(P) 给出，单位也是 1024 空间）可直接比较。
 * 渲染层把归一化 0..1 坐标 ×1024 即进入本空间；详见 render.js。
 *
 * 严格复刻 GDD 判定（禁止自创）：
 *   C = |{ s∈S : minDist(s,P) ≤ T }| / |S|        // S=中位线采样点集
 *   D = mean( minDist(p_i, S) )                     // 玩家点到中位线最近距均值
 *   PASS = (C ≥ 0.8) AND (D ≤ T)
 *   is_order_correct: 已描序列需为规范 order 的前缀。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Tracing = api;
  if (typeof global !== 'undefined') global.Tracing = api;
})(this, function () {
  'use strict';

  var COVERAGE_PASS = 0.8;   // C ≥ 0.8 通过（AC1）
  var DEFAULT_SAMPLES = 24;  // 中位线采样点数 N

  // 单笔判定：覆盖率 C(0..1) 且 偏差 D(1024 空间单位) ≤ T
  function judge(coverage, deviation, T) {
    return coverage >= COVERAGE_PASS && deviation <= T;
  }

  // --- 几何基础 ---
  function dist2(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }
  function dist(a, b) { return Math.sqrt(dist2(a, b)); }

  // 点 p 到线段 ab 的最短距离
  function pointSegDist(p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1];
    var wx = p[0] - a[0], wy = p[1] - a[1];
    var c1 = vx * wx + vy * wy;
    if (c1 <= 0) return dist(p, a);
    var c2 = vx * vx + vy * vy;
    if (c2 <= c1) return dist(p, b);
    var t = c1 / c2;
    var projx = a[0] + t * vx, projy = a[1] + t * vy;
    return dist(p, [projx, projy]);
  }

  // 点 p 到折线 pts（点序列）的最短距离
  function polylineNearestDist(p, pts) {
    if (pts.length === 1) return dist(p, pts[0]);
    var best = Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
      var d = pointSegDist(p, pts[i], pts[i + 1]);
      if (d < best) best = d;
    }
    return best;
  }

  // 按弧长把折线 waypoints 重采样为 n 个点（用于中位线采样集 S）
  function densify(waypoints, n) {
    n = n || DEFAULT_SAMPLES;
    if (!waypoints || waypoints.length === 0) return [];
    if (waypoints.length === 1) {
      var out = [];
      for (var z = 0; z < n; z++) out.push([waypoints[0][0], waypoints[0][1]]);
      return out;
    }
    // 累计弧长
    var segLen = [];
    var total = 0;
    for (var i = 0; i < waypoints.length - 1; i++) {
      var L = dist(waypoints[i], waypoints[i + 1]);
      segLen.push(L);
      total += L;
    }
    if (total === 0) return [waypoints[0].slice()];
    var result = [];
    for (var k = 0; k < n; k++) {
      var target = (total * k) / (n - 1); // 含首尾
      // 定位所在段
      var acc = 0, seg = 0;
      while (seg < segLen.length - 1 && acc + segLen[seg] < target) {
        acc += segLen[seg];
        seg++;
      }
      var segStart = waypoints[seg];
      var segEnd = waypoints[seg + 1];
      var local = segLen[seg] > 0 ? (target - acc) / segLen[seg] : 0;
      result.push([
        segStart[0] + (segEnd[0] - segStart[0]) * local,
        segStart[1] + (segEnd[1] - segStart[1]) * local
      ]);
    }
    return result;
  }

  /*
   * computeCoverageDeviation(userPoints, strokeMedians, T)
   *  - userPoints:      玩家轨迹点 [[x,y],...]，1024 空间
   *  - strokeMedians:   该笔画中位线 waypoints [[x,y],...]，1024 空间
   *  - T:               动态容差（1024 空间单位）
   * 返回 { C, D }。
   *   C = 中位线采样集 S 中被玩家点以 T 覆盖的比例
   *   D = 玩家采样点到中位线的最近距均值
   */
  function computeCoverageDeviation(userPoints, strokeMedians, T) {
    var S = densify(strokeMedians, DEFAULT_SAMPLES);
    if (S.length === 0) return { C: 0, D: Infinity };
    if (!userPoints || userPoints.length === 0) return { C: 0, D: Infinity };

    // 覆盖率：S 中每个采样点，若被任一玩家点以 ≤ T 覆盖则计入
    var covered = 0;
    for (var i = 0; i < S.length; i++) {
      var minToUser = Infinity;
      for (var j = 0; j < userPoints.length; j++) {
        var d = dist(S[i], userPoints[j]);
        if (d < minToUser) minToUser = d;
      }
      if (minToUser <= T) covered++;
    }
    var C = covered / S.length;

    // 偏差：每个玩家点到中位线的最近距均值
    var sum = 0;
    for (var k = 0; k < userPoints.length; k++) {
      sum += polylineNearestDist(userPoints[k], strokeMedians);
    }
    var D = sum / userPoints.length;

    return { C: C, D: D };
  }

  /*
   * isOrderCorrect(tracedSeq, expectedOrder)
   *  - tracedSeq:       玩家已描笔画下标序列（按完成顺序）
   *  - expectedOrder:   规范笔顺数组（来自数据 order 字段）
   * 已描序列需为规范 order 的前缀（AC2/AC7）。
   */
  function isOrderCorrect(tracedSeq, expectedOrder) {
    if (!expectedOrder) return true;            // 笔顺数据缺失 → 退化为任意顺序（GDD §6.2）
    if (!tracedSeq) return expectedOrder.length === 0;
    if (tracedSeq.length > expectedOrder.length) return false;
    for (var i = 0; i < tracedSeq.length; i++) {
      if (tracedSeq[i] !== expectedOrder[i]) return false;
    }
    return true;
  }

  return {
    judge: judge,
    computeCoverageDeviation: computeCoverageDeviation,
    isOrderCorrect: isOrderCorrect,
    densify: densify,
    pointSegDist: pointSegDist,
    polylineNearestDist: polylineNearestDist,
    COVERAGE_PASS: COVERAGE_PASS,
    DEFAULT_SAMPLES: DEFAULT_SAMPLES
  };
});
