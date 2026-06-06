// health.ts — GET /health
// Returns: Arc RPC status, DB status, latest block, clock offset, uptime

import { Router } from 'express';
import { getLatestBlock, arcClient } from '../chain/provider.js';
import { getDb } from '../db/schema.js';
import { clockSync } from '../clockSync.js';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', async (_req, res) => {
  try {
    // Sync clock if needed
    await clockSync.maybeSyncIfNeeded(arcClient);

    // Get latest Arc block
    let arcBlock: { number: number; timestamp: number; hash: string } | null = null;
    let rpcStatus = 'connected';
    try {
      arcBlock = await getLatestBlock();
    } catch {
      rpcStatus = 'disconnected';
    }

    // Check DB
    let dbStatus = 'connected';
    let tableCount = 0;
    try {
      const db = getDb();
      const tables = db.prepare(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name IN ('payments', 'agents', 'webhooks')"
      ).get() as { count: number };
      tableCount = tables.count;
    } catch {
      dbStatus = 'disconnected';
    }

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    res.json({
      success: true,
      data: {
        service: 'arcflow-backend',
        status: rpcStatus === 'connected' && dbStatus === 'connected' ? 'healthy' : 'degraded',
        arc: {
          rpc: rpcStatus,
          chainId: 5042002,
          network: 'eip155:5042002',
          latestBlock: arcBlock?.number ?? null,
          blockTimestamp: arcBlock?.timestamp ?? null,
          blockHash: arcBlock?.hash ?? null,
        },
        db: {
          status: dbStatus,
          tables: tableCount,
          mode: 'WAL',
        },
        clock: {
          offsetMs: clockSync.getOffsetMs(),
          synced: clockSync.isInitialized(),
          lastSyncBlock: clockSync.getLastSyncBlock(),
          networkTime: clockSync.isInitialized() ? clockSync.nowSeconds() : null,
          localTime: Math.floor(Date.now() / 1000),
        },
        uptime: uptimeSeconds,
      },
      meta: {
        timestamp: new Date().toISOString(),
        block: arcBlock?.number ?? 0,
        cached: false,
        version: '1.0',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check encountered an error',
        details: { error: message },
      },
    });
  }
});
