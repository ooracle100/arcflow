// payments.ts — Payments API routes for ArcFlow
// Handles GET /api/payments, GET /api/payments/:af_ref, and POST /api/payments/settle

import { Router, Request, Response } from 'express';
import { insertPayment, upsertAgent, getPayments, getPaymentByRef, getWebhooksForPayment, type PaymentRecord } from '../db/queries.js';
import { queueWebhook } from '../webhooks/emitter.js';
import { apiResponse, apiError } from './wrapper.js';

export const paymentsRouter = Router();

// ── GET /api/payments — paginated history with filters ──────────────────
paymentsRouter.get('/api/payments', (req: Request, res: Response) => {
  try {
    const { agent_wallet, reconciled, limit, offset } = req.query;
    const rows = getPayments({
      agent_wallet: agent_wallet as string | undefined,
      reconciled: reconciled !== undefined ? Number(reconciled) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    apiResponse(res, { payments: rows, count: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'PAYMENTS_FETCH_FAILED', 'Failed to retrieve payments.', { error: msg });
  }
});

// ── GET /api/payments/:af_ref — single payment + webhooks ───────────────
paymentsRouter.get('/api/payments/:af_ref', (req: Request, res: Response) => {
  try {
    const afRefParam = req.params.af_ref as string;
    const payment = getPaymentByRef(afRefParam);
    if (!payment) {
      apiError(res, 404, 'PAYMENT_NOT_FOUND', `No payment found for ref ${afRefParam}`);
      return;
    }
    const webhooks = getWebhooksForPayment(afRefParam);
    apiResponse(res, { payment, webhooks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    apiError(res, 500, 'PAYMENT_FETCH_FAILED', 'Failed to retrieve payment.', { error: msg });
  }
});

paymentsRouter.post('/api/payments/settle', (req: Request, res: Response) => {
  try {
    const { paymentSignature, requirements, endpoint, method, memo } = req.body;

    // Validate inputs
    if (!paymentSignature || !requirements || !memo) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing paymentSignature, requirements, or memo in settlement request.',
        },
      });
      return;
    }

    // For this ArcFlow MVP, we trust the middleware payload and focus on SQLite logging.
    const { amount, payTo, network } = requirements;
    const { af_ref, EndToEndId, CdtTrfTxInf, clock_offset_ms } = memo;

    const agentWallet = CdtTrfTxInf.DbtrAcct;
    const serviceWallet = CdtTrfTxInf.CdtrAcct;

    // Verify memo matches requirements
    // Note: requirements.amount is atomic, memo.Amt is decimal. We need to convert.
    const amountDecimal = (Number(amount) / 1_000_000).toFixed(6).replace(/\.?0+$/, '');
    if (amountDecimal !== memo.Amt || payTo.toLowerCase() !== serviceWallet.toLowerCase()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MEMO_MISMATCH',
          message: 'Memo contents do not match the payment requirements.',
        },
      });
      return;
    }

    const fullRecordJson = JSON.stringify(memo);

    const paymentRecord: PaymentRecord = {
      af_ref,
      e2e_id: EndToEndId ?? null,
      tx_hash: null, 
      onchain_memo: null, 
      agent_wallet: agentWallet,
      service_wallet: serviceWallet,
      amount: memo.Amt,
      token: 'USDC',
      endpoint: endpoint ?? null,
      method: method ?? null,
      status: 'confirmed',
      full_record: fullRecordJson,
      arcflow_fee: '0.000000', 
      clock_offset_ms: clock_offset_ms ?? 0,
    };

    // Log to SQLite (must be < 1 second)
    insertPayment(paymentRecord);
    
    // Update Agent spending profile
    upsertAgent(agentWallet, memo.Amt);

    // Queue Webhook (must fire within 3 seconds)
    const webhookUrl = process.env.WEBHOOK_URL || 'https://webhook.site/71618337-17f1-4db4-ab98-ec73693f1ed1';
    
    queueWebhook(af_ref, webhookUrl, {
      event: 'payment.confirmed',
      data: {
        af_ref,
        e2e_id: paymentRecord.e2e_id,
        tx_hash: paymentRecord.tx_hash,
        onchain_memo: paymentRecord.onchain_memo,
        agent_wallet: paymentRecord.agent_wallet,
        service_wallet: paymentRecord.service_wallet,
        amount: paymentRecord.amount,
        token: paymentRecord.token || 'USDC',
        endpoint: paymentRecord.endpoint,
        method: paymentRecord.method,
        timestamp: memo.timestamp,
      }
    });

    // Return the standard ArcFlow response
    res.json({
      success: true,
      data: {
        transaction: af_ref, 
        payer: agentWallet,
        network: network || 'eip155:5042002',
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
       console.info(`[ArcFlow] Payment retry detected (409) - already settled: ${msg}`);
       res.status(409).json({
         success: false,
         error: {
           code: 'PAYMENT_ALREADY_SETTLED',
           message: 'This payment was already processed.'
         }
       });
       return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to settle payment on the backend.',
        details: { error: msg }
      }
    });
  }
});
