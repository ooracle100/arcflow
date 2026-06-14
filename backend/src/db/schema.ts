// schema.ts — SQLite schema (WAL mode)
// Adapted from FlowGate's proven schema for Arc blockchain.
// All amounts stored as strings (not floats) — USDC has 6 decimals.

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/arcflow.db');

export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  // Enable WAL mode for concurrent reads during writes
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- payments table — every confirmed nanopayment
    CREATE TABLE IF NOT EXISTS payments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      af_ref          TEXT UNIQUE NOT NULL,
      e2e_id          TEXT,
      tx_hash         TEXT UNIQUE,
      onchain_memo    TEXT,
      agent_wallet    TEXT NOT NULL,
      service_wallet  TEXT NOT NULL,
      amount          TEXT NOT NULL,
      token           TEXT DEFAULT 'USDC',
      endpoint        TEXT,
      method          TEXT,
      status          TEXT DEFAULT 'confirmed',
      reconciled      INTEGER DEFAULT 0,
      invoice_ref     TEXT,
      full_record     TEXT,
      arcflow_fee     TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      block_number    INTEGER,
      clock_offset_ms INTEGER
    );

    -- agents table — spending profiles
    CREATE TABLE IF NOT EXISTS agents (
      wallet          TEXT PRIMARY KEY,
      total_spent     TEXT DEFAULT '0',
      tx_count        INTEGER DEFAULT 0,
      daily_limit     TEXT,
      alert_threshold TEXT,
      last_seen       TEXT
    );

    -- webhooks table — delivery log with retry
    CREATE TABLE IF NOT EXISTS webhooks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_af_ref  TEXT NOT NULL,
      endpoint_url    TEXT NOT NULL,
      payload         TEXT NOT NULL,
      status          TEXT DEFAULT 'pending',
      attempts        INTEGER DEFAULT 0,
      last_attempt    TEXT,
      delivered_at    TEXT
    );

    -- indexes
    CREATE INDEX IF NOT EXISTS idx_payments_agent      ON payments(agent_wallet);
    CREATE INDEX IF NOT EXISTS idx_payments_date       ON payments(created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_reconciled ON payments(reconciled);
    CREATE INDEX IF NOT EXISTS idx_webhooks_status     ON webhooks(status);
  `);

  return db;
}

// Singleton database instance
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = initDatabase();
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
