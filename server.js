import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://pug97.github.io';
const RECEIVER_WALLET =
  process.env.RECEIVER_WALLET || 'UQBwcw41wYAnPcQuHFtB9a_khXQLQR3LUCq5hMsyyQGuj37k';

const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY || '';
const TONCENTER_V2_BASE = 'https://toncenter.com/api/v2';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: false
  })
);

app.use(express.json());

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureUser(telegramId, username = '') {
  await run(
    `INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)`,
    [telegramId, username]
  );
}

async function seedCases() {
  await run(`DELETE FROM case_drops`);
  await run(`DELETE FROM cases`);

  const cases = [
    ['sunny_case', 'Sunny', 'кейс для самых ярких', 0.5, '🌞', 0.7068, 1],
    ['angel_case', 'Angel', 'сам ангел создал этот кейс', 1.0, '😇', 0.7005, 2]
  ];

  for (const item of cases) {
    await run(
      `INSERT INTO cases
        (case_key, title, subtitle, price_ton, image, rtp_target, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      item
    );
  }

  const drops = [
    // SUNNY
    ['sunny_case', 'sunny_rose', 'Rose', 'gift', 'common', 0.20, 84.6, '🌹', 1, 1, 1],
    ['sunny_case', 'sunny_ton_040', '0.40 TON', 'ton_balance', 'common', 0.40, 8.0, '💎', 0, 0, 1],
    ['sunny_case', 'sunny_ring', 'Ring', 'gift', 'epic', 0.70, 4.0, '💍', 1, 1, 1],
    ['sunny_case', 'sunny_trophy', 'Trophy', 'gift', 'epic', 1.00, 0.8, '🏆', 1, 1, 1],
    ['sunny_case', 'sunny_ramen', 'Ramen', 'gift', 'legendary', 3.96, 1.0, '🍜', 1, 1, 1],
    ['sunny_case', 'sunny_ice_cream', 'Ice Cream', 'gift', 'legendary', 4.00, 1.0, '🍦', 1, 1, 1],
    ['sunny_case', 'sunny_happy_brownie', 'Happy Brownie', 'gift', 'legendary', 4.26, 0.5, '💩', 1, 1, 1],
    ['sunny_case', 'sunny_love_potion', 'Love Potion', 'gift', 'mythical', 15.32, 0.1, '🍾', 1, 1, 1],

    // ANGEL
    ['angel_case', 'angel_rose', 'Rose', 'gift', 'common', 0.20, 45.7, '🌹', 1, 1, 1],
    ['angel_case', 'angel_ton_075', '0.75 TON', 'ton_balance', 'common', 0.75, 42.0, '💎', 0, 0, 1],
    ['angel_case', 'angel_bouquet', 'Bouquet', 'gift', 'epic', 1.00, 7.0, '💐', 1, 1, 1],
    ['angel_case', 'angel_ton_3', '3 TON', 'ton_balance', 'epic', 3.00, 3.3, '💎', 0, 0, 1],
    ['angel_case', 'angel_whip_cupcake', 'Whip Cupcake', 'gift', 'legendary', 4.40, 0.7, '🧁', 1, 1, 1],
    ['angel_case', 'angel_snoop_dogg', 'Snoop Dogg', 'gift', 'legendary', 4.63, 0.6, '🐕‍🦺', 1, 1, 1],
    ['angel_case', 'angel_spring_basket', 'Spring Basket', 'gift', 'legendary', 5.32, 0.5, '🐇', 1, 1, 1],
    ['angel_case', 'angel_ton_15', '15 TON', 'ton_balance', 'mythical', 15.00, 0.1, '💎', 0, 0, 1],
    ['angel_case', 'angel_ionic_dryer', 'Ionic Dryer', 'gift', 'mythical', 17.64, 0.07, '🐦‍🔥', 1, 1, 1],
    ['angel_case', 'angel_toy_bear', 'Toy Bear', 'gift', 'mythical', 41.90, 0.03, '🧸', 1, 1, 1]
  ];

  for (const drop of drops) {
    await run(
      `INSERT INTO case_drops
        (case_key, item_key, item_name, item_type, rarity, ton_value, weight, image, can_sell, can_withdraw, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      drop
    );
  }
}

function buildExactNano(baseTon) {
  const baseNano = Math.round(Number(baseTon) * 1_000_000_000);
  const randomNanoSuffix = crypto.randomInt(100000, 999999);
  return String(baseNano + randomNanoSuffix);
}

function nanoToTonString(nanoString) {
  return (Number(nanoString) / 1_000_000_000).toFixed(6);
}

async function fetchRecentReceiverTransactionsV2() {
  const url = new URL(`${TONCENTER_V2_BASE}/getTransactions`);
  url.searchParams.set('address', RECEIVER_WALLET);
  url.searchParams.set('limit', '50');
  url.searchParams.set('to_lt', '0');
  url.searchParams.set('archival', 'true');

  const headers = {
    accept: 'application/json'
  };

  if (TONCENTER_API_KEY) {
    headers['X-API-Key'] = TONCENTER_API_KEY;
  }

  const res = await fetch(url, { headers });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`toncenter_v2_error_${res.status}: ${text}`);
  }

  const data = JSON.parse(text);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.result)) return data.result;
  return [];
}

