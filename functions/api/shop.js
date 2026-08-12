// 积分商城：商品目录 + 兑换（动态积分 - 已消费 >= 价格）
// GET  /api/shop          -> 商品目录
// POST /api/shop          body: { token, item_id }  -> 兑换
import { json, getUserByToken } from './_lib.js';

// 商品目录（价格权威在后端；前端展示用同一份）
const SHOP = {
  'frame-teal':    { type: 'frame', name: '青绿边框',   price: 40 },
  'frame-silver':  { type: 'frame', name: '银色边框',   price: 50 },
  'frame-pink':    { type: 'frame', name: '粉色边框',   price: 100 },
  'frame-orange':  { type: 'frame', name: '橙色边框',   price: 100 },
  'frame-gold':    { type: 'frame', name: '金色边框',   price: 120 },
  'frame-rainbow': { type: 'frame', name: '彩虹边框',   price: 200 },
  'frame-star':    { type: 'frame', name: '星星边框',   price: 300 },
  'frame-fire':    { type: 'frame', name: '火焰边框',   price: 350 },
  'frame-dia':     { type: 'frame', name: '钻石边框',   price: 400 },
  'frame-crown':   { type: 'frame', name: '皇冠边框',   price: 500 },
  'title-0':       { type: 'title', name: '小小新手',   price: 30 },
  'title-1':       { type: 'title', name: '学习达人',   price: 100 },
  'title-4':       { type: 'title', name: '百词小将',   price: 150 },
  'title-5':       { type: 'title', name: '坚持之星',   price: 200 },
  'title-2':       { type: 'title', name: '单词大师',   price: 250 },
  'title-6':       { type: 'title', name: '人气王',     price: 300 },
  'title-3':       { type: 'title', name: '超级学霸',   price: 500 },
  'title-7':       { type: 'title', name: '词汇之王',   price: 800 }
};

// 动态积分：掌握词×2 + 累计签到天×5 + 成功邀请×10
async function dynamicScore(db, userId) {
  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(userId).first()).n;
  const days = (await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM checkin WHERE user_id=?').bind(userId).first()).n;
  const inv = (await db.prepare('SELECT invite_used FROM users WHERE id=?').bind(userId).first()).invite_used || 0;
  return (mastered || 0) * 2 + (days || 0) * 5 + (inv || 0) * 10;
}

function parseItems(s) {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

export async function onRequestGet(ctx) {
  return json({ items: SHOP });
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);

  const item = SHOP[body.item_id];
  if (!item) return json({ error: '商品不存在' }, 400);

  const row = await db.prepare('SELECT points_spent, items FROM users WHERE id=?').bind(u.id).first();
  const spent = row.points_spent || 0;
  const owned = parseItems(row.items);
  if (owned.includes(body.item_id)) return json({ error: '已经拥有啦' }, 400);

  const score = await dynamicScore(db, u.id);
  const available = score - spent;
  if (available < item.price) return json({ error: '积分不够，继续学习攒分吧' }, 400);

  owned.push(body.item_id);
  await db.prepare('UPDATE users SET points_spent = ?, items = ? WHERE id = ?')
    .bind(spent + item.price, JSON.stringify(owned), u.id).run();

  return json({ ok: true, item_id: body.item_id, name: item.name, available: score - spent - item.price });
}
