// queries.ts — SQLite queries for payments, agents, and webhooks
// Safe ESM implementation using getDb() from schema.ts.

import { getDb } from './schema.js';
import { type Hex } from 'viem';

export interface PaymentRecord {
  af_ref: string;
  e2e_id: string | null;
  tx_hash: string | null;
  onchain_memo: string | null;
  agent_wallet: string;
  service_wallet: string;
  amount: string;          // decimal string e.g. "0.05"
  token?: string;
  endpoint: string | null;
  method: string | null;
  status?: string;
  reconciled?: number;
  invoice_ref?: string | null;
  full_record: string | null; // full JSON memo string
  arcflow_fee: string | null; // decimal string
  block_number?: number | null;
  clock_offset_ms: number | null;
}

export interface AgentRecord {
  wallet: string;
  total_spent: string;
  tx_count: number;
  daily_limit?: string | null;
  alert_threshold?: string | null;
  last_seen?: string | null;
}

export interface WebhookRecord {
  id?: number;
  payment_af_ref: string;
  endpoint_url: string;
  payload: string;
  status?: string;
  attempts?: number;
  last_attempt?: string | null;
  delivered_at?: string | null;
}

// ─── Payments Queries ───────────────────────────────────────────────────

/**
 * Inserts a confirmed payment record into the payments table.
 */
export function insertPayment(p: PaymentRecord): void {
  const db = getDb();
  
  const stmt = db.prepare(`
    INSERT INTO payments (
      af_ref, e2e_id, tx_hash, onchain_memo, agent_wallet, service_wallet,
      amount, token, endpoint, method, status, reconciled, invoice_ref,
      full_record, arcflow_fee, block_number, clock_offset_ms
    ) VALUES (
      @af_ref, @e2e_id, @tx_hash, @onchain_memo, @agent_wallet, @service_wallet,
      @amount, @token, @endpoint, @method, @status, @reconciled, @invoice_ref,
      @full_record, @arcflow_fee, @block_number, @clock_offset_ms
    )
  `);

  stmt.run({
    af_ref: p.af_ref,
    e2e_id: p.e2e_id,
    tx_hash: p.tx_hash,
    onchain_memo: p.onchain_memo,
    agent_wallet: p.agent_wallet.toLowerCase(),
    service_wallet: p.service_wallet.toLowerCase(),
    amount: p.amount,
    token: p.token ?? 'USDC',
    endpoint: p.endpoint,
    method: p.method ? p.method.toUpperCase() : null,
    status: p.status ?? 'confirmed',
    reconciled: p.reconciled ?? 0,
    invoice_ref: p.invoice_ref ?? null,
    full_record: p.full_record,
    arcflow_fee: p.arcflow_fee ?? '0.000000',
    block_number: p.block_number ?? null,
    clock_offset_ms: p.clock_offset_ms
  });
}

/**
 * Fetches a single payment record by its af_ref.
 */
export function getPaymentByRef(afRef: string): any {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM payments WHERE af_ref = ?');
  return stmt.get(afRef);
}

/**
 * Retrieves paginated payment history with optional filtering.
 */
export function getPayments(options: {
  agent_wallet?: string;
  reconciled?: number;
  limit?: number;
  offset?: number;
} = {}): any[] {
  const db = getDb();
  let query = 'SELECT * FROM payments WHERE 1=1';
  const params: any = {};

  if (options.agent_wallet) {
    query += ' AND LOWER(agent_wallet) = @agent_wallet';
    params.agent_wallet = options.agent_wallet.toLowerCase();
  }

  if (options.reconciled !== undefined) {
    query += ' AND reconciled = @reconciled';
    params.reconciled = options.reconciled;
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit !== undefined) {
    query += ' LIMIT @limit';
    params.limit = options.limit;
  }

  if (options.offset !== undefined) {
    query += ' OFFSET @offset';
    params.offset = options.offset;
  }

  const stmt = db.prepare(query);
  return stmt.all(params);
}

// ─── Agent Queries ──────────────────────────────────────────────────────

/**
 * Fetches a single agent profile.
 */
export function getAgent(wallet: string): AgentRecord | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents WHERE LOWER(wallet) = ?');
  return stmt.get(wallet.toLowerCase()) as AgentRecord | undefined;
}

/**
 * Upserts an agent profile and increments their total spent and transaction count.
 * Uses micro-unit math to avoid float precision bugs in JS/SQLite.
 */
export function upsertAgent(wallet: string, amountDecimal: string): void {
  const db = getDb();
  
  const existing = getAgent(wallet);
  const nowStr = new Date().toISOString();
  
  if (existing) {
    const currentSpentAtomic = BigInt(Math.round(parseFloat(existing.total_spent) * 1_000_000));
    const addSpentAtomic = BigInt(Math.round(parseFloat(amountDecimal) * 1_000_000));
    const newSpentAtomic = currentSpentAtomic + addSpentAtomic;
    const newSpentDecimal = (Number(newSpentAtomic) / 1_000_000).toFixed(6);

    const stmt = db.prepare(`
      UPDATE agents
      SET total_spent = ?, tx_count = tx_count + 1, last_seen = ?
      WHERE LOWER(wallet) = ?
    `);
    stmt.run(newSpentDecimal, nowStr, wallet.toLowerCase());
  } else {
    const amountFormatted = parseFloat(amountDecimal).toFixed(6);
    
    const stmt = db.prepare(`
      INSERT INTO agents (wallet, total_spent, tx_count, last_seen)
      VALUES (?, ?, 1, ?)
    `);
    stmt.run(wallet.toLowerCase(), amountFormatted, nowStr);
  }
}

