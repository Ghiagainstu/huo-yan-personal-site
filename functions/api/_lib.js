// 共享工具：JSON 响应 / PIN 哈希 / 会话校验（Cloudflare Pages Functions）
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const APP_SALT = 'huo-yan-ew-pin-v1';

export function pinHash(name, pin) {
  return sha256(APP_SALT + '|' + name.trim().toLowerCase() + '|' + pin);
}

// 从 token 取当前用户（返回 {id,name} 或 null）
export async function getUserByToken(db, token) {
  if (!token) return null;
  return db.prepare(
    'SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).bind(token).first().catch(() => null);
}

// 中国本地日期 YYYY-MM-DD（前端传入优先，兜底用 UTC）
export function cnDate(body, now = new Date()) {
  if (body && typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) return body.date;
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
