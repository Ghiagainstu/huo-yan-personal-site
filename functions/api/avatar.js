// 更新用户头像
// POST /api/avatar  body: { token, avatar }
import { json, getUserByToken } from './_lib.js';

const AVATAR_MAX = 300000; // dataURL 上限约 300KB

// 12 生肖免费头像（emoji）
const FREE_EMOJIS = ['🐭','🐮','🐯','🐰','🐲','🐍','🐴','🐑','🐵','🐔','🐶','🐷'];
// 积分解锁头像：商品 id -> 展示值（emoji 或 AI 出图路径，与前端 LOCKED_AVATARS 一致）
const LOCKED_AVATARS = {
  'avatar-koala':'images/avatars/avatar-koala.webp','avatar-octopus':'images/avatars/avatar-octopus.webp',
  'avatar-whale':'images/avatars/avatar-whale.webp','avatar-owl':'images/avatars/avatar-owl.webp',
  'avatar-butterfly':'images/avatars/avatar-butterfly.webp','avatar-bee':'images/avatars/avatar-bee.webp',
  'avatar-bear':'images/avatars/avatar-bear.webp','avatar-panda':'images/avatars/avatar-panda.webp',
  'avatar-pixel-dragon':'images/avatars/pixel-dragon.webp','avatar-capybara':'images/avatars/capybara.webp',
  'avatar-dino':'images/avatars/dino.webp','avatar-unicorn':'images/avatars/unicorn.webp',
  'avatar-duck':'images/avatars/duck.webp','avatar-witch':'images/avatars/witch.webp'
};
// 头像白名单：合法存储值 = 免费生肖 emoji | 商城头像展示值 | dataURL（旧上传兼容，已停用入口）
function avatarAllowed(avatar) {
  if (/^e:[^\s]{1,8}$/.test(avatar)) return 'emoji';
  if (/^images\/avatars\/[a-z0-9-]+\.webp$/.test(avatar)) return 'img';
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)) return 'data';
  return '';
}
async function unlockedValues(db, userId) {
  const row = await db.prepare('SELECT items FROM users WHERE id=?').bind(userId).first();
  let owned = [];
  try { const a = JSON.parse(row && row.items || '[]'); if (Array.isArray(a)) owned = a; } catch (e) {}
  return { owned, unlocked: Object.keys(LOCKED_AVATARS).filter(k => owned.includes(k)).map(k => LOCKED_AVATARS[k]) };
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);

  let avatar = String(body.avatar || '').slice(0, AVATAR_MAX);
  const kind = avatarAllowed(avatar);
  if (!kind) return json({ error: '头像格式不对' }, 400);

  // 预设/商城头像：免费生肖直接放行；商城头像必须已通过商城解锁
  if (kind === 'emoji' || kind === 'img') {
    const { owned, unlocked } = await unlockedValues(db, u.id);
    if (kind === 'emoji') {
      const emoji = avatar.slice(2);
      if (!FREE_EMOJIS.includes(emoji) && !unlocked.includes(avatar)) {
        return json({ error: '这个头像还没解锁，去商城看看吧' }, 403);
      }
    } else {
      // AI 出图头像：必须是商城可解锁列表中的值，且该商品已购买
      const id = Object.keys(LOCKED_AVATARS).find(k => LOCKED_AVATARS[k] === avatar);
      if (!id) return json({ error: '头像格式不对' }, 400);
      if (!owned.includes(id)) return json({ error: '这个头像还没解锁，去商城看看吧' }, 403);
    }
  }

  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, u.id).run();
  return json({ ok: true, avatar });
}