function getIncomingValueNano(tx) {
  return String(tx?.in_msg?.value || '');
}

function isRealIncomingDeposit(tx) {
  const inMsg = tx?.in_msg;
  if (!inMsg) return false;
  if (!inMsg.value) return false;
  return true;
}

async function confirmDeposit(orderId, txHash) {
  const deposit = await get(`SELECT * FROM deposits WHERE order_id = ?`, [orderId]);
  if (!deposit || deposit.status === 'confirmed') return;

  await run(
    `UPDATE deposits
     SET status = 'confirmed', tx_hash = ?, confirmed_at = CURRENT_TIMESTAMP
     WHERE order_id = ?`,
    [txHash, orderId]
  );

  await run(
    `UPDATE users
     SET balance = balance + ?
     WHERE telegram_id = ?`,
    [deposit.amount, deposit.telegram_id]
  );
}

async function scanDeposits() {
  try {
    const pending = await all(
      `SELECT * FROM deposits
       WHERE status IN ('created')
       ORDER BY created_at DESC
       LIMIT 100`
    );

    if (!pending.length) return;

    const txs = await fetchRecentReceiverTransactionsV2();

    for (const deposit of pending) {
      const expectedNano = String(deposit.comment || '');

      const match = txs.find(tx => {
        if (!isRealIncomingDeposit(tx)) return false;
        const inValue = getIncomingValueNano(tx);
        return inValue === expectedNano;
      });

      if (match) {
        const txHash = String(match?.transaction_id?.hash || '');
        await confirmDeposit(deposit.order_id, txHash);
      }
    }
  } catch (error) {
    console.error('scanDeposits error:', error.message);
  }
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= Number(item.weight || 0);
    if (roll <= 0) return item;
  }

  return items[items.length - 1];
}

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'AngelCase backend is running' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/profile/:telegramId', async (req, res) => {
  try {
    await ensureUser(req.params.telegramId);
    const user = await get(
      `SELECT * FROM users WHERE telegram_id = ?`,
      [req.params.telegramId]
    );
    res.json(user);
  } catch {
    res.status(500).json({ error: 'profile_error' });
  }
});

app.post('/api/profile/bind-wallet', async (req, res) => {
  const { telegramId, username, wallet } = req.body;

  if (!telegramId || !wallet) {
    return res.status(400).json({ error: 'telegramId_and_wallet_required' });
  }

  try {
    await ensureUser(telegramId, username || '');
    await run(
      `UPDATE users
       SET wallet_address = ?, username = COALESCE(NULLIF(?, ''), username)
       WHERE telegram_id = ?`,
      [wallet, username || '', telegramId]
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'bind_wallet_error' });
  }
});

app.get('/api/cases', async (req, res) => {
  try {
    const cases = await all(
      `SELECT case_key, title, subtitle, price_ton, image, rtp_target
       FROM cases
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`
    );

    const result = [];

    for (const item of cases) {
      const preview = await all(
        `SELECT item_name, item_type, rarity, ton_value, image
         FROM case_drops
         WHERE case_key = ? AND is_active = 1
         ORDER BY ton_value ASC, id ASC`,
        [item.case_key]
      );

      result.push({
        ...item,
        preview
      });
    }

    res.json({ cases: result });
  } catch {
    res.status(500).json({ error: 'cases_error' });
  }
});

app.get('/api/inventory/:telegramId', async (req, res) => {
  try {
    await ensureUser(req.params.telegramId);

    const items = await all(
      `SELECT id, telegram_id, item_key, item_name, item_type, rarity, ton_value, image, status, can_sell, can_withdraw, created_at
       FROM inventory
       WHERE telegram_id = ? AND status IN ('owned', 'withdraw_requested')
       ORDER BY id DESC`,
      [req.params.telegramId]
    );

    res.json({ items });
  } catch {
    res.status(500).json({ error: 'inventory_error' });
  }
});

