// stats.ts — Aggregate statistics API route
// GET /api/stats

import { Router, Request, Response } from 'express';
import { getStats } from '../db/queries.js';
import { apiResponse, apiError } from './wrapper.js';

export const statsRouter = Router();

// ── GET /api/stats — daily volume, tx count, top agents, fees earned ────
statsRouter.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const stats = getStats();
    apiResponse(res, stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'STATS_FETCH_FAILED', 'Failed to retrieve statistics.', { error: msg });
  }
});
