// 盲盒系统：学习成果换抽奖机会（不花积分），服务端随机，每日 1 次，无保底，重复折算积分
// GET  /api/box?token=...                    → { tickets, drewToday, owned:[slugs], box_points }
// POST /api/box/draw  {token}                → { ok, result:{kind:'pet'|'points'|'dupe', slug?, points?, rarity?, name?}, tickets, box_points }
// POST /api/box/seed  {admin, name}          → 管理接口：给指定昵称 +N 次盲盒资格（N 默认 10，admin=852121）
// POST /api/box/reset_today {admin, name}    → 管理接口：回滚指定用户今日所有抽奖（删当日 draw/宠物/积分/已用次数，admin=852121）
import { json, getUserByToken, cnDate } from './_lib.js';

// 奖池：14 款火火装扮（v7 扩充；v7.2 +史诗·晶砖史诗风 +隐藏款·？？？）+ 2 积分档
// v7.2 概率定案（2026-08-25 火哥确认）：+15=25%、+25=15%、传说=1%、很稀有各=2%、稀有各=4%、
//   史诗(晶砖史诗风)=0.5%、隐藏款=0.2%，普通吃剩余 42.3%/6≈7.05%。
// 权重单位=0.01%（×100 取整），总和恰 10000：
//   普通 705 / 稀有 400 / 很稀有 200 / 传说 100 / 史诗 50 / 隐藏 20 / +15 为 2500 / +25 为 1500。
const POOL = [
  { slug: 'pet-nailong', name: '奶龙风',      rarity: 'common',  weight: 705 },
  { slug: 'pet-pixel',   name: '我的世界像素风', rarity: 'common',  weight: 705 },
  { slug: 'pet-mengke',  name: '奇妙萌可风',    rarity: 'common',  weight: 705 },
  { slug: 'pet-orca',    name: '虎鲸风',      rarity: 'common',  weight: 705 },
  { slug: 'pet-mini',    name: '迷你特工队风',  rarity: 'common',  weight: 705 },
  { slug: 'pet-eggy',    name: '蛋仔派对风',    rarity: 'common',  weight: 705 },
  { slug: 'pet-piggy',   name: '库洛米风',     rarity: 'rare',    weight: 400 },
  { slug: 'pet-xuan',    name: '炫卡斗士风',    rarity: 'rare',    weight: 400 },
  { slug: 'pet-ultra',   name: '奥特曼风',     rarity: 'rare',    weight: 400 },
  { slug: 'pet-lego',    name: '乐高积木风',    rarity: 'vrare',   weight: 200 },
  { slug: 'pet-galaxy',  name: '星空梦幻风',    rarity: 'vrare',   weight: 200 },
  { slug: 'pet-gold',    name: '金色传说风',    rarity: 'legend',  weight: 100 },
  { slug: 'pet-diamond', name: '晶砖史诗风',    rarity: 'epic',    weight: 50 },
  { slug: 'pet-secret',  name: '？？？',       rarity: 'hidden',  weight: 20 },
  { slug: 'box-p15',     name: '积分 +15',     kind: 'points',   points: 15,  weight: 2500 },
  { slug: 'box-p25',     name: '积分 +25',     kind: 'points',   points: 25,  weight: 1500 },
];
// 重复装扮折算积分（普通/稀有/很稀有/传说/史诗/隐藏）
const DUP_POINTS = { common: 10, rare: 20, vrare: 40, legend: 80, epic: 120, hidden: 200 };
// 抽奖机会换算：每掌握 10 词 = 1 次；游戏累计答对 20 题 ≈ 1 次（连对 10 题并入答对计数，服务端以 game_stars 计）
function ticketsOf(mastered, gameStars) {
  return Math.max(0, Math.floor((mastered || 0) / 10) + Math.floor((gameStars || 0) / 20));
}

