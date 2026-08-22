// 拉取云端逐词学习进度（多设备同步：登录后把云端进度取 max 合并回本地）
// GET /api/progress?token=xxx   （也兼容 Authorization: Bearer xxx）
import { json, getUserByToken } from './_lib.js';

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const q = url.searchParams.get('token') || '';
  const hdr = (ctx.request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const u = await getUserByToken(db, q || hdr);
  if (!u) return json({ error: '未登录' }, 401);
  const r = await db.prepare(
    'SELECT cat, word, level, updated_at FROM progress WHERE user_id=? ORDER BY updated_at DESC LIMIT 3000'
  ).bind(u.id).all();
  return json({ ok: true, list: r.results || [] });
}
