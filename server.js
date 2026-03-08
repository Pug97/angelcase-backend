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

function log(...args) {
  console.log('[AngelCase]', ...args);
}

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

  log('TX_FETCH_V2 start', {
    account: RECEIVER_WALLET,
    hasApiKey: Boolean(TONCENTER_API_KEY)
  });

  const res = await fetch(url, { headers });
  const text = await res.text();

  if (!res.ok) {
    log('TX_FETCH_V2 failed', res.status, text);
    throw new Error(`toncenter_v2_error_${res.status}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    log('TX_FETCH_V2 invalid JSON', text);
    throw e;
  }

  let txs = [];
  if (Array.isArray(data)) {
    txs = data;
  } else if (Array.isArray(data.result)) {
    txs = data.result;
  } else {
    txs = [];
  }

  log('TX_FETCH_V2 success', `got ${txs.length} txs`);
  return txs;
}

function getIncomingValueNano(tx) {
  return String(tx?.in_msg?.value || '');
}

function getIncomingSource(tx) {
  return String(tx?.in_msg?.source || '');
}

function getIncomingDestination(tx) {
  return String(tx?.in_msg?.destination || '');
}

function getIncomingMessageText(tx) {
  return String(tx?.in_msg?.msg_data?.message || '');
}

function isRealIncomingDeposit(tx) {
  const inMsg = tx?.in_msg;
  if (!inMsg) return false;
  if (!inMsg.value) return false;
  return true;
}

async function confirmDeposit(orderId, txHash) {
  const deposit = await get(`SELECT * FROM deposits WHERE order_id = ?`, [orderId]);
  if (!deposit) {
    log('CONFIRM skipped, deposit not found', orderId);
    return;
  }

  if (deposit.status === 'confirmed') {
    log('CONFIRM skipped, already confirmed', orderId);
    return;
  }

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

  log('CONFIRM success', {
    orderId,
    txHash,
    telegramId: deposit.telegram_id,
    creditedAmount: deposit.amount
  });
}

async function scanDeposits() {
  try {
    const pending = await all(
      `SELECT * FROM deposits
       WHERE status IN ('created', 'sent')
       ORDER BY created_at DESC
       LIMIT 100`
    );

    if (!pending.length) {
      log('SCAN no pending deposits');
      return;
    }

    log(
      'SCAN pending deposits',
      pending.map(d => ({
        orderId: d.order_id,
        status: d.status,
        amount: d.amount,
        exactNano: d.comment
      }))
    );

    const txs = await fetchRecentReceiverTransactionsV2();

    txs.slice(0, 10).forEach((tx, index) => {
      log(`SCAN tx[${index}]`, {
        hash: tx?.transaction_id?.hash || '',
        valueNano: getIncomingValueNano(tx),
        source: getIncomingSource(tx),
        destination: getIncomingDestination(tx),
        message: getIncomingMessageText(tx),
        isRealIncoming: isRealIncomingDeposit(tx)
      });
    });

    for (const deposit of pending) {
      const expectedNano = String(deposit.comment || '');

      log('SCAN checking deposit', {
        orderId: deposit.order_id,
        expectedExactNano: expectedNano,
        expectedAmountTon: deposit.amount
      });

      const match = txs.find(tx => {
        if (!isRealIncomingDeposit(tx)) return false;
        const inValue = getIncomingValueNano(tx);
        return inValue === expectedNano;
      });

      if (match) {
        const txHash = String(match?.transaction_id?.hash || '');
        log('SCAN MATCH FOUND', {
          orderId: deposit.order_id,
          txHash,
          valueNano: getIncomingValueNano(match)
        });

        await confirmDeposit(deposit.order_id, txHash);
      } else {
        log('SCAN no match for deposit', deposit.order_id);
      }
    }
  } catch (error) {
    log('SCAN ERROR', error.message);
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
    log('profile_error', error.message);
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

    log('BIND WALLET success', { telegramId, wallet });
    res.json({ ok: true });
  } catch (error) {
    log('bind_wallet_error', error.message);
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

    log('DEPOSIT CREATED', {
      orderId,
      telegramId,
      requestedAmount: parsedAmount,
      exactAmount,
      exactNano
    });

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
    log('deposit_create_error', error.message);
    res.status(500).json({ error: 'deposit_create_error' });
  }
});

app.post('/api/deposits/mark-sent', async (req, res) => {
  const { orderId, senderWallet } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: 'orderId_required' });
  }

  try {
    await run(
      `UPDATE deposits
       SET status = 'sent', sender_wallet = ?
       WHERE order_id = ?`,
      [senderWallet || '', orderId]
    );

    log('DEPOSIT MARK SENT', { orderId, senderWallet: senderWallet || '' });
    res.json({ ok: true });
  } catch (error) {
    log('mark_sent_error', error.message);
    res.status(500).json({ error: 'mark_sent_error' });
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
    log('deposit_status_error', error.message);
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

    log('CASE OPEN success', {
      telegramId,
      caseKey,
      price: parsedPrice,
      prize: prize.name,
      newBalance: updatedUser.balance
    });

    res.json({
      ok: true,
      prize: prize.name,
      rarity: prize.rarity,
      newBalance: updatedUser.balance
    });
  } catch (error) {
    log('case_open_error', error.message);
    res.status(500).json({ error: 'case_open_error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

setInterval(() => {
  scanDeposits();
}, 10000);

app.listen(PORT, '0.0.0.0', () => {
  log(`Backend running on port ${PORT}`);
  log('ENV', {
    FRONTEND_ORIGIN,
    RECEIVER_WALLET,
    hasToncenterApiKey: Boolean(TONCENTER_API_KEY)
  });
});
