// client.test.ts — Unit tests for the ArcFlow Client SDK
// Verifies EIP-712 signing, 402 interception, and receipt logging.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ArcFlowClient } from '../index.js';
import { signPaymentAuthorization, generateMemo } from '../signer.js';
import { clockSync } from '../clockSync.js';
import { receiptStore } from '../receipt.js';
import { type Hex } from 'viem';

// ─── Test Fixtures ──────────────────────────────────────────────────────

const MOCK_PRIVATE_KEY = '0x99e22e4834552236fca77ddd32eb6a30dcc9d36cc32adbc934ebf81086bda34e' as Hex; // pre-generated buyer wallet
const MOCK_SELLER_WALLET = '0x2420F3440508DFAb40369F8da3EE20eBfcCdB707' as Hex;
const MOCK_GATEWAY_WALLET = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as Hex;

// ─── Tests ──────────────────────────────────────────────────────────────

describe('ArcFlowClient Initialization', () => {
  it('throws on missing private key', () => {
    assert.throws(() => {
      new ArcFlowClient({} as any);
    }, /Missing privateKey in configuration/);
  });

  it('correctly initializes with private key', () => {
    const client = new ArcFlowClient({ privateKey: MOCK_PRIVATE_KEY });
    assert.equal(client.gateway.address, '0xA7992b9495154DDBd78D0057964b28F715A3C76B');
  });
});

describe('EIP-712 Signing and Clock Sync Correction', () => {
  it('signs TransferWithAuthorization using EIP-712 format', async () => {
    // Set a known clock offset
    clockSync.sync = async () => {}; // bypass RPC sync
    // Set a mock offset of -1000ms
    (clockSync as any).offsetMs = -1000;
    (clockSync as any).initialized = true;

    const signingResult = await signPaymentAuthorization({
      privateKey: MOCK_PRIVATE_KEY,
      verifyingContract: MOCK_GATEWAY_WALLET,
      payTo: MOCK_SELLER_WALLET,
      atomicAmount: '50000', // $0.05
      chainId: 5042002,
      endpoint: '/api/weather',
      method: 'GET',
    });

    assert.equal(signingResult.x402Version, 2);
    assert.equal(signingResult.payload.from, '0xA7992b9495154DDBd78D0057964b28F715A3C76B');
    assert.equal(signingResult.payload.to, MOCK_GATEWAY_WALLET);
    assert.equal(signingResult.payload.value, '50000');
    assert.ok(signingResult.payload.validAfter < signingResult.payload.validBefore);
    assert.ok(signingResult.payload.nonce.startsWith('0x'));
    assert.ok(signingResult.payload.r.startsWith('0x'));
    assert.ok(signingResult.payload.s.startsWith('0x'));
    assert.ok(typeof signingResult.payload.v === 'number');

    // Confirm that the memo contains our custom clock offset
    assert.equal(signingResult.memo.clock_offset_ms, -1000);
    assert.equal(signingResult.memo.Amt, '0.05');
    assert.equal(signingResult.memo.CdtTrfTxInf.CdtrAcct, MOCK_SELLER_WALLET);
    assert.equal(signingResult.memo.CdtTrfTxInf.DbtrAcct, '0xA7992b9495154DDBd78D0057964b28F715A3C76B');
  });
});

describe('ArcFlowClient 402 Negotiation and Retry', () => {
  it('automatically intercepts a 402, signs payment, and retries successfully', async () => {
    const client = new ArcFlowClient({ privateKey: MOCK_PRIVATE_KEY });
    
    // Mock the global fetch
    const originalFetch = global.fetch;
    let fetchCallsCount = 0;
    const fetchCallsArgs: any[] = [];

    const mockPaymentRequiredHeader = Buffer.from(JSON.stringify({
      x402Version: 2,
      resource: {
        url: '/api/weather',
        description: 'Paid API Resource',
        mimeType: 'application/json',
      },
      accepts: [{
        scheme: 'exact',
        network: 'eip155:5042002',
        asset: '0x3600000000000000000000000000000000000000',
        amount: '50000',
        payTo: MOCK_SELLER_WALLET,
        maxTimeoutSeconds: 345600,
        extra: {
          name: 'GatewayWalletBatched',
          version: '1',
          verifyingContract: MOCK_GATEWAY_WALLET,
        },
      }],
    })).toString('base64');

    const mockPaymentResponseHeader = Buffer.from(JSON.stringify({
      success: true,
      transaction: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      network: 'eip155:5042002',
      payer: '0xA7992b9495154DDBd78D0057964b28F715A3C76B',
    })).toString('base64');

    global.fetch = async (url: any, options: any) => {
      fetchCallsCount++;
      fetchCallsArgs.push([url, options]);

      if (fetchCallsCount === 1) {
        // Return 402 Payment Required on first request
        return {
          status: 402,
          ok: false,
          headers: {
            get: (key: string) => {
              if (key.toLowerCase() === 'payment-required') {
                return mockPaymentRequiredHeader;
              }
              return null;
            },
          },
        } as any;
      } else {
        // Return 200 OK on retried request
        return {
          status: 200,
          ok: true,
          headers: {
            get: (key: string) => {
              if (key.toLowerCase() === 'payment-response') {
                return mockPaymentResponseHeader;
              }
              return null;
            },
          },
          json: async () => ({ weather: 'sunny' }),
        } as any;
      }
    };

    try {
      receiptStore.clearReceipts();
      const result = await client.fetchWithReceipt('http://localhost:3000/api/weather', {
        endToEndId: 'MY-CUSTOM-E2E-ID',
      });

      // 1. Verify two fetch calls were made
      assert.equal(fetchCallsCount, 2);
      
      // 2. Verify second call included PAYMENT-SIGNATURE
      const retryOptions = fetchCallsArgs[1][1];
      assert.ok(retryOptions.headers['payment-signature']);
      assert.equal(retryOptions.headers['x-e2e-id'], 'MY-CUSTOM-E2E-ID');

      // Decode PAYMENT-SIGNATURE and verify EIP-712 structure
      const signatureJson = Buffer.from(retryOptions.headers['payment-signature'], 'base64').toString('utf-8');
      const signaturePayload = JSON.parse(signatureJson);
      assert.equal(signaturePayload.x402Version, 2);
      assert.equal(signaturePayload.payload.from, '0xA7992b9495154DDBd78D0057964b28F715A3C76B');
      assert.equal(signaturePayload.payload.to, MOCK_GATEWAY_WALLET);
      assert.equal(signaturePayload.payload.value, '50000');

      // 3. Verify receipt was successfully logged
      assert.equal(result.paid, true);
      assert.equal(result.paymentDetails?.amount, '0.05');
      assert.equal(result.paymentDetails?.txHash, '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      assert.equal(result.paymentDetails?.memo.EndToEndId, 'MY-CUSTOM-E2E-ID');
      
      const loggedReceipts = client.getReceipts();
      assert.equal(loggedReceipts.length, 1);
      assert.equal(loggedReceipts[0].amount, '0.05');
      assert.equal(loggedReceipts[0].e2eId, 'MY-CUSTOM-E2E-ID');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
