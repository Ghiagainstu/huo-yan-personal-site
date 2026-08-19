// 排行榜：总榜 / 积分榜 / 本周 / 今日（含头像 + 宠物徽章）
// GET /api/rank?type=total|score|week|day&token=...
import { json, getUserByToken } from './_lib.js';

// 积分 = 已掌握词数×2 + 累计签到天数×5 + 成功邀请×10 + 累计游戏星×1 + 盲盒入账×1
function scoreOf(mastered, days, invites, gameStars, boxPoints) {
  return (mastered || 0) * 2 + (days || 0) * 5 + (invites || 0) * 10 + (gameStars || 0) * 1 + (boxPoints || 0) * 1;
}

// 幂等建表：box_owned 可能尚未被 box.js 创建（用户未打开过盲盒），先确保存在，避免子查询报错
// 用 prepare().run() 而非 db.exec()（Pages Functions 的 D1 对 exec 支持不稳）
async function ensureBoxTable(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS box_owned(
      user_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'common',
      PRIMARY KEY (user_id, slug)
    )`).run();
  } catch (e) {
    // 建表失败不致命：pets 单独查询时也会 try/catch
  }
}

// 单独查询每行用户的宠物 slug（表不存在/查询失败时返回 []，绝不影响榜单主体）
async function petsOf(db, userId) {
  try {
    const r = await db.prepare('SELECT group_concat(slug, ",") AS s FROM box_owned WHERE user_id=?').bind(userId).first();
    return r && r.s ? String(r.s).split(',').filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token') || '';
  const type = url.searchParams.get('type') || 'total';
  const me = await getUserByToken(db, token);
  let rows = [];

  if (type === 'week') {
    rows = (await db.prepare(
      `SELECT u.id, u.name, u.avatar, u.items, SUM(c.stars) AS stars, COUNT(DISTINCT c.date) AS days
       FROM checkin c JOIN users u ON u.id = c.user_id
       WHERE c.date >= date('now','+8 hours','-6 days')
       GROUP BY u.id ORDER BY stars DESC, days DESC, u.id ASC LIMIT 20`
    ).all()).results;
  } else if (type === 'day') {
    rows = (await db.prepare(
      `SELECT u.id, u.name, u.avatar, u.items, c.stars AS stars
       FROM checkin c JOIN users u ON u.id = c.user_id
       WHERE c.date = date('now','+8 hours')
       ORDER BY stars DESC, u.id ASC LIMIT 20`
    ).all()).results;
  } else {
    // total / score：带积分字段（全量用户排序后取前 20，勿 LIMIT 截断）
    rows = await db.prepare(
      `SELECT u.id, u.name, u.avatar, u.items, u.invite_used AS invites, u.game_stars AS game_stars,
              (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id AND p.level >= 3) AS mastered,
              (SELECT COUNT(DISTINCT date) FROM checkin c WHERE c.user_id = u.id) AS days,
              COALESCE((SELECT count FROM rate_limit r WHERE r.kind='box_points' AND r.key=CAST(u.id AS TEXT) AND r.window='all'),0) AS box_points
       FROM users u`
    ).all();
    rows = rows.results.map(r => ({
      id: r.id, name: r.name, avatar: r.avatar, items: r.items || '[]',
      mastered: r.mastered || 0, days: r.days || 0, invites: r.invites || 0, game_stars: r.game_stars || 0,
      score: scoreOf(r.mastered, r.days, r.invites, r.game_stars, r.box_points)
    }));
    if (type === 'score') rows.sort((a, b) => b.score - a.score || a.id - b.id);
    else rows.sort((a, b) => b.mastered - a.mastered || a.id - b.id);
    rows = rows.slice(0, 20);
  }

  // 宠物徽章数据：逐行单独查询（失败不影响榜单主体）
  rows = await Promise.all(rows.map(async r => ({ ...r, pets: await petsOf(db, r.id) })));

  return json({ type, list: rows, me: me ? { id: me.id, name: me.name } : null });
}
