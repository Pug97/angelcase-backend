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
  item_type TEXT NOT NULL, -- gift | ton_balance
  rarity TEXT NOT NULL,    -- common | rare | epic | legendary
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
  status TEXT NOT NULL DEFAULT 'owned', -- owned | sold | withdraw_requested | withdrawn
  can_sell INTEGER DEFAULT 1,
  can_withdraw INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO cases (case_key, title, subtitle, price_ton, image, rtp_target, sort_order)
VALUES
('angel_dawn', 'Angel Dawn', 'Мягкий старт', 1.0, '👼', 0.70, 1),
('cloud_gate', 'Cloud Gate', 'Небесная арка', 2.0, '☁️', 0.70, 2),
('halo_forge', 'Halo Forge', 'Кузница ореолов', 5.0, '✨', 0.70, 3),
('divine_vault', 'Divine Vault', 'Божественный сейф', 10.0, '👑', 0.70, 4);

INSERT OR IGNORE INTO case_drops
(case_key, item_key, item_name, item_type, rarity, ton_value, weight, image, can_sell, can_withdraw, is_active)
VALUES
-- angel_dawn RTP ~ 0.70
('angel_dawn', 'ad_feather', 'Angel Feather', 'gift', 'common', 0.35, 25, '🪶', 1, 1, 1),
('angel_dawn', 'ad_halo_shard', 'Halo Shard', 'gift', 'common', 0.45, 20, '💠', 1, 1, 1),
('angel_dawn', 'ad_ton_060', '0.60 TON', 'ton_balance', 'common', 0.60, 18, '💸', 0, 0, 1),
('angel_dawn', 'ad_sky_box', 'Sky Box', 'gift', 'rare', 0.75, 15, '🎁', 1, 1, 1),
('angel_dawn', 'ad_ton_100', '1.00 TON', 'ton_balance', 'rare', 1.00, 10, '💰', 0, 0, 1),
('angel_dawn', 'ad_holy_ring', 'Holy Ring', 'gift', 'epic', 1.40, 8, '💍', 1, 1, 1),
('angel_dawn', 'ad_crown', 'Angel Crown', 'gift', 'legendary', 2.20, 4, '👑', 1, 1, 1),

-- cloud_gate RTP ~ 1.40
('cloud_gate', 'cg_feather_set', 'Feather Set', 'gift', 'common', 0.70, 24, '🪶', 1, 1, 1),
('cloud_gate', 'cg_halo_coin', 'Halo Coin', 'gift', 'common', 0.90, 19, '🪙', 1, 1, 1),
('cloud_gate', 'cg_ton_120', '1.20 TON', 'ton_balance', 'common', 1.20, 18, '💸', 0, 0, 1),
('cloud_gate', 'cg_cloud_gift', 'Cloud Gift', 'gift', 'rare', 1.55, 15, '☁️', 1, 1, 1),
('cloud_gate', 'cg_ton_200', '2.00 TON', 'ton_balance', 'rare', 2.00, 10, '💰', 0, 0, 1),
('cloud_gate', 'cg_star_badge', 'Star Badge', 'gift', 'epic', 2.80, 9, '⭐', 1, 1, 1),
('cloud_gate', 'cg_heaven_ticket', 'Heaven Ticket', 'gift', 'legendary', 4.50, 5, '🎫', 1, 1, 1),

-- halo_forge RTP ~ 3.50
('halo_forge', 'hf_blessed_orb', 'Blessed Orb', 'gift', 'common', 1.80, 24, '🔮', 1, 1, 1),
('halo_forge', 'hf_ton_250', '2.50 TON', 'ton_balance', 'common', 2.50, 20, '💸', 0, 0, 1),
('halo_forge', 'hf_luminous_core', 'Luminous Core', 'gift', 'rare', 3.20, 18, '💡', 1, 1, 1),
('halo_forge', 'hf_ton_400', '4.00 TON', 'ton_balance', 'rare', 4.00, 14, '💰', 0, 0, 1),
('halo_forge', 'hf_seraph_pin', 'Seraph Pin', 'gift', 'epic', 5.30, 12, '📌', 1, 1, 1),
('halo_forge', 'hf_halo_blade', 'Halo Blade', 'gift', 'legendary', 8.60, 6, '🗡️', 1, 1, 1),
('halo_forge', 'hf_ton_900', '9.00 TON', 'ton_balance', 'legendary', 9.00, 6, '🏦', 0, 0, 1),

-- divine_vault RTP ~ 7.00
('divine_vault', 'dv_sacred_cube', 'Sacred Cube', 'gift', 'common', 3.50, 24, '🧊', 1, 1, 1),
('divine_vault', 'dv_ton_500', '5.00 TON', 'ton_balance', 'common', 5.00, 20, '💸', 0, 0, 1),
('divine_vault', 'dv_light_idol', 'Light Idol', 'gift', 'rare', 6.30, 18, '🕯️', 1, 1, 1),
('divine_vault', 'dv_ton_800', '8.00 TON', 'ton_balance', 'rare', 8.00, 14, '💰', 0, 0, 1),
('divine_vault', 'dv_arch_halo', 'Arch Halo', 'gift', 'epic', 10.50, 12, '🌟', 1, 1, 1),
('divine_vault', 'dv_celestial_seal', 'Celestial Seal', 'gift', 'legendary', 17.00, 7, '🪬', 1, 1, 1),
('divine_vault', 'dv_ton_1800', '18.00 TON', 'ton_balance', 'legendary', 18.00, 5, '🏦', 0, 0, 1);
