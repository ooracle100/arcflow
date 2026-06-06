// middleware.test.ts — Unit tests for the withArcFlow Express middleware wrapper
// Session 3 DONE criteria:
//   ✓ Unauthenticated GET returns HTTP 402 with valid challenge JSON
//   ✓ Challenge JSON includes: USDC amount, Arc wallet address, EIP-712 parameters
//   ✓ Payment header present + verified -> request proceeds to handler
//   ✓ Payment header present + invalid -> clear 402 rejection with reason
//   ✓ No Docker, no Supabase, no local database required

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withArcFlow } from '../index.js';
import { type Request, type Response } from 'express';
import { type Hex } from 'viem';

// ─── Test Fixtures ──────────────────────────────────────────────────────

const MOCK_CONFIG = {
  price: '0.05',
  wallet: '0x2420F3440508DFAb40369F8da3EE20eBfcCdB707',
  apiKey: 'af_test_123',
  backendUrl: 'http://localhost:3000',
};

// ─── Helper to construct mocks ──────────────────────────────────────────

interface MockResponse extends Response {
  statusCode?: number;
  headers: Record<string, string>;
  jsonBody?: any;
}

function createMockRes(): MockResponse {
  const res: Partial<MockResponse> = {
    headers: {},
  };
  res.status = function(this: MockResponse, code: number) {
    this.statusCode = code;
    return this;
  };
  res.set = function(this: MockResponse, key: string | Record<string, string>, val?: any) {
    if (typeof key === 'string') {
      this.headers[key.toLowerCase()] = String(val);
    } else {
      for (const [k, v] of Object.entries(key)) {
        this.headers[k.toLowerCase()] = String(v);
      }
    }
    return this;
  };
  res.json = function(this: MockResponse, body: any) {
    this.jsonBody = body;
    return this;
  };
  return res as MockResponse;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('withArcFlow Config Validation', () => {
  it('throws immediately on missing config object', () => {
    assert.throws(() => {
      withArcFlow((() => {}) as any, null as any);
    }, /Configuration object is missing/);
  });

  it('throws on invalid price type', () => {
    assert.throws(() => {
      withArcFlow((() => {}) as any, { ...MOCK_CONFIG, price: 0.05 as any });
    }, /price must be a string/);
  });

  it('throws on invalid price values', () => {
    assert.throws(() => {
      withArcFlow((() => {}) as any, { ...MOCK_CONFIG, price: '-0.05' });
    }, /invalid price value/);
    assert.throws(() => {
      withArcFlow((() => {}) as any, { ...MOCK_CONFIG, price: 'abc' });
    }, /invalid price value/);
  });

  it('throws on invalid wallet hex format', () => {
    assert.throws(() => {
      withArcFlow((() => {}) as any, { ...MOCK_CONFIG, wallet: '0x123' });
    }, /invalid wallet address/);
    assert.throws(() => {
      withArcFlow((() => {}) as any, { ...MOCK_CONFIG, wallet: 'not-hex' });
    }, /invalid wallet address/);
  });

  it('throws on missing API key', () => {
    assert.throws(() => {
      withArcFlow((() => {}) as any, { ...MOCK_CONFIG, apiKey: '' });
    }, /apiKey is missing/);
  });
});

describe('withArcFlow Unauthenticated Request (First Request)', () => {
  it('returns HTTP 402 with correct headers and empty JSON body', async () => {
    const req = {
      headers: {},
      originalUrl: '/api/weather',
      method: 'GET',
    } as unknown as Request;

    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = withArcFlow((() => {}) as any, MOCK_CONFIG);
    await middleware(req, res, next);

    // 1. Verify HTTP 402
    assert.equal(res.statusCode, 402);
    assert.equal(nextCalled, false, 'Should not proceed to next handler');

    // 2. Verify Headers
    assert.equal(res.headers['content-type'], 'application/json');
    assert.ok(res.headers['payment-required'], 'PAYMENT-REQUIRED header must be present');

    // 3. Decode PAYMENT-REQUIRED payload and verify parameters
    const base64 = res.headers['payment-required'];
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const challenge = JSON.parse(json);

    assert.equal(challenge.x402Version, 2);
    assert.equal(challenge.resource.url, '/api/weather');
    assert.equal(challenge.resource.mimeType, 'application/json');
    
    // Requirements checks
    const reqs = challenge.accepts[0];
    assert.equal(reqs.scheme, 'exact');
    assert.equal(reqs.network, 'eip155:5042002');
    assert.equal(reqs.asset, '0x3600000000000000000000000000000000000000');
    assert.equal(reqs.amount, '50000'); // 0.05 USDC * 10^6
    assert.equal(reqs.payTo, MOCK_CONFIG.wallet);
    assert.equal(reqs.extra.name, 'GatewayWalletBatched');
    assert.equal(reqs.extra.verifyingContract, '0x0077777d7EBA4688BDeF3E311b846F25870A19B9');
  });
});

describe('withArcFlow Authenticated Request with Invalid Headers', () => {
  it('returns HTTP 402 with structured parse error on invalid Base64 signature', async () => {
    const req = {
      headers: {
        'payment-signature': 'not-base64-json!!!',
      },
      originalUrl: '/api/weather',
      method: 'GET',
    } as unknown as Request;

    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = withArcFlow((() => {}) as any, MOCK_CONFIG);
    await middleware(req, res, next);

    assert.equal(res.statusCode, 402);
    assert.equal(nextCalled, false);
    assert.equal(res.jsonBody.success, false);
    assert.equal(res.jsonBody.error.code, 'INVALID_HEADER_FORMAT');
  });

  it('returns HTTP 402 on failed cryptographic signature verification', async () => {
    // Construct a cryptographically invalid payload (e.g. wrong amount)
    const badPayload = {
      x402Version: 2,
      payload: {
        from: '0xA7992b9495154DDBd78D0057964b28F715A3C76B' as `0x${string}`,
        to: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
        value: '10000', // expected 50000 ($0.05)
        validAfter: 1000,
        validBefore: 9999999999,
        nonce: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        v: 27,
        r: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        s: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      },
    };

    const paymentSignature = Buffer.from(JSON.stringify(badPayload)).toString('base64');

    const req = {
      headers: {
        'payment-signature': paymentSignature,
      },
      originalUrl: '/api/weather',
      method: 'GET',
    } as unknown as Request;

    const res = createMockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = withArcFlow((() => {}) as any, MOCK_CONFIG);
    await middleware(req, res, next);

    assert.equal(res.statusCode, 402);
    assert.equal(nextCalled, false);
    assert.equal(res.jsonBody.success, false);
    assert.equal(res.jsonBody.error.code, 'PAYMENT_VERIFICATION_FAILED');
    assert.ok(res.jsonBody.error.message.includes('Amount mismatch'));
  });
});

describe('withArcFlow Authenticated Request with Cryptographically Valid Signature', () => {
  it('verifies signature, posts to backend, and proceeds to handler on backend success', async () => {
    const { privateKeyToAccount } = await import('viem/accounts');
    
    // Ephemeral buyer account (Same as Stage 1 validation)
    const buyerPrivateKey = '0x99e22e4834552236fca77ddd32eb6a30dcc9d36cc32adbc934ebf81086bda34e';
    const account = privateKeyToAccount(buyerPrivateKey);

    const domain = {
      name: 'GatewayWalletBatched',
      version: '1',
      chainId: 5042002,
      verifyingContract: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
    } as const;

    const EIP712_TYPES = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    } as const;

    const message = {
      from: account.address,
      to: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
      value: 50000n, // $0.05
      validAfter: 1000n,
      validBefore: 9999999999n,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    };

    const signature = await account.signTypedData({
      domain,
      types: EIP712_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
    });

    const r = signature.slice(0, 66) as Hex;
    const s = `0x${signature.slice(66, 130)}` as Hex;
    const v = parseInt(signature.slice(130, 132), 16);

    const validPayload = {
      x402Version: 2,
      payload: {
        from: account.address,
        to: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
        value: '50000',
        validAfter: 1000,
        validBefore: 9999999999,
        nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
        v,
        r,
        s,
      },
    };

    const paymentSignature = Buffer.from(JSON.stringify(validPayload)).toString('base64');

    const req = {
      headers: {
        'payment-signature': paymentSignature,
      },
      originalUrl: '/api/weather',
      method: 'GET',
    } as unknown as Request;

    const res = createMockRes();
    let handlerCalled = false;
    const testHandler = (req: any, res: any) => {
      handlerCalled = true;
    };

    // Mock global.fetch to simulate SaaS backend settlement success
    const originalFetch = global.fetch;
    let fetchCalled = false;
    let fetchArgs: any[] = [];

    global.fetch = async (url: any, options: any) => {
      fetchCalled = true;
      fetchArgs = [url, options];
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            af_ref: 'AF-20260524-ABCDEF',
            transaction: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            payer: account.address,
            onchain_memo: '0x0000000000000000000000000000000000000000000000000000000000000001',
          },
        }),
      } as any;
    };

    try {
      const middleware = withArcFlow(testHandler, MOCK_CONFIG);
      await middleware(req, res, () => {});

      // 1. Verify backend fetch was called correctly
      assert.equal(fetchCalled, true);
      assert.equal(fetchArgs[0], 'http://localhost:3000/api/payments/settle');
      assert.equal(fetchArgs[1].method, 'POST');
      assert.equal(fetchArgs[1].headers['Authorization'], `Bearer ${MOCK_CONFIG.apiKey}`);

      // 2. Verify original handler was invoked
      assert.equal(handlerCalled, true, 'Original handler should be called on successful settlement');

      // 3. Verify PAYMENT-RESPONSE headers were appended
      assert.ok(res.headers['payment-response'], 'PAYMENT-RESPONSE header should be set');
      const responsePayloadJson = Buffer.from(res.headers['payment-response'], 'base64').toString('utf-8');
      const responsePayload = JSON.parse(responsePayloadJson);
      assert.equal(responsePayload.success, true);
      assert.equal(responsePayload.transaction, '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      assert.equal(responsePayload.payer, account.address);
    } finally {
      // Clean up the global fetch mock
      global.fetch = originalFetch;
    }
  });
});