app.post('/api/inventory/sell', async (req, res) => {
  const { telegramId, inventoryId } = req.body;

  if (!telegramId || !inventoryId) {
    return res.status(400).json({ error: 'invalid_sell_request' });
  }

  try {
    const item = await get(
      `SELECT * FROM inventory WHERE id = ? AND telegram_id = ?`,
      [inventoryId, telegramId]
    );

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    if (item.status !== 'owned') {
      return res.status(400).json({ error: 'item_not_sellable_status' });
    }

    if (Number(item.can_sell) !== 1) {
      return res.status(400).json({ error: 'item_cannot_be_sold' });
    }

    await run(`UPDATE inventory SET status = 'sold' WHERE id = ?`, [inventoryId]);
    await run(
      `UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
      [item.ton_value, telegramId]
    );

    const user = await get(
      `SELECT balance FROM users WHERE telegram_id = ?`,
      [telegramId]
    );

    res.json({
      ok: true,
      soldFor: item.ton_value,
      newBalance: user.balance
    });
  } catch {
    res.status(500).json({ error: 'sell_error' });
  }
});

app.post('/api/inventory/withdraw', async (req, res) => {
  const { telegramId, inventoryId } = req.body;

  if (!telegramId || !inventoryId) {
    return res.status(400).json({ error: 'invalid_withdraw_request' });
  }

  try {
    const item = await get(
      `SELECT * FROM inventory WHERE id = ? AND telegram_id = ?`,
      [inventoryId, telegramId]
    );

    if (!item) {
      return res.status(404).json({ error: 'item_not_found' });
    }

    if (item.status !== 'owned') {
      return res.status(400).json({ error: 'item_not_withdrawable_status' });
    }

    if (Number(item.can_withdraw) !== 1) {
      return res.status(400).json({ error: 'item_cannot_be_withdrawn' });
    }

    await run(
      `UPDATE inventory SET status = 'withdraw_requested' WHERE id = ?`,
      [inventoryId]
    );

    res.json({
      ok: true,
      status: 'withdraw_requested'
    });
  } catch {
    res.status(500).json({ error: 'withdraw_error' });
  }
});

app.post('/api/deposits/create', async (req, res) => {
  const { telegramId, username, amount } = req.body;
  const parsedAmount = Number(amount);

  if (!telegramId || !parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: 'invalid_deposit_data' });
  }

  const orderId = crypto.randomUUID();
  const exactNano = buildExactNano(parsedAmount);
  const exactAmount = Number(nanoToTonString(exactNano));

  try {
    await ensureUser(telegramId, username || '');
    await run(
      `INSERT INTO deposits
       (order_id, telegram_id, amount, receiver_wallet, comment, status)
       VALUES (?, ?, ?, ?, ?, 'created')`,
      [orderId, telegramId, exactAmount, RECEIVER_WALLET, exactNano]
    );

    res.json({
      ok: true,
      orderId,
      requestedAmount: parsedAmount,
      exactAmount,
      exactNano,
      receiverWallet: RECEIVER_WALLET,
      status: 'created'
    });
  } catch {
    res.status(500).json({ error: 'deposit_create_error' });
  }
});

app.get('/api/deposits/:orderId', async (req, res) => {
  try {
    const deposit = await get(
      `SELECT order_id, amount, status, confirmed_at
       FROM deposits
       WHERE order_id = ?`,
      [req.params.orderId]
    );

    if (!deposit) {
      return res.status(404).json({ error: 'deposit_not_found' });
    }

    res.json(deposit);
  } catch {
    res.status(500).json({ error: 'deposit_status_error' });
  }
});

app.post('/api/cases/open', async (req, res) => {
  const { telegramId, username, caseKey } = req.body;

  if (!telegramId || !caseKey) {
    return res.status(400).json({ error: 'invalid_case_request' });
  }

  try {
    await ensureUser(telegramId, username || '');

    const caseData = await get(
      `SELECT * FROM cases WHERE case_key = ? AND is_active = 1`,
      [caseKey]
    );

    if (!caseData) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    const user = await get(
      `SELECT * FROM users WHERE telegram_id = ?`,
      [telegramId]
    );

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    if (Number(user.balance) < Number(caseData.price_ton)) {
      return res.status(400).json({ error: 'not_enough_balance' });
    }

    const drops = await all(
      `SELECT * FROM case_drops
       WHERE case_key = ? AND is_active = 1`,
      [caseKey]
    );

    if (!drops.length) {
      return res.status(400).json({ error: 'case_has_no_drops' });
    }

    const drop = weightedPick(drops);

    await run(
      `UPDATE users SET balance = balance - ? WHERE telegram_id = ?`,
      [caseData.price_ton, telegramId]
    );

    if (drop.item_type === 'ton_balance') {
      await run(
        `UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
        [drop.ton_value, telegramId]
      );
    } else {
      await run(
        `INSERT INTO inventory
         (telegram_id, item_key, item_name, item_type, rarity, ton_value, image, status, can_sell, can_withdraw)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'owned', ?, ?)`,
        [
          telegramId,
          drop.item_key,
          drop.item_name,
          drop.item_type,
          drop.rarity,
          drop.ton_value,
          drop.image || '',
          Number(drop.can_sell || 0),
          Number(drop.can_withdraw || 0)
        ]
      );
    }

    const updatedUser = await get(
      `SELECT balance FROM users WHERE telegram_id = ?`,
      [telegramId]
    );

    res.json({
      ok: true,
      caseTitle: caseData.title,
      prize: drop.item_name,
      itemType: drop.item_type,
      rarity: drop.rarity,
      tonValue: drop.ton_value,
      image: drop.image || '',
      newBalance: updatedUser.balance
    });
  } catch {
    res.status(500).json({ error: 'case_open_error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

async function start() {
  try {
    await seedCases();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`AngelCase backend running on port ${PORT}`);
    });

    setInterval(() => {
      scanDeposits();
    }, 10000);
  } catch (error) {
    console.error('startup_error:', error.message);
    process.exit(1);
  }
}

start();
