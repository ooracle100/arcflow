// index.ts — Main entry point for ArcFlow seller middleware
// Exports withArcFlow() to paywall Express API endpoints in 3 lines.

import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { validateConfig, type ArcFlowMiddlewareConfig } from './config.js';
import { buildPaymentRequirements, buildPaymentRequiredHeader } from './handler402.js';
import { verifyPaymentSignature, type PaymentSignaturePayload } from './verifier.js';

// Re-export clockSync so package consumers can import it if needed
export { clockSync } from './clockSync.js';

/**
 * Express middleware wrapper to protect endpoints with ArcFlow nanopayments.
 *
 * Usage:
 * ```typescript
 * app.get('/api/weather', withArcFlow((req, res) => {
 *   res.json({ weather: 'sunny' });
 * }, {
 *   price: '0.05',
 *   wallet: '0x2420F3440508DFAb40369F8da3EE20eBfcCdB707',
 *   apiKey: 'af_test_123'
 * }));
 * ```
 *
 * @param handler - The original Express RequestHandler
 * @param config - Middleware options containing price, wallet, and apiKey
 * @returns A protected Express RequestHandler
 */
export function withArcFlow(
  handler: RequestHandler,
  config: ArcFlowMiddlewareConfig
): RequestHandler {
  // Validate configuration early (at startup time, not request time)
  validateConfig(config);

  const { price, wallet, apiKey, backendUrl = 'http://localhost:3000', description, chainId = 5042002 } = config;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentSignature = req.headers['payment-signature'] as string;
      const endpoint = req.originalUrl;
      const method = req.method;

      // 1. Build payment parameters
      const sellerAddress = wallet as `0x${string}`;
      const requirements = buildPaymentRequirements(price, sellerAddress, chainId);

      // ─── Case A: No Payment Signature Present (First Request) ─────────
      if (!paymentSignature) {
        const challengeHeader = buildPaymentRequiredHeader(
          endpoint,
          price,
          requirements,
          description
        );

        res.status(402)
          .set('Content-Type', 'application/json')
          .set('PAYMENT-REQUIRED', challengeHeader)
          .json({});
        return;
      }

      // ─── Case B: Payment Signature Present (Negotiation / Settle) ──────
      let signaturePayload: PaymentSignaturePayload;
      let parsed: any;
      try {
        const json = Buffer.from(paymentSignature, 'base64').toString('utf-8');
        parsed = JSON.parse(json);
        signaturePayload = parsed.payload;

        if (!signaturePayload) {
          throw new Error('Missing payload property in signature header');
        }
      } catch (err) {
        res.status(402).json({
          success: false,
          error: {
            code: 'INVALID_HEADER_FORMAT',
            message: 'payment-signature header is not valid base64-encoded JSON',
          },
        });
        return;
      }

      // 1. Cryptographic EIP-712 verification (local signature recovery)
      const expectedRequirements = {
        amount: requirements.amount,
        payTo: sellerAddress,
        gatewayWallet: requirements.extra.verifyingContract,
        chainId,
      };

      const cryptoVerify = await verifyPaymentSignature(signaturePayload, expectedRequirements);

      if (!cryptoVerify.isValid) {
        res.status(402).json({
          success: false,
          error: {
            code: 'PAYMENT_VERIFICATION_FAILED',
            message: cryptoVerify.errorReason ?? 'Cryptographic verification failed',
          },
        });
        return;
      }

      // 2. Offload settlement, double-spending check, and logging to SaaS backend
      try {
        // Send the signature to the ArcFlow SaaS backend
        const backendRes = await fetch(`${backendUrl}/api/payments/settle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            paymentSignature,
            requirements,
            endpoint,
            method,
            memo: parsed.memo,
          }),
        });

        const backendResult = await backendRes.json() as any;

        if (!backendRes.ok || !backendResult.success) {
          res.status(402).json({
            success: false,
            error: {
              code: backendResult.error?.code ?? 'SETTLEMENT_FAILED',
              message: backendResult.error?.message ?? 'SaaS backend failed to settle payment',
              details: backendResult.error?.details,
            },
          });
          return;
        }

        // Settlement succeeded! Set PAYMENT-RESPONSE headers
        const { transaction, payer, network } = backendResult.data;
        const responsePayload = {
          success: true,
          transaction,
          network: network ?? requirements.network,
          payer,
        };

        const responseHeader = Buffer.from(JSON.stringify(responsePayload)).toString('base64');
        res.set('PAYMENT-RESPONSE', responseHeader);

        // Call the original developer handler
        handler(req, res, next);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(502).json({
          success: false,
          error: {
            code: 'BACKEND_COMMUNICATION_ERROR',
            message: 'Unable to reach the ArcFlow SaaS backend for settlement',
            details: { error: msg },
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_MIDDLEWARE_ERROR',
          message: 'An unexpected error occurred in ArcFlow middleware',
          details: { error: msg },
        },
      });
    }
  };
}
