// agents.ts — Agent profile API routes
// GET /api/agents and GET /api/agents/:wallet

import { Router, Request, Response } from 'express';
import { getAllAgents, getAgent, getPayments } from '../db/queries.js';
import { apiResponse, apiError } from './wrapper.js';

export const agentsRouter = Router();

// ── GET /api/agents — all agents sorted by spend ────────────────────────
agentsRouter.get('/api/agents', (_req: Request, res: Response) => {
  try {
    const agents = getAllAgents();
    apiResponse(res, { agents, count: agents.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'AGENTS_FETCH_FAILED', 'Failed to retrieve agents.', { error: msg });
  }
});

// ── GET /api/agents/:wallet — single agent + recent payments ────────────
agentsRouter.get('/api/agents/:wallet', (req: Request, res: Response) => {
  try {
    const walletParam = req.params.wallet as string;
    const agent = getAgent(walletParam);
    if (!agent) {
      apiError(res, 404, 'AGENT_NOT_FOUND', `No agent found for wallet ${req.params.wallet}`);
      return;
    }
    const payments = getPayments({
      agent_wallet: walletParam,
      limit: 20,
      offset: 0,
    });
    apiResponse(res, { agent, payments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'AGENT_FETCH_FAILED', 'Failed to retrieve agent.', { error: msg });
  }
});
