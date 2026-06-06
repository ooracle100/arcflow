// memo.test.ts — Unit tests for ISO 20022 memo generation
// Session 2 DONE criteria:
//   ✓ generateMemoTag() produces a valid memo with all ISO 20022 fields populated
//   ✓ onchainMemo is exactly 66 characters (0x + 32 bytes hex)
//   ✓ Clock offset is included in every memo record

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMemoTag,
  generateAfRef,
  isValidAfRef,
  isValidOnchainMemo,
  verifyOnchainMemo,
  type MemoInput,
  type ArcFlowMemo,
} from '../memo.js';

// ─── Test Fixtures ──────────────────────────────────────────────────────

const SAMPLE_INPUT: MemoInput = {
  agentWallet: '0xA7992b9495154DDBd78D0057964b28F715A3C76B',
  serviceWallet: '0x1234567890abcdef1234567890abcdef12345678',
  amount: '0.05',
  endpoint: '/api/weather',
  method: 'GET',
  clockOffsetMs: -1055,
};

const SAMPLE_INPUT_WITH_E2E: MemoInput = {
  ...SAMPLE_INPUT,
  endToEndId: 'E2E-CUSTOM-001',
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe('generateAfRef', () => {
  it('produces AF-YYYYMMDD-XXXXXX format', () => {
    const ref = generateAfRef();
    assert.ok(isValidAfRef(ref), `AF ref "${ref}" should match AF-YYYYMMDD-XXXXXX`);
  });

  it('uses the provided date', () => {
    const date = new Date('2026-05-20T12:00:00Z');
    const ref = generateAfRef(date);
    assert.ok(ref.startsWith('AF-20260520-'), `Expected AF-20260520-..., got: ${ref}`);
  });

  it('generates unique refs on each call', () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateAfRef()));
    assert.equal(refs.size, 100, 'All 100 refs should be unique');
  });
});

describe('generateMemoTag', () => {
  it('produces a memo with all ISO 20022 fields populated', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    const memo = result.memo;

    // Verify every field from the ArcFlowMemo interface is present and populated
    assert.ok(isValidAfRef(memo.af_ref), `af_ref should be valid: ${memo.af_ref}`);
    assert.equal(memo.af_version, '1.0');
    assert.ok(memo.MsgId.startsWith('ARCFLOW-'), `MsgId should start with ARCFLOW-: ${memo.MsgId}`);
    assert.ok(memo.EndToEndId.length > 0, 'EndToEndId should not be empty');
    assert.equal(memo.PurpsCd, 'APIC');
    assert.equal(memo.Amt, '0.05');
    assert.equal(memo.Ccy, 'USDC');
    assert.equal(memo.CdtTrfTxInf.CdtrAcct, SAMPLE_INPUT.serviceWallet);
    assert.equal(memo.CdtTrfTxInf.DbtrAcct, SAMPLE_INPUT.agentWallet);
    assert.equal(memo.service_endpoint, '/api/weather');
    assert.equal(memo.service_method, 'GET');
    assert.ok(memo.timestamp.length > 0, 'timestamp should not be empty');
    assert.equal(memo.network, 'arc');
    assert.equal(memo.chain_id, 5042002);
    assert.equal(memo.clock_offset_ms, -1055);
  });

  it('onchainMemo is exactly 66 characters (0x + 32 bytes hex)', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    assert.equal(result.onchainMemo.length, 66, `Expected 66 chars, got ${result.onchainMemo.length}`);
    assert.ok(result.onchainMemo.startsWith('0x'), 'Should start with 0x');
    assert.ok(isValidOnchainMemo(result.onchainMemo), 'Should match 0x + 64 hex chars pattern');
  });

  it('clock offset is included in every memo record', () => {
    // Test with negative offset
    const r1 = generateMemoTag({ ...SAMPLE_INPUT, clockOffsetMs: -1055 });
    assert.equal(r1.memo.clock_offset_ms, -1055);

    // Test with zero offset
    const r2 = generateMemoTag({ ...SAMPLE_INPUT, clockOffsetMs: 0 });
    assert.equal(r2.memo.clock_offset_ms, 0);

    // Test with positive offset
    const r3 = generateMemoTag({ ...SAMPLE_INPUT, clockOffsetMs: 500 });
    assert.equal(r3.memo.clock_offset_ms, 500);

    // Verify clock_offset_ms appears in the JSON serialization
    assert.ok(r1.fullRecordJson.includes('"clock_offset_ms":-1055'));
  });

  it('uses provided endToEndId when supplied', () => {
    const result = generateMemoTag(SAMPLE_INPUT_WITH_E2E);
    assert.equal(result.memo.EndToEndId, 'E2E-CUSTOM-001');
  });

  it('generates endToEndId when not supplied', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    assert.ok(result.memo.EndToEndId.startsWith('E2E-'), `Should auto-generate E2E-...: ${result.memo.EndToEndId}`);
  });

  it('method is uppercased', () => {
    const result = generateMemoTag({ ...SAMPLE_INPUT, method: 'post' });
    assert.equal(result.memo.service_method, 'POST');
  });

  it('defaults chain_id to 5042002 (Arc testnet)', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    assert.equal(result.memo.chain_id, 5042002);
  });

  it('accepts custom chain_id', () => {
    const result = generateMemoTag({ ...SAMPLE_INPUT, chainId: 9999 });
    assert.equal(result.memo.chain_id, 9999);
  });

  it('fullRecordJson is valid JSON that deserializes back to memo', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    const parsed = JSON.parse(result.fullRecordJson) as ArcFlowMemo;
    assert.equal(parsed.af_ref, result.memo.af_ref);
    assert.equal(parsed.Amt, result.memo.Amt);
    assert.equal(parsed.clock_offset_ms, result.memo.clock_offset_ms);
    assert.equal(parsed.CdtTrfTxInf.CdtrAcct, result.memo.CdtTrfTxInf.CdtrAcct);
  });

  it('amount is stored as string, not number', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    assert.equal(typeof result.memo.Amt, 'string');
    // Verify it's not silently converted in JSON
    const parsed = JSON.parse(result.fullRecordJson);
    assert.equal(typeof parsed.Amt, 'string');
  });

  it('each call produces a unique af_ref and onchainMemo', () => {
    const results = Array.from({ length: 50 }, () => generateMemoTag(SAMPLE_INPUT));
    const refs = new Set(results.map((r) => r.memo.af_ref));
    const hashes = new Set(results.map((r) => r.onchainMemo));
    assert.equal(refs.size, 50, 'All 50 af_refs should be unique');
    assert.equal(hashes.size, 50, 'All 50 onchain hashes should be unique');
  });
});

