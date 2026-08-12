// 排行榜：总榜 / 本周 / 今日（含头像）
// GET /api/rank?type=total|week|day&token=...
import { json, getUserByToken } from './_lib.js';

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
    rows = await db.prepare(
      `SELECT u.name, u.avatar, COUNT(p.word) AS mastered
       FROM users u JOIN progress p ON p.user_id = u.id AND p.level >= 3
       GROUP BY u.id ORDER BY mastered DESC, u.id ASC LIMIT 20`
    ).all();
  }

  return json({ type, list: rows.results, me: me ? { id: me.id, name: me.name } : null });
}
