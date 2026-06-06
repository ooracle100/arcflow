// memo.ts — ISO 20022 aligned memo generation with ArcFlow fields
// Generates structured payment memos and 32-byte keccak256 onchain hashes.
// Every memo includes the clock offset at signing time for audit trail.

import { keccak256, toHex, type Hex } from 'viem';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * ISO 20022 aligned memo structure for ArcFlow payments.
 * Every confirmed payment produces one of these records.
 */
export interface ArcFlowMemo {
  af_ref: string;           // AF-YYYYMMDD-XXXXXX
  af_version: string;       // '1.0'
  MsgId: string;            // MessageIdentification (unique per message)
  EndToEndId: string;       // from x-e2e-id header or generated
  PurpsCd: 'APIC';          // Purpose: API Call
  Amt: string;              // USDC amount as string (never float)
  Ccy: 'USDC';
  CdtTrfTxInf: {
    CdtrAcct: string;       // seller wallet (creditor)
    DbtrAcct: string;       // agent wallet (debtor)
  };
  service_endpoint: string;
  service_method: string;
  timestamp: string;        // ISO 8601
  network: 'arc';
  chain_id: number;
  clock_offset_ms: number;  // clock sync offset at signing time
}

/**
 * Input parameters for generating a memo tag.
 */
export interface MemoInput {
  agentWallet: string;      // buyer/agent wallet address
  serviceWallet: string;    // seller wallet address
  amount: string;           // USDC amount as string
  endpoint: string;         // e.g. /api/weather
  method: string;           // GET, POST, etc.
  clockOffsetMs: number;    // current clock offset from ClockSync
  endToEndId?: string;      // optional: from x-e2e-id header
  chainId?: number;         // defaults to 5042002 (Arc testnet)
}

/**
 * Result of memo generation.
 */
export interface MemoResult {
  memo: ArcFlowMemo;        // the full structured memo
  onchainMemo: Hex;         // 66-char hex string (0x + 32 bytes)
  fullRecordJson: string;   // JSON serialization of the memo
}

// ─── Reference Generation ───────────────────────────────────────────────

/**
 * Generate an ArcFlow reference: AF-YYYYMMDD-XXXXXX
 * Format: AF-{date}-{6 random hex chars}
 */
export function generateAfRef(now?: Date): string {
  const d = now ?? new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hex = randomHex(6);
  return `AF-${yyyy}${mm}${dd}-${hex}`;
}

/**
 * Generate a MessageIdentification for ISO 20022 MsgId field.
 * Format: ARCFLOW-{timestamp}-{4 random hex}
 */
function generateMsgId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomHex(4);
  return `ARCFLOW-${ts}-${rand}`;
}

/**
 * Generate an EndToEndId if none was provided by the caller.
 * Format: E2E-{timestamp}-{4 random hex}
 */
function generateEndToEndId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomHex(4);
  return `E2E-${ts}-${rand}`;
}

/**
 * Generate N random hex characters using crypto.
 */
function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
    .toUpperCase();
}

// ─── Core Memo Generation ───────────────────────────────────────────────

/**
 * Generate a complete ArcFlow memo with ISO 20022 fields and keccak256 onchain hash.
 *
 * The onchainMemo is exactly 66 characters: "0x" + 64 hex digits (32 bytes).
 * It is the keccak256 hash of the full JSON-serialized memo record.
 *
 * @param input - Payment details for memo generation
 * @returns MemoResult with the full memo, onchain hash, and JSON serialization
 */
export function generateMemoTag(input: MemoInput): MemoResult {
  const {
    agentWallet,
    serviceWallet,
    amount,
    endpoint,
    method,
    clockOffsetMs,
    endToEndId,
    chainId = 5042002,
  } = input;

  const now = new Date();
  const afRef = generateAfRef(now);

  const memo: ArcFlowMemo = {
    af_ref: afRef,
    af_version: '1.0',
    MsgId: generateMsgId(),
    EndToEndId: endToEndId ?? generateEndToEndId(),
    PurpsCd: 'APIC',
    Amt: amount,
    Ccy: 'USDC',
    CdtTrfTxInf: {
      CdtrAcct: serviceWallet,
      DbtrAcct: agentWallet,
    },
    service_endpoint: endpoint,
    service_method: method.toUpperCase(),
    timestamp: now.toISOString(),
    network: 'arc',
    chain_id: chainId,
    clock_offset_ms: clockOffsetMs,
  };

  // Deterministic JSON serialization (keys in insertion order, which is stable in V8)
  const fullRecordJson = JSON.stringify(memo);

  // keccak256 hash of the full record — this goes onchain
  // Result is exactly 66 chars: "0x" + 64 hex digits
  const onchainMemo = keccak256(toHex(fullRecordJson));

  return {
    memo,
    onchainMemo,
    fullRecordJson,
  };
}

// ─── Validation Utilities ───────────────────────────────────────────────

/**
 * Validate that an af_ref matches the expected format: AF-YYYYMMDD-XXXXXX
 */
export function isValidAfRef(ref: string): boolean {
  return /^AF-\d{8}-[A-F0-9]{6}$/.test(ref);
}

/**
 * Validate that an onchain memo hash is exactly 66 characters (0x + 32 bytes hex).
 */
export function isValidOnchainMemo(hash: string): boolean {
  return /^0x[a-f0-9]{64}$/.test(hash);
}

/**
 * Verify that an onchain memo hash matches the keccak256 of a full record JSON.
 * Used during reconciliation to prove a payment record wasn't tampered with.
 */
export function verifyOnchainMemo(fullRecordJson: string, expectedHash: Hex): boolean {
  const computed = keccak256(toHex(fullRecordJson));
  return computed === expectedHash;
}
