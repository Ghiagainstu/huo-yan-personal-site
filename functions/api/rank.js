// 排行榜 + 我的信息（含连续签到天数）
// GET /api/rank?type=total|week|day&token=...
// GET /api/me?token=...
import { json, getUserByToken, cnDate } from './_lib.js';

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const path = url.pathname;
  const token = url.searchParams.get('token') || '';

  if (path.endsWith('/me')) return me(db, token, url);

  const type = url.searchParams.get('type') || 'total';
  const me = await getUserByToken(db, token);
  let rows = [];

  if (type === 'week') {
    rows = await db.prepare(
      `SELECT u.name, SUM(c.stars) AS stars, COUNT(DISTINCT c.date) AS days
       FROM checkin c JOIN users u ON u.id = c.user_id
       WHERE c.date >= date('now','-6 days')
       GROUP BY u.id ORDER BY stars DESC, days DESC, u.id ASC LIMIT 20`
    ).all();
  } else if (type === 'day') {
    rows = await db.prepare(
      `SELECT u.name, c.stars AS stars
       FROM checkin c JOIN users u ON u.id = c.user_id
       WHERE c.date = date('now')
       ORDER BY stars DESC, u.id ASC LIMIT 20`
    ).all();
  } else {
    rows = await db.prepare(
      `SELECT u.name, COUNT(p.word) AS mastered
       FROM users u JOIN progress p ON p.user_id = u.id AND p.level >= 3
       GROUP BY u.id ORDER BY mastered DESC, u.id ASC LIMIT 20`
    ).all();
  }

  return json({ type, list: rows.results, me: me ? { id: me.id, name: me.name } : null });
}

async function me(db, token, url) {
  const u = await getUserByToken(db, token);
  if (!u) return json({ error: '未登录' }, 401);

  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(u.id).first()).n;
  const today = cnDate({ date: url.searchParams.get('date') });
  const todayStars = (await db.prepare('SELECT stars FROM checkin WHERE user_id=? AND date=?').bind(u.id, today).first());
  const streak = await calcStreak(db, u.id, today);
  const totalUsers = (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n;

  // 我的总榜名次
  const better = await db.prepare(
    'SELECT COUNT(*) AS n FROM (SELECT user_id FROM progress WHERE level>=3 GROUP BY user_id HAVING COUNT(*) > ?)'
  ).bind(mastered).first();

  return json({
    user: { id: u.id, name: u.name },
    mastered,
    todayStars: todayStars ? todayStars.stars : 0,
    streak,
    totalUsers,
    myRankTotal: better.n + 1
  });
}

// 连续签到天数：从今天往回数（今天未签则从昨天开始算，今天补签后计入）
async function calcStreak(db, userId, today) {
  const rows = await db.prepare('SELECT date FROM checkin WHERE user_id=? ORDER BY date DESC').bind(userId).all();
  const days = new Set(rows.results.map(r => r.date));
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  if (!days.has(today)) d.setDate(d.getDate() - 1); // 今天还没签，从昨天起算
  while (days.has(fmt(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
