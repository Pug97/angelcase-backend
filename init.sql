CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT DEFAULT '',
  wallet_address TEXT DEFAULT '',
  balance REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE,
  telegram_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  sender_wallet TEXT DEFAULT '',
  receiver_wallet TEXT NOT NULL,
  comment TEXT DEFAULT '',
  tx_hash TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  price_ton REAL NOT NULL,
  image TEXT DEFAULT '',
  rtp_target REAL DEFAULT 0.70,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_drops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_key TEXT NOT NULL,
  item_key TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  rarity TEXT NOT NULL,
  ton_value REAL NOT NULL,
  weight REAL NOT NULL,
  image TEXT DEFAULT '',
  can_sell INTEGER DEFAULT 1,
  can_withdraw INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'gift',
  rarity TEXT NOT NULL,
  ton_value REAL NOT NULL DEFAULT 0,
  image TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'owned',
  can_sell INTEGER DEFAULT 1,
  can_withdraw INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
