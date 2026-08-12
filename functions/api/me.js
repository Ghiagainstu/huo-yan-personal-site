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

  // 邀请名额：min(3+累计登录天数, 20) - 已用
  const days = (await db.prepare('SELECT COUNT(DISTINCT date) AS n FROM checkin WHERE user_id=?').bind(u.id).first()).n;
  const inv = await db.prepare('SELECT invite_code, invite_used FROM users WHERE id=?').bind(u.id).first();
  const inviteMax = 20;
  const inviteQuota = Math.max(0, Math.min(3 + (days || 0), inviteMax) - (inv ? (inv.invite_used || 0) : 0));

  // 积分：掌握词×2 + 累计签到天×5 + 成功邀请×10
  const invitesUsed = inv ? (inv.invite_used || 0) : 0;
  const scoreWords = mastered * 2;
  const scoreDays = (days || 0) * 5;
  const scoreInvites = invitesUsed * 10;
  const score = scoreWords + scoreDays + scoreInvites;

  // 我的总榜名次
  const better = await db.prepare(
    'SELECT COUNT(*) AS n FROM (SELECT user_id FROM progress WHERE level>=3 GROUP BY user_id HAVING COUNT(*) > ?)'
  ).bind(mastered).first();
  // 我的积分榜名次
  const betterScore = await db.prepare(
    `SELECT COUNT(*) AS n FROM (SELECT u.id,
       (SELECT COUNT(*) FROM progress p WHERE p.user_id=u.id AND p.level>=3)*2
       + (SELECT COUNT(DISTINCT date) FROM checkin c WHERE c.user_id=u.id)*5
       + u.invite_used*10 AS sc FROM users u) WHERE sc > ?`
  ).bind(score).first();

  return json({
    user: { id: u.id, name: u.name, avatar: u.avatar || '' },
    mastered,
    todayStars: todayStars ? todayStars.stars : 0,
    streak,
    totalUsers,
    myRankTotal: better.n + 1,
    myRankScore: betterScore.n + 1,
    score,
    score_detail: { words: scoreWords, days: scoreDays, invites: scoreInvites },
    invite_code: inv ? inv.invite_code : '',
    invite_quota: inviteQuota,
    invite_max: inviteMax
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
