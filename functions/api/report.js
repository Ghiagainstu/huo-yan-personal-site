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
    // ★ 2026-08-23 恩恩事故修复：upsert 由「最后写入胜出」改为 max 保护（只升不降）。
    //   设备 localStorage 为设备级、跨账号共享且可能残缺，低值全量上行曾把云端高掌握覆盖降级；
    //   产品语义为「学会的词不会忘」，云端取 max 才是安全收敛点。
    const stmt = db.prepare(
      `INSERT INTO progress(user_id, cat, word, level, updated_at)
       VALUES(?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, cat, word)
       DO UPDATE SET
         level = MAX(progress.level, excluded.level),
         updated_at = CASE WHEN excluded.level > progress.level THEN excluded.updated_at ELSE progress.updated_at END`
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

  // 词表外残留行清理（2026-08-23 对账机制）：前端拉取时发现不在当前词表的行（旧类目/已删词），
  // 上报回服务端删除；只删本人行、单次上限 50 条
  const stale = Array.isArray(body.stale) ? body.stale.slice(0, 50) : [];
  for (const s of stale) {
    if (!s || typeof s.cat !== 'string' || typeof s.word !== 'string') continue;
    await db.prepare('DELETE FROM progress WHERE user_id=? AND cat=? AND word=?')
      .bind(u.id, s.cat.slice(0, 40), s.word.slice(0, 60)).run();
  }

  // 更新今日签到星星（当日新增掌握词数，取累计）
  if (gained > 0) {
    await db.prepare(
      'INSERT INTO checkin(user_id, date, stars) VALUES(?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET stars = stars + excluded.stars'
    ).bind(u.id, today, gained).run();
  }

  // 游戏星上报（本轮答对题数，1 星 = 1 积分；每天最多 +200 防刷）
  let gameGained = 0;
  const gs = Math.max(0, Math.min(200, Number(body.game_stars) || 0));
  if (gs > 0) {
    const win = 'g_' + today;
    const cnt = await db.prepare('SELECT count FROM rate_limit WHERE kind=? AND key=? AND window=?')
      .bind('game_stars', String(u.id), win).first();
    const used = cnt ? cnt.count : 0;
    const add = Math.min(gs, 200 - used);
    if (add > 0) {
      await db.prepare('UPDATE users SET game_stars = game_stars + ? WHERE id=?').bind(add, u.id).run();
      if (cnt) {
        await db.prepare('UPDATE rate_limit SET count = count + ? WHERE kind=? AND key=? AND window=?')
          .bind(add, 'game_stars', String(u.id), win).run();
      } else {
        await db.prepare('INSERT INTO rate_limit(kind,key,window,count) VALUES(?,?,?,?)')
          .bind('game_stars', String(u.id), win, add).run();
      }
      gameGained = add;
    }
  }

  return json({ ok: true, gained, game_gained: gameGained, mastered: await countMastered(db, u.id) });
}

async function countMastered(db, userId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(userId).first();
  return r ? r.n : 0;
}
