/*
 * storage.js — 本地存档与断点续学（daily-rhythm GDD §5, ADR-003 等价）
 * classic script（window.Storage / module.exports）。
 *
 * 结构（严格含任务要求的字段）：settings / learned / characters / daily_task / active_minutes_today。
 * 读写加 try/catch；支持 v1 → v2 迁移（补齐缺失字段）。
 * 后端可注入（node 测试用假后端）；浏览器默认 localStorage，file:// 不可用时回退内存。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Storage = api;
  if (typeof global !== 'undefined') global.Storage = api;
})(this, function () {
  'use strict';

  var SAVE_VERSION = 2;
  var KEY = 'child-literacy-save-v1';

  function defaultSettings() {
    return {
      new_per_day: 3,      // 2..5，默认 3
      reduce_motion: false,
      high_contrast: false,
      font_scale: 1.0,     // 1.0 / 1.3
      sound_on: true
    };
  }

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      settings: defaultSettings(),
      learned: {},          // char_id -> true（R0 起即计入"已学"）
      characters: {},       // char_id -> { stage, next_date, last_result, proficiency }
      daily_task: null,     // { date, items:[{char_id, kind, state}] }
      active_minutes_today: 0
    };
  }

  // 默认后端：localStorage（带探测），file:// 受限或不可用时回退内存
  function defaultBackend() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var probe = '__cl_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return localStorage;
      }
    } catch (e) { /* file:// 或隐私模式受限 */ }
    var mem = {};
    return {
      getItem: function (k) { return (k in mem) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  // v1 → v2：补齐 settings / learned / characters / daily_task / active_minutes_today
  function migrateV1toV2(data) {
    data = data || {};
    var out = { version: SAVE_VERSION };

    // settings
    out.settings = defaultSettings();
    if (data.settings && typeof data.settings === 'object') {
      for (var sk in out.settings) {
        if (data.settings[sk] !== undefined) out.settings[sk] = data.settings[sk];
      }
    }

    out.learned = {};
    out.characters = {};

    // learned：v1 可能是数组或字典
    if (data.learned) {
      if (Array.isArray(data.learned)) {
        data.learned.forEach(function (c) {
          out.learned[c] = true;
          if (!out.characters[c]) out.characters[c] = { stage: 'R0', next_date: '', last_result: false, proficiency: 0 };
        });
      } else if (typeof data.learned === 'object') {
        Object.keys(data.learned).forEach(function (c) {
          var v = data.learned[c];
          out.learned[c] = true;
          if (v && typeof v === 'object') {
            out.characters[c] = { stage: v.stage || 'R0', next_date: v.next_date || '', last_result: !!v.last_result, proficiency: (v.proficiency || 0) };
          } else {
            out.characters[c] = { stage: 'R0', next_date: '', last_result: false, proficiency: 0 };
          }
        });
      }
    }

    // characters：覆盖/补充（以 characters 为准）
    if (data.characters && typeof data.characters === 'object') {
      Object.keys(data.characters).forEach(function (c) {
        var v = data.characters[c] || {};
        out.characters[c] = {
          stage: v.stage || 'R0',
          next_date: v.next_date || '',
          last_result: !!v.last_result,
          proficiency: (v.proficiency || 0)
        };
        out.learned[c] = true;
      });
    }

    out.daily_task = (data.daily_task != null) ? data.daily_task : null;
    out.active_minutes_today = (typeof data.active_minutes_today === 'number') ? data.active_minutes_today : 0;
    return out;
  }

  function ensureFields(d) {
    if (!d || typeof d !== 'object') d = {};
    if (typeof d.version !== 'number') d.version = SAVE_VERSION;
    if (!d.settings) d.settings = defaultSettings();
    else {
      var ds = defaultSettings();
      for (var k in ds) if (d.settings[k] === undefined) d.settings[k] = ds[k];
    }
    if (!d.learned) d.learned = {};
    if (!d.characters) d.characters = {};
    if (d.daily_task === undefined) d.daily_task = null;
    if (typeof d.active_minutes_today !== 'number') d.active_minutes_today = 0;
    return d;
  }

  function load(backend) {
    backend = backend || defaultBackend();
    var raw = null;
    try { raw = backend.getItem(KEY); } catch (e) { raw = null; }
    if (raw == null) return defaultSave();
    var data = null;
    try { data = JSON.parse(raw); } catch (e) { data = null; }
    if (!data || typeof data !== 'object') return defaultSave();
    if (data.version === undefined || data.version < SAVE_VERSION) data = migrateV1toV2(data);
    return ensureFields(data);
  }

  function save(snapshot, backend) {
    backend = backend || defaultBackend();
    try {
      var data = (snapshot && typeof snapshot === 'object') ? snapshot : {};
      data = ensureFields(data);
      backend.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function reset(backend) {
    backend = backend || defaultBackend();
    try { backend.removeItem(KEY); } catch (e) {}
  }

  return {
    load: load,
    save: save,
    reset: reset,
    defaultSave: defaultSave,
    migrateV1toV2: migrateV1toV2,
    ensureFields: ensureFields,
    SAVE_VERSION: SAVE_VERSION,
    KEY: KEY
  };
});
