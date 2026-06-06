// reconcile.ts — Reconciliation API routes
// GET /api/reconcile and POST /api/reconcile/match

import { Router, Request, Response } from 'express';
import { getUnmatchedPayments, reconcilePayment } from '../db/queries.js';
import { apiResponse, apiError } from './wrapper.js';

export const reconcileRouter = Router();

// ── GET /api/reconcile — unmatched payments + match rate ────────────────
reconcileRouter.get('/api/reconcile', (_req: Request, res: Response) => {
  try {
    const result = getUnmatchedPayments();
    apiResponse(res, {
      unmatched: result.unmatched,
      total: result.total,
      matched: result.matched,
      matchRate: result.matchRate,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'RECONCILE_FETCH_FAILED', 'Failed to retrieve reconciliation data.', { error: msg });
  }
});

// ── POST /api/reconcile/match — mark payment as reconciled ──────────────
reconcileRouter.post('/api/reconcile/match', (req: Request, res: Response) => {
  try {
    const { af_ref, invoice_ref, tx_hash } = req.body;

    if (!af_ref || !invoice_ref) {
      apiError(res, 400, 'MISSING_PARAMETERS', 'af_ref and invoice_ref are required.');
      return;
    }

    const success = reconcilePayment(af_ref, invoice_ref, tx_hash);
    if (!success) {
      apiError(res, 404, 'PAYMENT_NOT_FOUND', `No payment found for ref ${af_ref}`);
      return;
    }

    apiResponse(res, { reconciled: true, af_ref, invoice_ref });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'RECONCILE_MATCH_FAILED', 'Failed to reconcile payment.', { error: msg });
  }
});
