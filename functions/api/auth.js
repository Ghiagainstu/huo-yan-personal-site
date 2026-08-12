// 认证：注册 / 登录 / 登出（昵称 + 4 位 PIN）
import { json, pinHash, cnDate } from './_lib.js';

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const { action, name, pin } = body;
  const nm = typeof name === 'string' ? name.trim().slice(0, 20) : '';
  if (!nm || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return json({ error: '请输入昵称和 4 位数字 PIN' }, 400);
  }
  const hash = await pinHash(nm, pin);

  if (action === 'register') {
    const exist = await db.prepare('SELECT id FROM users WHERE name = ?').bind(nm).first();
    if (exist) return json({ error: '该昵称已被使用，换一个或直接登录' }, 409);
    await db.prepare('INSERT INTO users(name, pin_hash) VALUES(?, ?)').bind(nm, hash).run();
  } else if (action === 'login') {
    const u = await db.prepare('SELECT id, pin_hash FROM users WHERE name = ?').bind(nm).first();
    if (!u || u.pin_hash !== hash) return json({ error: '昵称或 PIN 不对' }, 401);
  } else {
    return json({ error: '参数错误' }, 400);
  }

  const u = await db.prepare('SELECT id, name FROM users WHERE name = ?').bind(nm).first();
  const token = crypto.randomUUID();
  await db.prepare('INSERT INTO sessions(token, user_id) VALUES(?, ?)').bind(token, u.id).run();

  // 登录即签到（按中国日期，避免 UTC 时区差一天）
  const today = cnDate(body);
  await db.prepare('INSERT OR IGNORE INTO checkin(user_id, date, stars) VALUES(?, ?, 0)').bind(u.id, today).run();

  return json({ token, user: { id: u.id, name: u.name } });
}

// 登出：DELETE /api/auth，Authorization: Bearer <token>
export async function onRequestDelete(ctx) {
  const auth = ctx.request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) await ctx.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}