describe('verifyOnchainMemo', () => {
  it('returns true for matching hash and JSON', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    assert.ok(verifyOnchainMemo(result.fullRecordJson, result.onchainMemo));
  });

  it('returns false for tampered JSON', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    const tampered = result.fullRecordJson.replace('"0.05"', '"0.10"');
    assert.equal(verifyOnchainMemo(tampered, result.onchainMemo), false);
  });

  it('returns false for wrong hash', () => {
    const result = generateMemoTag(SAMPLE_INPUT);
    const wrongHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    assert.equal(verifyOnchainMemo(result.fullRecordJson, wrongHash as `0x${string}`), false);
  });
});

describe('isValidAfRef', () => {
  it('accepts valid refs', () => {
    assert.ok(isValidAfRef('AF-20260520-A1B2C3'));
    assert.ok(isValidAfRef('AF-20261231-FFFFFF'));
  });

  it('rejects invalid refs', () => {
    assert.equal(isValidAfRef(''), false);
    assert.equal(isValidAfRef('AF-2026052-A1B2C3'), false);  // date too short
    assert.equal(isValidAfRef('AF-20260520-A1B2C'), false);   // hex too short
    assert.equal(isValidAfRef('XX-20260520-A1B2C3'), false);  // wrong prefix
    assert.equal(isValidAfRef('AF-20260520-a1b2c3'), false);  // lowercase hex
  });
});

describe('isValidOnchainMemo', () => {
  it('accepts valid 66-char hex', () => {
    assert.ok(isValidOnchainMemo('0x' + 'a'.repeat(64)));
    assert.ok(isValidOnchainMemo('0x' + '0123456789abcdef'.repeat(4)));
  });

  it('rejects invalid hashes', () => {
    assert.equal(isValidOnchainMemo(''), false);
    assert.equal(isValidOnchainMemo('0x' + 'a'.repeat(63)), false);   // too short
    assert.equal(isValidOnchainMemo('0x' + 'a'.repeat(65)), false);   // too long
    assert.equal(isValidOnchainMemo('0x' + 'G'.repeat(64)), false);   // invalid hex char
    assert.equal(isValidOnchainMemo('a'.repeat(64)), false);           // no 0x prefix
  });
});

describe('ClockSync integration contract', () => {
  it('memo records any clock offset value including edge cases', () => {
    // Large negative offset (network far behind)
    const r1 = generateMemoTag({ ...SAMPLE_INPUT, clockOffsetMs: -30000 });
    assert.equal(r1.memo.clock_offset_ms, -30000);

    // Large positive offset (network far ahead)
    const r2 = generateMemoTag({ ...SAMPLE_INPUT, clockOffsetMs: 30000 });
    assert.equal(r2.memo.clock_offset_ms, 30000);

    // Both produce valid onchain hashes
    assert.ok(isValidOnchainMemo(r1.onchainMemo));
    assert.ok(isValidOnchainMemo(r2.onchainMemo));

    // Both are verifiable
    assert.ok(verifyOnchainMemo(r1.fullRecordJson, r1.onchainMemo));
    assert.ok(verifyOnchainMemo(r2.fullRecordJson, r2.onchainMemo));
  });
});