/**
 * Retrieves all agents sorted by highest spending.
 */
export function getAllAgents(): AgentRecord[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM agents ORDER BY total_spent DESC');
  return stmt.all() as AgentRecord[];
}

// ─── Webhook Queries ────────────────────────────────────────────────────

/**
 * Inserts a webhook delivery task into the queue.
 */
export function insertWebhook(w: Omit<WebhookRecord, 'id'>): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO webhooks (payment_af_ref, endpoint_url, payload, status, attempts, last_attempt, delivered_at)
    VALUES (@payment_af_ref, @endpoint_url, @payload, @status, @attempts, @last_attempt, @delivered_at)
  `);

  const info = stmt.run({
    payment_af_ref: w.payment_af_ref,
    endpoint_url: w.endpoint_url,
    payload: w.payload,
    status: w.status ?? 'pending',
    attempts: w.attempts ?? 0,
    last_attempt: w.last_attempt ?? null,
    delivered_at: w.delivered_at ?? null
  });

  return Number(info.lastInsertRowid);
}

/**
 * Updates a webhook status and attempts count.
 */
export function updateWebhookStatus(
  id: number,
  status: string,
  attempts: number,
  lastAttempt: string,
  deliveredAt: string | null = null
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE webhooks
    SET status = ?, attempts = ?, last_attempt = ?, delivered_at = ?
    WHERE id = ?
  `);
  stmt.run(status, attempts, lastAttempt, deliveredAt, id);
}

/**
 * Retrieves all pending or retryable webhooks in FIFO order.
 */
export function getPendingWebhooks(): WebhookRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM webhooks
    WHERE status = 'pending' OR status = 'retry'
    ORDER BY last_attempt ASC, id ASC
  `);
  return stmt.all() as WebhookRecord[];
}

/**
 * Retrieves all webhooks for a specific payment reference.
 */
export function getWebhooksForPayment(afRef: string): WebhookRecord[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM webhooks WHERE payment_af_ref = ?');
  return stmt.all(afRef) as WebhookRecord[];
}

// ─── Stats Queries ──────────────────────────────────────────────────────

/**
 * Returns aggregate stats: total volume, tx count, top agents, fees earned.
 */
export function getStats(): {
  totalVolume: string;
  txCount: number;
  feesEarned: string;
  topAgents: { wallet: string; total_spent: string; tx_count: number }[];
  dailyVolume: { date: string; volume: string; count: number }[];
} {
  const db = getDb();

  // Total volume and tx count
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(amount AS REAL)), 0) AS totalVolume,
      COUNT(*) AS txCount,
      COALESCE(SUM(CAST(arcflow_fee AS REAL)), 0) AS feesEarned
    FROM payments
  `).get() as { totalVolume: number; txCount: number; feesEarned: number };

  // Top 10 agents by spend
  const topAgents = db.prepare(`
    SELECT wallet, total_spent, tx_count
    FROM agents
    ORDER BY CAST(total_spent AS REAL) DESC
    LIMIT 10
  `).all() as { wallet: string; total_spent: string; tx_count: number }[];

  // Daily volume for the last 30 days
  const dailyVolume = db.prepare(`
    SELECT
      DATE(created_at) AS date,
      COALESCE(SUM(CAST(amount AS REAL)), 0) AS volume,
      COUNT(*) AS count
    FROM payments
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all() as { date: string; volume: number; count: number }[];

  return {
    totalVolume: totals.totalVolume.toFixed(6),
    txCount: totals.txCount,
    feesEarned: totals.feesEarned.toFixed(6),
    topAgents,
    dailyVolume: dailyVolume.map(d => ({
      date: d.date,
      volume: d.volume.toFixed(6),
      count: d.count,
    })),
  };
}

// ─── Reconciliation Queries ─────────────────────────────────────────────

/**
 * Returns unmatched (unreconciled) payments and the overall match rate.
 */
export function getUnmatchedPayments(): {
  unmatched: any[];
  total: number;
  matched: number;
  matchRate: number;
} {
  const db = getDb();

  const unmatched = db.prepare(
    'SELECT * FROM payments WHERE reconciled = 0 ORDER BY created_at DESC'
  ).all();

  const total = (db.prepare('SELECT COUNT(*) AS c FROM payments').get() as { c: number }).c;
  const matched = (db.prepare('SELECT COUNT(*) AS c FROM payments WHERE reconciled = 1').get() as { c: number }).c;

  return {
    unmatched,
    total,
    matched,
    matchRate: total > 0 ? Math.round((matched / total) * 10000) / 100 : 100,
  };
}

/**
 * Marks a payment as reconciled with an invoice reference and optional tx_hash.
 */
export function reconcilePayment(
  afRef: string,
  invoiceRef: string,
  txHash?: string
): boolean {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM payments WHERE af_ref = ?').get(afRef);
  if (!existing) return false;

  const stmt = db.prepare(`
    UPDATE payments
    SET reconciled = 1, invoice_ref = ?, tx_hash = COALESCE(?, tx_hash)
    WHERE af_ref = ?
  `);
  stmt.run(invoiceRef, txHash ?? null, afRef);
  return true;
}

// ─── Date-Filtered Export Query ─────────────────────────────────────────

/**
 * Returns payments filtered by date range for CSV export.
 */
export function getPaymentsByDateRange(startDate?: string, endDate?: string): any[] {
  const db = getDb();
  let query = 'SELECT * FROM payments WHERE 1=1';
  const params: any = {};

  if (startDate) {
    query += ' AND created_at >= @startDate';
    params.startDate = startDate;
  }
  if (endDate) {
    query += ' AND created_at <= @endDate';
    params.endDate = endDate;
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(params);
}
