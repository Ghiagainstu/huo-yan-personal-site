// 认证：注册 / 登录 / 登出（昵称 + 4 位 PIN）
// 注册保护：
//   - 邀请码体系：每人唯一6位邀请码；名额=min(3+累计登录天数,10)-已用；全局码(INVITE_CODE,默认20260812)注册不消耗名额
//   - 总账号上限 100
//   - L2 防护：同 IP 注册限频（每小时 5 次）+ PIN 连续错误锁定（15 分钟窗口内 5 次错锁）
import { json, pinHash, cnDate } from './_lib.js';

const GLOBAL_INVITE = '20260812';           // 管理员码（环境变量 INVITE_CODE 可覆盖），用它注册不消耗名额
const MAX_USERS = 100;                      // 总账号上限
const BANNED_NAMES = ['admin', 'root', 'test', 'administrator', 'system', 'owner', 'guest', '匿名'];
const INVITE_INIT = 3;                      // 初始邀请名额
const INVITE_MAX = 20;                      // 邀请名额上限（用户确认：单个用户上限 20）
const INVITE_PER_DAY = 1;                   // 每累计登录一天 +1
const REG_IP_LIMIT = 10;                    // 同 IP 每小时最多成功注册次数（失败尝试不计）
const PIN_FAIL_LIMIT = 5;                   // 15 分钟窗口内 PIN 连续错误上限
const FREE_EMOJIS = ['🐭','🐮','🐯','🐰','🐲','🐍','🐴','🐑','🐵','🐔','🐶','🐷']; // 12 生肖免费头像

// 生成唯一 6 位数字邀请码
async function genInviteCode(db) {
  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hit = await db.prepare('SELECT id FROM users WHERE invite_code = ?').bind(code).first();
    if (!hit) return code;
  }
  return '9' + String(Date.now()).slice(-5);
}

// 计算某用户剩余邀请名额
async function inviteQuota(db, userId, inviteUsed) {
  const d = await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM checkin WHERE user_id = ?').bind(userId).first();
  const maxQ = Math.min(INVITE_INIT + (d.n || 0) * INVITE_PER_DAY, INVITE_MAX);
  const used = inviteUsed || 0;
  return Math.max(0, maxQ - used);
}

