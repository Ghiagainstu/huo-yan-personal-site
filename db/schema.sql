-- english-wonderland 登录 + 排行榜数据库 (Cloudflare D1)
-- 在 Cloudflare 控制台或 wrangler 中执行本文件建表

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,                -- 昵称（唯一）
  pin_hash TEXT NOT NULL,                   -- PIN 哈希（SHA-256，不存明文）
  avatar TEXT NOT NULL DEFAULT '',          -- 头像：'e:🐱'(emoji预设) 或 dataURL(上传图 96px)
  invite_code TEXT UNIQUE,                  -- 个人邀请码（6位数字，注册时生成）
  invite_used INTEGER NOT NULL DEFAULT 0,   -- 已用邀请名额（初始3+累计登录天数，上限20）
  points_spent INTEGER NOT NULL DEFAULT 0,  -- 积分商城已消费积分
  items TEXT NOT NULL DEFAULT '[]',         -- 已购装扮 id 列表（JSON 数组）
  game_stars INTEGER NOT NULL DEFAULT 0,    -- 累计游戏星（闯关答对题数，1星=1积分）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 已有库迁移（已建表时执行）：
-- ALTER TABLE users ADD COLUMN invite_code TEXT;
-- ALTER TABLE users ADD COLUMN invite_used INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN points_spent INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN items TEXT NOT NULL DEFAULT '[]';
-- ALTER TABLE users ADD COLUMN game_stars INTEGER NOT NULL DEFAULT 0;

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

-- L2 防护：IP 注册限频 + PIN 错误锁定计数（window 为小时块/15分钟块）
CREATE TABLE IF NOT EXISTS rate_limit (
  kind TEXT NOT NULL,                       -- 'reg_ip' 注册IP限频 | 'pin_fail' PIN错误锁定
  key TEXT NOT NULL,                        -- IP 或 昵称(小写)
  window TEXT NOT NULL,                     -- 时间窗口标识
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key, window)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkin(date);
