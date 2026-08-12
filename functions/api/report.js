// 学习进度上报 + 每日签到加分
// POST /api/report  body: { token, progress: [{cat,word,level}], date? }
import { json, getUserByToken, cnDate } from './_lib.js';

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);

  const today = cnDate(body);
  const list = Array.isArray(body.progress) ? body.progress.slice(0, 2000) : [];
  let gained = 0;

  if (list.length) {
    const stmt = db.prepare(
      `INSERT INTO progress(user_id, cat, word, level, updated_at)
       VALUES(?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, cat, word)
       DO UPDATE SET level = excluded.level, updated_at = excluded.updated_at`
    );
    for (const p of list) {
      const cat = String(p.cat || '').slice(0, 40);
      const word = String(p.word || '').slice(0, 60);
      const level = Math.max(0, Math.min(3, Number(p.level) || 0));
      if (!cat || !word) continue;
      const before = await db.prepare('SELECT level FROM progress WHERE user_id=? AND cat=? AND word=?').bind(u.id, cat, word).first();
      await stmt.bind(u.id, cat, word, level).run();
      if (level >= 3 && (!before || before.level < 3)) gained++;
    }
  }

  // 更新今日签到星星（当日新增掌握词数，取累计）
  if (gained > 0) {
    await db.prepare(
      'INSERT INTO checkin(user_id, date, stars) VALUES(?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET stars = stars + excluded.stars'
    ).bind(u.id, today, gained).run();
  }

  return json({ ok: true, gained, mastered: await countMastered(db, u.id) });
}

async function countMastered(db, userId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(userId).first();
  return r ? r.n : 0;
}
