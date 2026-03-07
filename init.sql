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

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