// 请求方 IP（Cloudflare 回源头）
function ipOf(ctx) {
  return (ctx.request.headers.get('cf-connecting-ip') || '').slice(0, 45) || 'unknown';
}
// 时间窗口：小时块（IP 限频）与 15 分钟块（PIN 锁定）
function winHour() { return new Date().toISOString().slice(0, 13); }
function win15() { const d = new Date(); return d.toISOString().slice(0, 13) + Math.floor(d.getUTCMinutes() / 15); }
// 计数 +1（UPSERT）
async function bump(db, kind, key, window) {
  await db.prepare(
    'INSERT INTO rate_limit(kind, key, window, count) VALUES(?, ?, ?, 1) ' +
    'ON CONFLICT(kind, key, window) DO UPDATE SET count = count + 1'
  ).bind(kind, key, window).run();
}
async function getCount(db, kind, key, window) {
  const r = await db.prepare('SELECT count FROM rate_limit WHERE kind=? AND key=? AND window=?').bind(kind, key, window).first();
  return r ? r.count : 0;
}

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
  // 注册时头像：只允许 12 生肖免费 emoji 或上传图（积分解锁头像注册时不可用）
  let avatarVal = '';
  if (avatarOk) {
    const isEmoji = /^e:[^\s]{1,8}$/.test(avatar);
    if (isEmoji) { if (FREE_EMOJIS.includes(avatar.slice(2))) avatarVal = avatar; }
    else avatarVal = avatar;
  }

  if (action === 'register') {
    // 邀请码校验：全局码 或 个人码（扣邀请人名额）
    const invite = String(body.invite || '').trim();
    const globalCode = (ctx.env && ctx.env.INVITE_CODE) || GLOBAL_INVITE;
    let inviter = null;
    if (invite !== globalCode) {
      inviter = await db.prepare('SELECT id, invite_used FROM users WHERE invite_code = ?').bind(invite).first();
      if (!inviter) return json({ error: '邀请码不对，请向有账号的家长索取' }, 403);
      const quota = await inviteQuota(db, inviter.id, inviter.invite_used);
      if (quota <= 0) return json({ error: '邀请人的邀请名额已用完' }, 403);
    }
    // 昵称黑名单
    if (BANNED_NAMES.includes(nm.toLowerCase())) return json({ error: '该昵称不可用' }, 400);
    // 总账号上限
    const cnt = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (cnt.n >= MAX_USERS) return json({ error: '注册名额已满' }, 403);
    // 昵称唯一
    const exist = await db.prepare('SELECT id FROM users WHERE name = ?').bind(nm).first();
    if (exist) return json({ error: '该昵称已被使用，换一个或直接登录' }, 409);
    // L2-1 同 IP 注册限频（只统计真正成功的注册；先检查后入库）
    const ip = ipOf(ctx);
    if (await getCount(db, 'reg_ip', ip, winHour()) >= REG_IP_LIMIT) {
      return json({ error: '注册太频繁，请一小时后再试' }, 429);
    }
    // 生成本人邀请码并入库
    const myCode = await genInviteCode(db);
    await db.prepare('INSERT INTO users(name, pin_hash, avatar, invite_code) VALUES(?, ?, ?, ?)').bind(nm, hash, avatarVal, myCode).run();
    await bump(db, 'reg_ip', ip, winHour());   // 成功注册后计数
    // 消耗邀请人 1 个名额 + 邀请双方奖励（各 +10 积分 + 各 +1 次盲盒机会）
    if (inviter) {
      await db.prepare('UPDATE users SET invite_used = invite_used + 1 WHERE id = ?').bind(inviter.id).run();
      const nu = await db.prepare('SELECT id FROM users WHERE name = ?').bind(nm).first();
      if (nu) {
        // 邀请人：invite_used*10 已在积分公式自动入账；再补 1 次盲盒机会
        await bump(db, 'box_bonus', String(inviter.id), 'all');
        // 被邀请人：invite_reward +1（积分公式折算 +10）+ 1 次盲盒机会
        await bump(db, 'invite_reward', String(nu.id), 'all');
        await bump(db, 'box_bonus', String(nu.id), 'all');
      }
    }
  } else if (action === 'login') {
    const w15 = win15();
    const u = await db.prepare('SELECT id, pin_hash FROM users WHERE name = ?').bind(nm).first();
    if (!u || u.pin_hash !== hash) {
      // L2-2 PIN 连续错误锁定
      await bump(db, 'pin_fail', nm.toLowerCase(), w15);
      if (await getCount(db, 'pin_fail', nm.toLowerCase(), w15) >= PIN_FAIL_LIMIT) {
        return json({ error: 'PIN 错误次数过多，请 15 分钟后再试' }, 429);
      }
      return json({ error: '昵称或 PIN 不对' }, 401);
    }
    // 登录成功：清失败计数
    await db.prepare('DELETE FROM rate_limit WHERE kind = ? AND key = ?').bind('pin_fail', nm.toLowerCase()).run();
  } else {
    return json({ error: '参数错误' }, 400);
  }

  const u = await db.prepare('SELECT id, name, avatar, invite_code, invite_used FROM users WHERE name = ?').bind(nm).first();
  // 老用户没有邀请码时懒生成
  if (!u.invite_code) {
    const c = await genInviteCode(db);
    await db.prepare('UPDATE users SET invite_code = ? WHERE id = ?').bind(c, u.id).run();
    u.invite_code = c;
  }
  const token = crypto.randomUUID();
  await db.prepare('INSERT INTO sessions(token, user_id) VALUES(?, ?)').bind(token, u.id).run();

  // 登录即签到（按中国日期，避免 UTC 时区差一天）
  const today = cnDate(body);
  await db.prepare('INSERT OR IGNORE INTO checkin(user_id, date, stars) VALUES(?, ?, 0)').bind(u.id, today).run();

  const quota = await inviteQuota(db, u.id, u.invite_used);
  return json({ token, user: { id: u.id, name: u.name, avatar: u.avatar || '', invite_code: u.invite_code || '', invite_quota: quota, invite_max: INVITE_MAX } });
}

// 登出：DELETE /api/auth，Authorization: Bearer <token>
export async function onRequestDelete(ctx) {
  const auth = ctx.request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) await ctx.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}
