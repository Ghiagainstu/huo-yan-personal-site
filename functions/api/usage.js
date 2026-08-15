// 防沉迷：每日学习时长预算 + 家长解锁（服务端持久化，D1）
// GET  /api/usage?token=...&date=YYYY-MM-DD  -> 当日状态
// POST /api/usage  body: { token, action:'add', seconds, date? }            -> 累加活跃秒数
// POST /api/usage  body: { token, action:'unlock', pin, date? }             -> 家长PIN校验后 +1 解锁次数
import { json, getUserByToken, pinHash, cnDate } from './_lib.js';

const BASE_SECONDS = 20 * 60;    // 单次默认 20 分钟
const EXTEND_SECONDS = 20 * 60;  // 每次家长解锁延长 20 分钟
const MAX_UNLOCKS = 2;           // 最多解锁 2 次 -> 日上限 1 小时
const ADMIN_PIN = '852121';      // 内测管理解锁码：不受每日次数上限限制（仍延长预算）

const CREATE = `CREATE TABLE IF NOT EXISTS usage_limit (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  used_seconds INTEGER NOT NULL DEFAULT 0,
  unlock_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
)`;

async function ensureTable(db) { await db.prepare(CREATE).run(); }

async function getRow(db, userId, date) {
  return db.prepare('SELECT used_seconds, unlock_count FROM usage_limit WHERE user_id=? AND date=?')
    .bind(userId, date).first();
}

function stateOf(row) {
  const unlockCount = row ? (row.unlock_count || 0) : 0;
  const used = row ? (row.used_seconds || 0) : 0;
  const budget = BASE_SECONDS + unlockCount * EXTEND_SECONDS;
  const remaining = Math.max(0, budget - used);
  return {
    budget_seconds: budget,
    used_seconds: used,
    unlock_count: unlockCount,
    max_unlocks: MAX_UNLOCKS,
    remaining_seconds: remaining,
    locked: remaining <= 0
  };
}

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token');
  const u = await getUserByToken(db, token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTable(db);
  const today = cnDate({ date: url.searchParams.get('date') });
  const st = stateOf(await getRow(db, u.id, today));
  return json({ ok: true, date: today, ...st });
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTable(db);
  const today = cnDate(body);
  const action = body.action;

  if (action === 'add') {
    // 单次最多 +300 秒，防刷；used 累加（服务端为准，清缓存也无法重置）
    const sec = Math.max(0, Math.min(300, Math.floor(Number(body.seconds) || 0)));
    if (sec <= 0) return json({ ok: true, date: today, ...stateOf(await getRow(db, u.id, today)) });
    await db.prepare(
      `INSERT INTO usage_limit(user_id, date, used_seconds, unlock_count) VALUES(?, ?, ?, 0)
       ON CONFLICT(user_id, date) DO UPDATE SET used_seconds = used_seconds + excluded.used_seconds`
    ).bind(u.id, today, sec).run();
    return json({ ok: true, date: today, ...stateOf(await getRow(db, u.id, today)) });
  }

  if (action === 'unlock') {
    // 解锁码由前端在锁屏时随机生成（中文数字文字展示），家长按对应阿拉伯数字输入；
    // 后端不再校验固定 PIN，只负责记账：未达上限则 +1 解锁次数（预算延长由 stateOf 计算）。
    // admin_pin === ADMIN_PIN（852121）为内测管理解锁：跳过每日次数上限，仍 +1 延长预算。
    const admin = body.admin_pin === ADMIN_PIN;
    if (!admin) {
      const st0 = stateOf(await getRow(db, u.id, today));
      if (st0.unlock_count >= MAX_UNLOCKS) return json({ error: '今日解锁次数已用完' }, 429);
    }
    await db.prepare(
      `INSERT INTO usage_limit(user_id, date, used_seconds, unlock_count) VALUES(?, ?, 0, 1)
       ON CONFLICT(user_id, date) DO UPDATE SET unlock_count = unlock_count + 1`
    ).bind(u.id, today).run();
    return json({ ok: true, date: today, ...stateOf(await getRow(db, u.id, today)) });
  }

  return json({ error: '参数错误' }, 400);
}

// 家长 PIN 复用游玩 PIN，但允许用全角 / 中文数字形式输入（不必另记一个密码）
// 全角 ０-９ / 小写中文数字 零一二三... / 大写中文数字 壹贰叁...
function normalizePin(s) {
  const map = {
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
    '零': '0', '〇': '0', '一': '1', '二': '2', '两': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9',
    '壹': '1', '貳': '2', '贰': '2', '參': '3', '叁': '3', '肆': '4', '伍': '5', '陸': '6', '陆': '6', '柒': '7', '捌': '8', '玖': '9'
  };
  let out = '';
  for (const ch of (s || '')) {
    if (map[ch] !== undefined) out += map[ch];
    else if (/[0-9]/.test(ch)) out += ch; // 半角数字原样保留
  }
  return out;
}
