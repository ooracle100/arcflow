// server.ts — Express entry point for ArcFlow backend

import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { paymentsRouter } from './routes/payments.js';
import { agentsRouter } from './routes/agents.js';
import { reconcileRouter } from './routes/reconcile.js';
import { statsRouter } from './routes/stats.js';
import { exportRouter } from './routes/export.js';
import { demoRouter } from './routes/demo.js';
import { getDb } from './db/schema.js';
import { clockSync } from './clockSync.js';
import { arcClient } from './chain/provider.js';
import { startQueueWorker } from './webhooks/queue.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Middleware
app.use(cors({
  origin: process.env.DASHBOARD_URL || '*',
  credentials: true
}));
app.use(express.json());

// Routes
app.use(healthRouter);
app.use(paymentsRouter);
app.use(agentsRouter);
app.use(reconcileRouter);
app.use(statsRouter);
app.use(exportRouter);
app.use(demoRouter);

// Startup
async function start() {
  console.log('[ArcFlow] Initializing...');

  // 1. Initialize SQLite
  try {
    const db = getDb();
    console.log('[ArcFlow] SQLite initialized (WAL mode)');

    // Verify tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    console.log(`[ArcFlow] Tables: ${tables.map(t => t.name).join(', ')}`);
  } catch (err) {
    console.error('[ArcFlow] SQLite initialization failed:', err);
    process.exit(1);
  }

  // 2. Sync clock with Arc network
  try {
    await clockSync.sync(arcClient);
    const offset = clockSync.getOffsetMs();
    console.log(`[ArcFlow] Clock synced — offset: ${offset}ms (block ${clockSync.getLastSyncBlock()})`);
  } catch (err) {
    console.warn('[ArcFlow] Clock sync failed — will retry on first request:', err);
  }

  // 3. Start server
  app.listen(PORT, () => {
    console.log(`[ArcFlow] Backend running at http://localhost:${PORT}`);
    console.log(`[ArcFlow] Health check: http://localhost:${PORT}/health`);
    startQueueWorker(5000); // Retry every 5 seconds
    console.log(`[ArcFlow] Webhook queue worker started`);
  });
}

start().catch((err) => {
  console.error('[ArcFlow] Fatal startup error:', err);
  process.exit(1);
});
