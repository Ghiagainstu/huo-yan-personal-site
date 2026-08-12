// 更新用户头像
// POST /api/avatar  body: { token, avatar }
import { json, getUserByToken } from './_lib.js';

const AVATAR_MAX = 300000; // dataURL 上限约 300KB

// 12 生肖免费头像（emoji）
const FREE_EMOJIS = ['🐭','🐮','🐯','🐰','🐲','🐍','🐴','🐑','🐵','🐔','🐶','🐷'];
// 积分解锁头像：商品 id -> emoji
const LOCKED_AVATARS = {
  'avatar-koala':'🐨','avatar-octopus':'🐙','avatar-whale':'🐳','avatar-owl':'🦉',
  'avatar-butterfly':'🦋','avatar-bee':'🐝','avatar-bear':'🐻','avatar-panda':'🐼'
};

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);

  let avatar = String(body.avatar || '').slice(0, AVATAR_MAX);
  const isEmoji = /^e:[^\s]{1,8}$/.test(avatar);
  const isData = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar);
  if (!isEmoji && !isData) return json({ error: '头像格式不对' }, 400);

  // 预设 emoji 头像：必须免费生肖 或 已通过商城解锁
  if (isEmoji) {
    const emoji = avatar.slice(2);
    if (!FREE_EMOJIS.includes(emoji)) {
      const row = await db.prepare('SELECT items FROM users WHERE id=?').bind(u.id).first();
      let owned = [];
      try { const a = JSON.parse(row && row.items || '[]'); if (Array.isArray(a)) owned = a; } catch (e) {}
      const unlocked = Object.keys(LOCKED_AVATARS).filter(k => owned.includes(k)).map(k => LOCKED_AVATARS[k]);
      if (!unlocked.includes(emoji)) return json({ error: '这个头像还没解锁，去商城看看吧' }, 403);
    }
  }

  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, u.id).run();
  return json({ ok: true, avatar });
}
