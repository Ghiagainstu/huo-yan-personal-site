// 我的信息：掌握词数 / 今日星星 / 连续签到 / 总榜名次
// GET /api/me?token=...&date=YYYY-MM-DD
import { json, getUserByToken, cnDate } from './_lib.js';

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token') || '';
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
    user: { id: u.id, name: u.name, avatar: u.avatar || '' },
    mastered,
    todayStars: todayStars ? todayStars.stars : 0,
    streak,
    totalUsers,
    myRankTotal: better.n + 1
  });
}

// 连续签到天数：从今天往回数（今天未签则从昨天开始算）
async function calcStreak(db, userId, today) {
  const rows = await db.prepare('SELECT date FROM checkin WHERE user_id=? ORDER BY date DESC').bind(userId).all();
  const days = new Set(rows.results.map(r => r.date));
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  if (!days.has(today)) d.setDate(d.getDate() - 1);
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
