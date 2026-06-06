// demo.ts — Public endpoint to demonstrate successful testnet settlement
// Uses the backend's own internal modules — zero imports from @getarcflow/*

import { Router, type Request, type Response } from 'express';
import { getConfig } from '../chain/gateway.js';

export const demoRouter = Router();

const PRICE = '0.01';
const env = (process.env.ARC_ENV as 'TESTNET' | 'MAINNET') || 'TESTNET';
const arc = getConfig(env);

/**
 * Converts a decimal USDC price to atomic units (6 decimals).
 * e.g. "0.01" -> "10000"
 */
function usdcToAtomic(price: string): string {
  return Math.round(parseFloat(price) * 1_000_000).toString();
}

demoRouter.get('/api/demo/summary', async (req: Request, res: Response): Promise<void> => {
  const sellerAddress = process.env.SELLER_ADDRESS as `0x${string}`;
  const paymentSignature = req.headers['payment-signature'] as string | undefined;

  // ─── Case A: No payment signature → return 402 challenge ──────────
  if (!paymentSignature) {
    const requirements = {
      scheme: 'exact' as const,
      network: arc.NETWORK,
      asset: arc.USDC,
      amount: usdcToAtomic(PRICE),
      payTo: sellerAddress,
      maxTimeoutSeconds: 345600,
      extra: {
        name: 'GatewayWalletBatched',
        version: '1',
        verifyingContract: arc.GATEWAY_WALLET,
      },
    };

    const payload = {
      x402Version: 2,
      resource: {
        url: req.originalUrl,
        description: `Paid API Resource (${PRICE} USDC)`,
        mimeType: 'application/json',
      },
      accepts: [requirements],
    };

    const header = Buffer.from(JSON.stringify(payload)).toString('base64');

    res.status(402)
      .set('Content-Type', 'application/json')
      .set('PAYMENT-REQUIRED', header)
      .json({});
    return;
  }

  // ─── Case B: Payment signature present → settle via internal route ─
  try {
    // Forward to the backend's own /api/payments/settle endpoint internally
    const settleRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/payments/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer demo-api-key`,
      },
      body: JSON.stringify({
        paymentSignature,
        requirements: {
          scheme: 'exact',
          network: arc.NETWORK,
          asset: arc.USDC,
          amount: usdcToAtomic(PRICE),
          payTo: sellerAddress,
          maxTimeoutSeconds: 345600,
          extra: {
            name: 'GatewayWalletBatched',
            version: '1',
            verifyingContract: arc.GATEWAY_WALLET,
          },
        },
        endpoint: req.originalUrl,
        method: req.method,
      }),
    });

    const result = await settleRes.json() as any;

    if (!settleRes.ok || !result.success) {
      res.status(402).json({
        success: false,
        error: {
          code: result.error?.code ?? 'SETTLEMENT_FAILED',
          message: result.error?.message ?? 'Settlement failed',
        },
      });
      return;
    }

    // Settlement succeeded — return the protected resource
    const responseHeader = Buffer.from(JSON.stringify({
      success: true,
      transaction: result.data.transaction,
      network: arc.NETWORK,
      payer: result.data.payer,
    })).toString('base64');

    res.set('PAYMENT-RESPONSE', responseHeader).json({
      success: true,
      message: 'Payment verified! This is a protected resource on ArcFlow.',
      timestamp: new Date().toISOString(),
      data: {
        report: 'Confidential Market Analysis - Q3',
        insight: 'DePIN volume is projected to grow 400% on Arc Testnet.',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      success: false,
      error: {
        code: 'INTERNAL_SETTLEMENT_ERROR',
        message: msg,
      },
    });
  }
});