async function ensureTables(db) {
  // 用 prepare().run() 而非 db.exec()（Pages Functions 的 D1 对 exec 支持不稳，曾致 1101）
  await db.prepare(`CREATE TABLE IF NOT EXISTS box_owned(
    user_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    PRIMARY KEY (user_id, slug)
  )`).run().catch(() => {});
  // box_draws：旧版主键 (user_id,date) 只允许每日 1 次；v2 迁移为自增 id，支持每日多次 + 抽奖记录。
  // 检测旧结构（无 id 列）→ 改名重建并保留历史数据；表不存在则直接建新结构。
  try {
    const info = await db.prepare('PRAGMA table_info(box_draws)').all();
    const cols = (info.results || []).map(r => r.name);
    if (cols.length && !cols.includes('id')) {
      await db.prepare('ALTER TABLE box_draws RENAME TO box_draws_old').run();
      await db.prepare(`CREATE TABLE box_draws(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        result TEXT NOT NULL
      )`).run();
      await db.prepare('INSERT INTO box_draws(user_id, date, result) SELECT user_id, date, result FROM box_draws_old').run();
      await db.prepare('DROP TABLE box_draws_old').run();
    }
  } catch (e) {}
  await db.prepare(`CREATE TABLE IF NOT EXISTS box_draws(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    result TEXT NOT NULL
  )`).run().catch(() => {});
}

// 每日抽取上限（用户 2026-08-20 确认：1 → 2 次）
const DAILY_DRAW_LIMIT = 2;

// rate_limit 辅助：box_points 累计盲盒入账积分（window='all'）；box_used 累计已用机会（window='all'）；box_bonus 管理员赠送机会（window='all'）
async function counterGet(db, kind, key) {
  const r = await db.prepare('SELECT count FROM rate_limit WHERE kind=? AND key=? AND window=?').bind(kind, String(key), 'all').first();
  return r ? r.count : 0;
}
async function counterAdd(db, kind, key, n) {
  const c = await counterGet(db, kind, key);
  await db.prepare('INSERT INTO rate_limit(kind,key,window,count) VALUES(?,?,?,?) ON CONFLICT(kind,key,window) DO UPDATE SET count=count+?')
    .bind(kind, String(key), 'all', c + n, n).run();
}
// 可用机会 = 学习成果折算 + 管理员赠送(永久) + 邀请奖励(24小时有效) - 已用
async function ticketsAvail(db, mastered, gameStars, userId) {
  const used = await counterGet(db, 'box_used', userId);
  const bonus = await counterGet(db, 'box_bonus', userId);
  const inv = await inviteBonusActive(db, userId);
  return Math.max(0, ticketsOf(mastered, gameStars) + bonus + inv - used);
}
// 邀请奖励的盲盒机会：24 小时有效，过期自动归位（rate_limit window 存过期时间戳，只累计未过期的）
async function inviteBonusActive(db, userId) {
  try {
    const r = await db.prepare("SELECT COALESCE(SUM(count),0) AS n FROM rate_limit WHERE kind='box_bonus_invite' AND key=? AND window>=?")
      .bind(String(userId), new Date().toISOString()).first();
    return r ? r.n : 0;
  } catch (e) { return 0; }
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
  const bonus = await counterGet(db, 'box_bonus', u.id);
  const invBonus = await inviteBonusActive(db, u.id);
  const boxPoints = await counterGet(db, 'box_points', u.id);
  const tickets = ticketsOf(mastered, usr ? usr.game_stars : 0) + bonus + invBonus - used;
  const today = cnDate({});
  const todayCount = (await db.prepare('SELECT COUNT(*) AS n FROM box_draws WHERE user_id=? AND date=?').bind(u.id, today).first()).n || 0;
  const draws = (await db.prepare('SELECT date, result FROM box_draws WHERE user_id=? ORDER BY id DESC LIMIT 10').bind(u.id).all()).results.map(r => {
    const o = { date: r.date, kind: 'pet', t: 0 };
    try {
      const x = JSON.parse(r.result);
      o.kind = x.kind || 'pet'; o.slug = x.slug || ''; o.rarity = x.rarity || ''; o.name = x.name || ''; o.points = x.points || 0; o.t = x.t || 0;
    } catch (e) {}
    return o;
  });
  return json({
    tickets: Math.max(0, tickets),
    todayCount,
    drewToday: todayCount >= DAILY_DRAW_LIMIT,
    owned,
    box_points: boxPoints,
    draws,
    pool: POOL.map(p => ({ slug: p.slug, name: p.name, rarity: p.rarity || '', kind: p.kind || 'pet', weight: p.weight }))
  });
}

