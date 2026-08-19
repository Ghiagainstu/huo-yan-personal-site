// 盲盒系统：学习成果换抽奖机会（不花积分），服务端随机，每日 1 次，无保底，重复折算积分
// GET  /api/box?token=...                    → { tickets, drewToday, owned:[slugs], box_points }
// POST /api/box/draw  {token}                → { ok, result:{kind:'pet'|'points'|'dupe', slug?, points?, rarity?, name?}, tickets, box_points }
import { json, getUserByToken, cnDate } from './_lib.js';

// 奖池：9 款火火装扮（v5 终稿）+ 2 积分档；weight 为概率（总和 100）
const POOL = [
  { slug: 'pet-nailong', name: '奶龙风',      rarity: 'common',  weight: 10 },
  { slug: 'pet-pixel',   name: '我的世界像素风', rarity: 'common',  weight: 10 },
  { slug: 'pet-mengke',  name: '奇妙萌可风',    rarity: 'common',  weight: 10 },
  { slug: 'pet-orca',    name: '虎鲸风',      rarity: 'common',  weight: 10 },
  { slug: 'pet-mini',    name: '迷你特工队风',  rarity: 'common',  weight: 10 },
  { slug: 'pet-piggy',   name: '小猪佩奇风',    rarity: 'rare',    weight: 4.5 },
  { slug: 'pet-xuan',    name: '炫卡斗士风',    rarity: 'rare',    weight: 4.5 },
  { slug: 'pet-lego',    name: '乐高风',      rarity: 'vrare',   weight: 2 },
  { slug: 'pet-gold',    name: '金色传说风',    rarity: 'legend',  weight: 1 },
  { slug: 'box-p10',     name: '积分 +10',     kind: 'points',   points: 10,  weight: 28 },
  { slug: 'box-p20',     name: '积分 +20',     kind: 'points',   points: 20,  weight: 10 },
];
// 重复装扮折算积分（普通/稀有/很稀有/传说）
const DUP_POINTS = { common: 10, rare: 20, vrare: 40, legend: 80 };
// 抽奖机会换算：每掌握 10 词 = 1 次；游戏累计答对 20 题 ≈ 1 次（连对 10 题并入答对计数，服务端以 game_stars 计）
function ticketsOf(mastered, gameStars) {
  return Math.max(0, Math.floor((mastered || 0) / 10) + Math.floor((gameStars || 0) / 20));
}

async function ensureTables(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS box_owned(
    user_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    PRIMARY KEY (user_id, slug)
  );`);
  await db.exec(`CREATE TABLE IF NOT EXISTS box_draws(
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    result TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  );`);
}

// rate_limit 辅助：box_points 累计盲盒入账积分（window='all'）；box_used 累计已用机会（window='all'）
async function counterGet(db, kind, key) {
  const r = await db.prepare('SELECT count FROM rate_limit WHERE kind=? AND key=? AND window=?').bind(kind, String(key), 'all').first();
  return r ? r.count : 0;
}
async function counterAdd(db, kind, key, n) {
  const c = await counterGet(db, kind, key);
  await db.prepare('INSERT INTO rate_limit(kind,key,window,count) VALUES(?,?,?,?) ON CONFLICT(kind,key,window) DO UPDATE SET count=count+?')
    .bind(kind, String(key), 'all', c + n, n).run();
}

export async function onRequestGet(ctx) {
  const db = ctx.env.DB;
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token') || '';
  const u = await getUserByToken(db, token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTables(db);
  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(u.id).first()).n;
  const usr = await db.prepare('SELECT game_stars FROM users WHERE id=?').bind(u.id).first();
  const owned = (await db.prepare('SELECT slug FROM box_owned WHERE user_id=?').bind(u.id).all()).results.map(r => r.slug);
  const used = await counterGet(db, 'box_used', u.id);
  const boxPoints = await counterGet(db, 'box_points', u.id);
  const drewToday = (await db.prepare('SELECT 1 AS x FROM box_draws WHERE user_id=? AND date=?').bind(u.id, cnDate({})).first()) ? true : false;
  return json({
    tickets: Math.max(0, ticketsOf(mastered, usr ? usr.game_stars : 0) - used),
    drewToday,
    owned,
    box_points: boxPoints,
    pool: POOL.map(p => ({ slug: p.slug, name: p.name, rarity: p.rarity || '', kind: p.kind || 'pet', weight: p.weight }))
  });
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));
  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTables(db);

  const today = cnDate(body);
  const drew = await db.prepare('SELECT 1 AS x FROM box_draws WHERE user_id=? AND date=?').bind(u.id, today).first();
  if (drew) return json({ error: '今天已经抽过啦，明天再来' }, 400);

  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(u.id).first()).n;
  const usr = await db.prepare('SELECT game_stars FROM users WHERE id=?').bind(u.id).first();
  const used = await counterGet(db, 'box_used', u.id);
  const tickets = ticketsOf(mastered, usr ? usr.game_stars : 0) - used;
  if (tickets <= 0) return json({ error: '还没有抽奖机会，先学 10 个新词或闯关 20 题吧' }, 400);

  // 服务端加权随机
  const totalW = POOL.reduce((s, p) => s + p.weight, 0);
  let rnd = Math.random() * totalW, pick = POOL[0];
  for (const p of POOL) { rnd -= p.weight; if (rnd <= 0) { pick = p; break; } }

  const ownedRows = (await db.prepare('SELECT slug FROM box_owned WHERE user_id=?').bind(u.id).all()).results;
  const ownedSet = new Set(ownedRows.map(r => r.slug));
  let result;
  if (pick.kind === 'points') {
    await counterAdd(db, 'box_points', u.id, pick.points);
    result = { kind: 'points', points: pick.points, name: pick.name };
  } else if (ownedSet.has(pick.slug)) {
    const pts = DUP_POINTS[pick.rarity] || 10;
    await counterAdd(db, 'box_points', u.id, pts);
    result = { kind: 'dupe', slug: pick.slug, rarity: pick.rarity, points: pts, name: pick.name };
  } else {
    await db.prepare('INSERT INTO box_owned(user_id, slug, rarity) VALUES(?,?,?)').bind(u.id, pick.slug, pick.rarity).run();
    result = { kind: 'pet', slug: pick.slug, rarity: pick.rarity, name: pick.name };
  }
  await db.prepare('INSERT INTO box_draws(user_id, date, result) VALUES(?,?,?)').bind(u.id, today, JSON.stringify(result)).run();
  await counterAdd(db, 'box_used', u.id, 1);
  const boxPoints = await counterGet(db, 'box_points', u.id);
  return json({ ok: true, result, tickets: tickets - 1, box_points: boxPoints });
}
