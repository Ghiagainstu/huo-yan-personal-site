// 用户主页数据（公开信息，无敏感字段）
// GET /api/user?name=XXX&token=... → { user: { name, avatar, items, mastered, days, invites, game_stars, score, box_points, pets:[{slug,rarity}], streak, rank_total, rank_score, total_users } }
import { json, getUserByToken } from './_lib.js';

// 与 me.js/rank.js 完全一致的口径
async function statsOf(db, u) {
  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(u.id).first()).n || 0;
  const days = (await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM checkin WHERE user_id=?').bind(u.id).first()).n || 0;
  const inv = await db.prepare('SELECT invite_used, game_stars, items FROM users WHERE id=?').bind(u.id).first();
  const invites = inv ? (inv.invite_used || 0) : 0;
  const gameStars = inv ? (inv.game_stars || 0) : 0;
  const boxPoints = (await db.prepare("SELECT count FROM rate_limit WHERE kind='box_points' AND key=? AND window='all'").bind(String(u.id)).first())?.count || 0;
  const score = mastered * 2 + days * 5 + invites * 10 + gameStars * 1 + boxPoints;
  let items = [];
  try { const a = JSON.parse(inv && inv.items || '[]'); if (Array.isArray(a)) items = a; } catch (e) {}
  // 宠物（含稀有度）
  let pets = [];
  try {
    pets = (await db.prepare('SELECT slug, rarity FROM box_owned WHERE user_id=?').bind(u.id).all()).results;
  } catch (e) {}
  // 连续签到天数（streak：从今天/昨天往前数连续日期）
  const RARITY_ORDER = { legend: 0, vrare: 1, rare: 2, common: 3 };
  pets.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9));
  return { mastered, days, invites, game_stars: gameStars, score, box_points: boxPoints, items, pets, streak: 0 };
}

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return json({ error: '缺少昵称' }, 400);
  const u = await db.prepare('SELECT id, name, avatar FROM users WHERE name=?').bind(name).first();
  if (!u) return json({ error: '用户不存在' }, 404);

  const st = await statsOf(db, u);
  // 连续签到
  const cn = (d) => { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const d = new Date();
  const set = new Set((await db.prepare('SELECT DISTINCT date AS date FROM checkin WHERE user_id=?').bind(u.id).all()).results.map(r => r.date));
  let streak = 0;
  let cursor = new Date(d.getTime());
  if (!set.has(cn(cursor))) cursor = new Date(d.getTime() - 86400000); // 今天没签就从昨天数
  while (set.has(cn(cursor))) { streak++; cursor = new Date(cursor.getTime() - 86400000); }
  st.streak = streak;

  // 排名：词汇榜(掌握词数) & 积分榜
  const all = (await db.prepare(
    `SELECT u.id,
      (SELECT COUNT(*) FROM progress p WHERE p.user_id=u.id AND p.level>=3) AS mastered,
      (SELECT COUNT(DISTINCT date) FROM checkin c WHERE c.user_id=u.id) AS days,
      u.invite_used, u.game_stars,
      COALESCE((SELECT count FROM rate_limit r WHERE r.kind='box_points' AND r.key=CAST(u.id AS TEXT) AND r.window='all'),0) AS box_points
     FROM users u`
  ).all()).results;
  const scored = all.map(r => ({
    id: r.id,
    mastered: r.mastered || 0,
    score: (r.mastered || 0) * 2 + (r.days || 0) * 5 + (r.invite_used || 0) * 10 + (r.game_stars || 0) + (r.box_points || 0)
  }));
  const total = all.length;
  const rankTotal = scored.filter(x => x.mastered > st.mastered).length + 1;
  const rankScore = scored.filter(x => x.score > st.score).length + 1;

  return json({
    user: {
      name: u.name, avatar: u.avatar || '',
      mastered: st.mastered, days: st.days, invites: st.invites, game_stars: st.game_stars,
      score: st.score, box_points: st.box_points,
      streak: st.streak, items: st.items, pets: st.pets,
      rank_total: rankTotal, rank_score: rankScore, total_users: total
    }
  });
}
