// 认证：注册 / 登录 / 登出（昵称 + 4 位 PIN）
// 注册保护：邀请码（环境变量 INVITE_CODE，默认 8688）+ 总账号上限 + 昵称黑名单
import { json, pinHash, cnDate } from './_lib.js';

const DEFAULT_INVITE = '8688';                      // 默认邀请码（可在 Cloudflare 环境变量 INVITE_CODE 覆盖）
const MAX_USERS = 200;                              // 总账号上限，防刷爆 D1 免费额度
const BANNED_NAMES = ['admin', 'root', 'test', 'administrator', 'system', 'owner', 'guest', '匿名'];

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const { action, name, pin } = body;
  const nm = typeof name === 'string' ? name.trim().slice(0, 20) : '';
  if (!nm || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return json({ error: '请输入昵称和 4 位数字 PIN' }, 400);
  }
  const hash = await pinHash(nm, pin);
  const avatar = String(body.avatar || '').slice(0, 300000);
  const avatarOk = /^e:[^\s]{1,8}$/.test(avatar) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar);
  const avatarVal = avatarOk ? avatar : '';

  if (action === 'register') {
    // 1) 邀请码校验（没码一律拒绝，防恶意批量注册）
    const invite = String(body.invite || '').trim();
    const inviteOk = (ctx.env && ctx.env.INVITE_CODE) || DEFAULT_INVITE;
    if (invite !== inviteOk) return json({ error: '注册需要邀请码，请向家长索取' }, 403);
    // 2) 昵称黑名单
    if (BANNED_NAMES.includes(nm.toLowerCase())) return json({ error: '该昵称不可用' }, 400);
    // 3) 总账号上限
    const cnt = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (cnt.n >= MAX_USERS) return json({ error: '注册名额已满' }, 403);
    // 4) 昵称唯一
    const exist = await db.prepare('SELECT id FROM users WHERE name = ?').bind(nm).first();
    if (exist) return json({ error: '该昵称已被使用，换一个或直接登录' }, 409);
    await db.prepare('INSERT INTO users(name, pin_hash, avatar) VALUES(?, ?, ?)').bind(nm, hash, avatarVal).run();
  } else if (action === 'login') {
    const u = await db.prepare('SELECT id, pin_hash FROM users WHERE name = ?').bind(nm).first();
    if (!u || u.pin_hash !== hash) return json({ error: '昵称或 PIN 不对' }, 401);
  } else {
    return json({ error: '参数错误' }, 400);
  }

  const u = await db.prepare('SELECT id, name, avatar FROM users WHERE name = ?').bind(nm).first();
  const token = crypto.randomUUID();
  await db.prepare('INSERT INTO sessions(token, user_id) VALUES(?, ?)').bind(token, u.id).run();

  // 登录即签到（按中国日期，避免 UTC 时区差一天）
  const today = cnDate(body);
  await db.prepare('INSERT OR IGNORE INTO checkin(user_id, date, stars) VALUES(?, ?, 0)').bind(u.id, today).run();

  return json({ token, user: { id: u.id, name: u.name, avatar: u.avatar || '' } });
}

// 登出：DELETE /api/auth，Authorization: Bearer <token>
export async function onRequestDelete(ctx) {
  const auth = ctx.request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) await ctx.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}
