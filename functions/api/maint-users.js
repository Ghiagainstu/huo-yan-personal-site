// ⚠️ 临时维护接口（2026-08-23）：枚举 / 删除用户。受 admin 码保护，用完即从仓库删除并重新部署。
// GET  /api/maint-users?admin=852121&action=list   → 返回全部用户（id,name,invite_used,game_stars）
// POST /api/maint-users {admin:'852121', action:'delete', name:'xxx'} → 级联删除该用户全部数据
import { json } from './_lib.js';

const ADMIN_PIN = '852121';

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  if (url.searchParams.get('admin') !== ADMIN_PIN) return json({ error: '无权限' }, 403);
  if (url.searchParams.get('action') !== 'list') return json({ error: 'action=list' }, 400);
  const rows = (await db.prepare(
    'SELECT id, name, invite_used, game_stars, invite_code FROM users ORDER BY id ASC'
  ).all()).results;
  return json({ count: rows.length, users: rows });
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  if (body.admin !== ADMIN_PIN) return json({ error: '无权限' }, 403);
  if (body.action !== 'delete') return json({ error: 'action=delete' }, 400);
  const name = String(body.name || '').trim();
  if (!name) return json({ error: '缺少 name' }, 400);
  const u = await db.prepare('SELECT id, name FROM users WHERE name=?').bind(name).first();
  if (!u) return json({ error: '用户不存在' }, 404);
  const id = u.id;
  // 级联清理（与 auth/box/progress 表结构一致）
  await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
  await db.prepare('DELETE FROM progress WHERE user_id=?').bind(id).run();
  await db.prepare('DELETE FROM checkin WHERE user_id=?').bind(id).run();
  await db.prepare('DELETE FROM box_owned WHERE user_id=?').bind(id).run();
  await db.prepare('DELETE FROM box_draws WHERE user_id=?').bind(id).run();
  // rate_limit：box/invite 类 key 为用户 id（字符串）；pin_fail key 为 name 小写
  await db.prepare("DELETE FROM rate_limit WHERE key=?").bind(String(id)).run();
  await db.prepare("DELETE FROM rate_limit WHERE key=?").bind(name.toLowerCase()).run();
  await db.prepare('DELETE FROM users WHERE id=?').bind(id).run();
  return json({ ok: true, deleted: name, id });
}