export async function onRequestPost(ctx) {
  const db = ctx.env.DB;
  const body = await ctx.request.json().catch(() => ({}));

  // 管理接口：给指定昵称赠送盲盒资格（admin=852121 内测码，仅后台/测试用）
  if (body.action === 'seed') {
    if (body.admin !== '852121') return json({ error: '无权限' }, 403);
    const name = String(body.name || '').trim();
    const n = Math.max(1, Math.min(100, Number(body.n) || 10));
    if (!name) return json({ error: '缺少昵称' }, 400);
    const tgt = await db.prepare('SELECT id, name FROM users WHERE name=?').bind(name).first();
    if (!tgt) return json({ error: '用户不存在' }, 404);
    await ensureTables(db);
    await counterAdd(db, 'box_bonus', tgt.id, n);
    const bonus = await counterGet(db, 'box_bonus', tgt.id);
    return json({ ok: true, user: tgt.name, added: n, total_bonus: bonus });
  }

  // 管理接口：回滚指定用户今日抽奖（删当日 draw 记录 + 当日抽中的宠物 + 积分入账 + 已用次数，admin=852121）
  if (body.action === 'reset_today') {
    if (body.admin !== '852121') return json({ error: '无权限' }, 403);
    const name = String(body.name || '').trim();
    if (!name) return json({ error: '缺少昵称' }, 400);
    const tgt = await db.prepare('SELECT id, name FROM users WHERE name=?').bind(name).first();
    if (!tgt) return json({ error: '用户不存在' }, 404);
    await ensureTables(db);
    const today = cnDate({});
    const rows = (await db.prepare('SELECT result FROM box_draws WHERE user_id=? AND date=?').bind(tgt.id, today).all()).results;
    for (const r of rows) {
      try {
        const x = JSON.parse(r.result);
        if (x.slug) await db.prepare('DELETE FROM box_owned WHERE user_id=? AND slug=?').bind(tgt.id, x.slug).run();
        if (x.points) await counterAdd(db, 'box_points', tgt.id, -(x.points || 0));
      } catch (e) {}
    }
    await db.prepare('DELETE FROM box_draws WHERE user_id=? AND date=?').bind(tgt.id, today).run();
    if (rows.length) await counterAdd(db, 'box_used', tgt.id, -rows.length);
    const used = await counterGet(db, 'box_used', tgt.id);
    const boxPoints = await counterGet(db, 'box_points', tgt.id);
    return json({ ok: true, user: tgt.name, rollback: rows.length, box_used: Math.max(0, used), box_points: boxPoints });
  }

  const u = await getUserByToken(db, body.token);
  if (!u) return json({ error: '未登录' }, 401);
  await ensureTables(db);

  const today = cnDate(body);
  const todayCount = (await db.prepare('SELECT COUNT(*) AS n FROM box_draws WHERE user_id=? AND date=?').bind(u.id, today).first()).n || 0;
  if (todayCount >= DAILY_DRAW_LIMIT) return json({ error: '今天已经抽过 ' + DAILY_DRAW_LIMIT + ' 次啦，明天再来' }, 400);

  const mastered = (await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id=? AND level>=3').bind(u.id).first()).n;
  const usr = await db.prepare('SELECT game_stars FROM users WHERE id=?').bind(u.id).first();
  const used = await counterGet(db, 'box_used', u.id);
  const bonus = await counterGet(db, 'box_bonus', u.id);
  const invBonus = await inviteBonusActive(db, u.id);
  const tickets = ticketsOf(mastered, usr ? usr.game_stars : 0) + bonus + invBonus - used;
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
  await db.prepare('INSERT INTO box_draws(user_id, date, result) VALUES(?,?,?)').bind(u.id, today, JSON.stringify({ ...result, t: Date.now() })).run();
  await counterAdd(db, 'box_used', u.id, 1);
  const boxPoints = await counterGet(db, 'box_points', u.id);
  /* P2（2026-08-22）：draw 响应直接返回与 GET 一致的全量状态，
     前端抽完后免去 loadBox/loadMe 两次海外往返（乐观 UI 后唯一剩余延迟点） */
  const draws = (await db.prepare('SELECT date, result FROM box_draws WHERE user_id=? ORDER BY id DESC LIMIT 10').bind(u.id).all()).results.map(r => {
    try { return { date: r.date, ...JSON.parse(r.result) }; } catch (e) { return { date: r.date }; }
  });
  const newToday = todayCount + 1;
  return json({
    ok: true, result,
    tickets: Math.max(0, tickets - 1),
    todayCount: newToday,
    drewToday: newToday >= DAILY_DRAW_LIMIT,
    owned: ownedRows.map(r => r.slug),
    box_points: boxPoints,
    draws
  });
}
