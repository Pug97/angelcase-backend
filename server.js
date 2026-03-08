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
const TONCENTER_BASE = 'https://toncenter.com/api/v3';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: false
  })
);

app.use(express.json());

const casePools = {
  angel: [
    { name: 'Small Gift', rarity: 'common' },
    { name: 'Angel Feather', rarity: 'common' },
    { name: 'Golden Wing', rarity: 'rare' },
    { name: 'Divine Halo', rarity: 'epic' },
    { name: 'Angel Crown', rarity: 'legendary' }
  ],
  heaven: [
    { name: 'Sky Gift', rarity: 'rare' },
    { name: 'Holy Box', rarity: 'rare' },
    { name: 'Saint Relic', rarity: 'epic' },
    { name: 'Heaven Crown', rarity: 'legendary' }
  ],
  divine: [
    { name: 'Sacred Gift', rarity: 'rare' },
    { name: 'Divine Feather', rarity: 'epic' },
    { name: 'Light Relic', rarity: 'epic' },
    { name: 'Celestial Crown', rarity: 'legendary' }
  ]
};

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

function buildExactNano(baseTon) {
  const baseNano = Math.round(Number(baseTon) * 1_000_000_000);
  const randomNanoSuffix = crypto.randomInt(100_000, 999_999);
  return String(baseNano + randomNanoSuffix);
}

function nanoToTonString(nanoString) {
  return (Number(nanoString) / 1_000_000_000).toFixed(6);
}

async function fetchRecentReceiverTransactions() {
  const url = new URL(`${TONCENTER_BASE}/transactions`);
  url.searchParams.set('account', RECEIVER_WALLET);
  url.searchParams.set('limit', '100');
  url.searchParams.set('sort', 'desc');

  const headers = {};
  if (TONCENTER_API_KEY) {
    headers['X-API-Key'] = TONCENTER_API_KEY;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`toncenter_error_${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data.transactions) ? data.transactions : [];
}

function isRealIncomingDeposit(tx) {
  if (!tx || tx.description?.type !== 'ord') return false;
  if (tx?.in_msg?.created_lt === null || tx?.in_msg?.created_lt === undefined) return false;

  const bouncePhase = tx?.description?.bounce;
  if (bouncePhase && bouncePhase.type === 'ok') return false;

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
  const pending = await all(
    `SELECT * FROM deposits WHERE status IN ('created', 'sent') ORDER BY created_at DESC LIMIT 100`
  );

  if (!pending.length) return;

  const txs = await fetchRecentReceiverTransactions();

  for (const deposit of pending) {
    const exactNano = String(deposit.comment || '');

    const match = txs.find(tx => {
      if (!isRealIncomingDeposit(tx)) return false;
      const inValue = String(tx?.in_msg?.value || '');
      return inValue === exactNano;
    });

    if (match) {
      await confirmDeposit(deposit.order_id, match.hash || '');
    }
  }
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
  } catch (error) {
    console.error('profile_error:', error);
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
  } catch (error) {
    console.error('bind_wallet_error:', error);
    res.status(500).json({ error: 'bind_wallet_error' });
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
  } catch (error) {
    console.error('deposit_create_error:', error);
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
  } catch (error) {
    console.error('deposit_status_error:', error);
    res.status(500).json({ error: 'deposit_status_error' });
  }
});

app.post('/api/cases/open', async (req, res) => {
  const { telegramId, username, caseKey, price } = req.body;
  const parsedPrice = Number(price);
  const pool = casePools[caseKey] || casePools.angel;

  if (!telegramId || !parsedPrice || parsedPrice <= 0) {
    return res.status(400).json({ error: 'invalid_case_request' });
  }

  try {
    await ensureUser(telegramId, username || '');
    const user = await get(
      `SELECT * FROM users WHERE telegram_id = ?`,
      [telegramId]
    );

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    if (Number(user.balance) < parsedPrice) {
      return res.status(400).json({ error: 'not_enough_balance' });
    }

    const prize = pool[Math.floor(Math.random() * pool.length)];

    await run(
      `UPDATE users
       SET balance = balance - ?
       WHERE telegram_id = ?`,
      [parsedPrice, telegramId]
    );

    await run(
      `INSERT INTO inventory (telegram_id, item_name, rarity)
       VALUES (?, ?, ?)`,
      [telegramId, prize.name, prize.rarity]
    );

    const updatedUser = await get(
      `SELECT balance FROM users WHERE telegram_id = ?`,
      [telegramId]
    );

    res.json({
      ok: true,
      prize: prize.name,
      rarity: prize.rarity,
      newBalance: updatedUser.balance
    });
  } catch (error) {
    console.error('case_open_error:', error);
    res.status(500).json({ error: 'case_open_error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

setInterval(() => {
  scanDeposits().catch(err => {
    console.error('scanDeposits error:', err.message);
  });
}, 10000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AngelCase backend running on port ${PORT}`);
});
