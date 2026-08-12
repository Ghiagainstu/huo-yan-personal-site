// 更新用户头像
// POST /api/avatar  body: { token, avatar }
import { json, getUserByToken } from './_lib.js';

const AVATAR_MAX = 300000; // dataURL 上限约 300KB

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);

  let avatar = String(body.avatar || '').slice(0, AVATAR_MAX);
  const isEmoji = /^e:[^\s]{1,8}$/.test(avatar);
  const isData = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar);
  if (!isEmoji && !isData) return json({ error: '头像格式不对' }, 400);

  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, u.id).run();
  return json({ ok: true, avatar });
}
