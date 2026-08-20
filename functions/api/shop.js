// 积分商城：商品目录 + 兑换（动态积分 - 已消费 >= 价格）
// GET  /api/shop          -> 商品目录
// POST /api/shop          body: { token, item_id }  -> 兑换
import { json, getUserByToken } from './_lib.js';

// 商品目录（价格权威在后端；前端展示用同一份）
const SHOP = {
  'avatar-koala':    { type: 'avatar', name: '考拉头像',   price: 30 },
  'avatar-octopus':  { type: 'avatar', name: '章鱼头像',   price: 30 },
  'avatar-whale':    { type: 'avatar', name: '鲸鱼头像',   price: 30 },
  'avatar-owl':      { type: 'avatar', name: '猫头鹰头像', price: 30 },
  'avatar-butterfly':{ type: 'avatar', name: '蝴蝶头像',   price: 30 },
  'avatar-bee':      { type: 'avatar', name: '蜜蜂头像',   price: 30 },
  'avatar-bear':     { type: 'avatar', name: '小熊头像',   price: 30 },
  'avatar-panda':    { type: 'avatar', name: '熊猫头像',   price: 30 },
  'avatar-pixel-dragon': { type: 'avatar', name: '像素小绿龙头像', price: 100 },
  'avatar-capybara':     { type: 'avatar', name: '卡皮巴拉头像',   price: 100 },
  'avatar-dino':         { type: 'avatar', name: '恐龙宝宝头像',   price: 100 },
  'avatar-unicorn':      { type: 'avatar', name: '彩虹独角兽头像', price: 100 },
  'avatar-duck':         { type: 'avatar', name: '黄油小黄鸭头像', price: 100 },
  'avatar-witch':        { type: 'avatar', name: '黑粉小魔女头像', price: 100 },
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

// 动态积分：掌握词×2 + 累计签到天×5 + 成功邀请×10 + 被邀请奖励×10 + 游戏星×1 + 盲盒入账
// 注意：必须与 /api/me 的 score 口径完全一致（含 game_stars + box_points + invite_reward），否则前端显示的可用积分虚高，购买时误报"积分不够"
async function dynamicScore(db, userId) {
  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(userId).first()).n;
  const days = (await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM checkin WHERE user_id=?').bind(userId).first()).n;
  const inv = (await db.prepare('SELECT invite_used, game_stars FROM users WHERE id=?').bind(userId).first());
  const invitesUsed = inv ? (inv.invite_used || 0) : 0;
  const gameStars = inv ? (inv.game_stars || 0) : 0;
  const bp = (await db.prepare('SELECT count FROM rate_limit WHERE kind=? AND key=? AND window=?').bind('box_points', String(userId), 'all').first());
  const boxPoints = bp ? bp.count : 0;
  const ir = (await db.prepare('SELECT count FROM rate_limit WHERE kind=? AND key=? AND window=?').bind('invite_reward', String(userId), 'all').first());
  const inviteRew = ir ? ir.count : 0;
  return (mastered || 0) * 2 + (days || 0) * 5 + invitesUsed * 10 + inviteRew * 10 + gameStars * 1 + boxPoints * 1;
}

function parseItems(s) {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

// 等级解锁链：必须从低等级逐级购买，买完上一级才解锁下一级
const FRAME_CHAIN = ['frame-teal','frame-silver','frame-pink','frame-orange','frame-gold','frame-rainbow','frame-star','frame-fire','frame-dia','frame-crown'];
const TITLE_CHAIN = ['title-0','title-1','title-4','title-5','title-2','title-6','title-3','title-7'];
function isUnlocked(itemId, owned) {
  if (itemId.indexOf('frame-') === 0) {
    const idx = FRAME_CHAIN.indexOf(itemId);
    if (idx <= 0) return true;
    return owned.includes(FRAME_CHAIN[idx - 1]);
  }
  if (itemId.indexOf('title-') === 0) {
    const idx = TITLE_CHAIN.indexOf(itemId);
    if (idx <= 0) return true;
    return owned.includes(TITLE_CHAIN[idx - 1]);
  }
  return true;   // avatar 等独立商品可直接兑换
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
  if (!isUnlocked(body.item_id, owned)) return json({ error: '请先解锁上一等级' }, 400);

  const score = await dynamicScore(db, u.id);
  const available = score - spent;
  if (available < item.price) return json({ error: '积分不够，继续学习攒分吧' }, 400);

  owned.push(body.item_id);
  await db.prepare('UPDATE users SET points_spent = ?, items = ? WHERE id = ?')
    .bind(spent + item.price, JSON.stringify(owned), u.id).run();

  return json({ ok: true, item_id: body.item_id, name: item.name, available: score - spent - item.price });
}
