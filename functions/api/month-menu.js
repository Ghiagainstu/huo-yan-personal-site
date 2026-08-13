// 一个月菜单 · 云端同步：买菜金额 / 备注 / 截图
// GET  /api/month-menu?token=...&year=YYYY&month=M        -> 当月所有日期的金额/备注/是否有截图（不含截图本体）
// GET  /api/month-menu?token=...&date=YYYY-MM-DD&full=1    -> 单日截图 base64（按需拉取，避免列表臃肿）
// POST /api/month-menu  body {token, date, amount, note, screenshot}  -> upsert 当日记录
import { json, getUserByToken } from './_lib.js';

// 建表（幂等）—— 无需单独迁移，首次访问自动创建
async function ensureTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS month_menu (
       user_id   INTEGER NOT NULL,
       date      TEXT    NOT NULL,
       amount    REAL    DEFAULT 0,
       note      TEXT    DEFAULT '',
       screenshot TEXT,
       updated_at INTEGER,
       PRIMARY KEY(user_id, date)
     )`
  ).run();
}

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token') || '';
  const u = await getUserByToken(db, token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTable(db);

  const date = url.searchParams.get('date');
  const full = url.searchParams.get('full') === '1';

  // 单日 + 完整截图
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const row = await db.prepare(
      'SELECT amount, note, screenshot FROM month_menu WHERE user_id=? AND date=?'
    ).bind(u.id, date).first();
    if (!row) return json({ date, amount: 0, note: '', screenshot: null });
    if (full) return json({ date, amount: row.amount || 0, note: row.note || '', screenshot: row.screenshot || null });
    return json({ date, amount: row.amount || 0, note: row.note || '', has_screenshot: !!row.screenshot });
  }

  // 当月列表（不含截图本体）
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  if (year && month && /^\d{4}$/.test(year) && /^\d{1,2}$/.test(month)) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const rows = await db.prepare(
      "SELECT date, amount, note, CASE WHEN screenshot IS NOT NULL THEN 1 ELSE 0 END AS has_screenshot " +
      'FROM month_menu WHERE user_id=? AND date LIKE ?'
    ).bind(u.id, ym + '%').all();
    const map = {};
    (rows.results || []).forEach(r => {
      map[r.date] = { amount: r.amount || 0, note: r.note || '', has_screenshot: !!r.has_screenshot };
    });
    return json({ year: +year, month: +month, entries: map });
  }

  return json({ error: '参数错误：需要 year&month 或 date' }, 400);
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const token = (ctx.request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    || (await ctx.request.json().catch(() => ({}))).token || '';
  const u = await getUserByToken(db, token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTable(db);

  const body = await ctx.request.json().catch(() => ({}));
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: '日期格式错误' }, 400);

  let amount = 0;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const n = Number(body.amount);
    if (!isFinite(n) || n < 0) return json({ error: '金额必须为非负数' }, 400);
    amount = Math.round(n * 100) / 100;
  }
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : '';
  // screenshot: 压缩后的 data URL（data:image/jpeg;base64,...）| null 表示清除 | undefined 表示不动该列
  let setShot = false, screenshot = null;
  if (body.screenshot === null) {
    setShot = true; screenshot = null;
  } else if (typeof body.screenshot === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.screenshot)) {
    if (body.screenshot.length > 1200000) return json({ error: '截图过大（请压缩到 1MB 内）' }, 413);
    setShot = true; screenshot = body.screenshot;
  }

  if (setShot) {
    await db.prepare(
      `INSERT INTO month_menu(user_id, date, amount, note, screenshot, updated_at)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         amount=excluded.amount, note=excluded.note, screenshot=excluded.screenshot, updated_at=excluded.updated_at`
    ).bind(u.id, date, amount, note, screenshot, Date.now()).run();
  } else {
    await db.prepare(
      `INSERT INTO month_menu(user_id, date, amount, note, updated_at)
       VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         amount=excluded.amount, note=excluded.note, updated_at=excluded.updated_at`
    ).bind(u.id, date, amount, note, Date.now()).run();
  }

  return json({ ok: true, date, amount, note, has_screenshot: setShot ? !!screenshot : undefined });
}
