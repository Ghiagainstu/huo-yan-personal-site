-- english-wonderland 登录 + 排行榜数据库 (Cloudflare D1)
-- 在 Cloudflare 控制台或 wrangler 中执行本文件建表

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,                -- 昵称（唯一）
  pin_hash TEXT NOT NULL,                   -- PIN 哈希（SHA-256，不存明文）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,                   -- 登录会话 token
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 学习进度：每个用户每个词一条，level 0-3（3=掌握）
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cat TEXT NOT NULL,
  word TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, cat, word)
);

-- 每日签到：date 用中国本地日期 YYYY-MM-DD（由前端传入，避免 D1 UTC 时区差一天）
CREATE TABLE IF NOT EXISTS checkin (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,         -- 当日新增掌握词数
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkin(date);
