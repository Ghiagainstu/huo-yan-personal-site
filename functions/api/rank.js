// 排行榜：总榜 / 积分榜 / 本周 / 今日（含头像）
// GET /api/rank?type=total|score|week|day&token=...
import { json, getUserByToken } from './_lib.js';

// 积分 = 已掌握词数×2 + 累计签到天数×5 + 成功邀请×10
function scoreOf(mastered, days, invites) {
  return (mastered || 0) * 2 + (days || 0) * 5 + (invites || 0) * 10;
}

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token') || '';
  const type = url.searchParams.get('type') || 'total';
  const me = await getUserByToken(db, token);
  let rows = [];

  if (type === 'week') {
    rows = await db.prepare(
      `SELECT u.name, u.avatar, SUM(c.stars) AS stars, COUNT(DISTINCT c.date) AS days
       FROM checkin c JOIN users u ON u.id = c.user_id
       WHERE c.date >= date('now','-6 days')
       GROUP BY u.id ORDER BY stars DESC, days DESC, u.id ASC LIMIT 20`
    ).all();
  } else if (type === 'day') {
    rows = await db.prepare(
      `SELECT u.name, u.avatar, c.stars AS stars
       FROM checkin c JOIN users u ON u.id = c.user_id
       WHERE c.date = date('now')
       ORDER BY stars DESC, u.id ASC LIMIT 20`
    ).all();
  } else {
    // total / score：带积分字段
    rows = await db.prepare(
      `SELECT u.id, u.name, u.avatar, u.invite_used AS invites,
              (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id AND p.level >= 3) AS mastered,
              (SELECT COUNT(DISTINCT date) FROM checkin c WHERE c.user_id = u.id) AS days
       FROM users u LIMIT 100`
    ).all();
    rows = rows.results.map(r => ({
      id: r.id, name: r.name, avatar: r.avatar,
      mastered: r.mastered || 0, days: r.days || 0, invites: r.invites || 0,
      score: scoreOf(r.mastered, r.days, r.invites)
    }));
    if (type === 'score') rows.sort((a, b) => b.score - a.score || a.id - b.id);
    else rows.sort((a, b) => b.mastered - a.mastered || a.id - b.id);
    rows = rows.slice(0, 20);
  }

  return json({ type, list: rows, me: me ? { id: me.id, name: me.name } : null });
}
