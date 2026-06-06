// signer.ts — EIP-712 signing using clockSync.ts for timestamp correction
// Generates EIP-3009 TransferWithAuthorization signatures for the Arc Gateway.

import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toHex, getAddress, type Hex } from 'viem';
import { clockSync } from './clockSync.js';

// ─── ISO 20022 Memo generation (mirrors middleware/memo.ts) ────────────────

export interface ArcFlowMemo {
  af_ref: string;
  af_version: string;
  MsgId: string;
  EndToEndId: string;
  PurpsCd: 'APIC';
  Amt: string; // decimal USDC string
  Ccy: 'USDC';
  CdtTrfTxInf: {
    CdtrAcct: string;
    DbtrAcct: string;
  };
  service_endpoint: string;
  service_method: string;
  timestamp: string;
  network: 'arc';
  chain_id: number;
  clock_offset_ms: number;
}

export function generateAfRef(now?: Date): string {
  const d = now ?? new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  
  // Random hex characters using standard crypto (browser/node compatible)
  const bytes = new Uint8Array(3);
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 3; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `AF-${yyyy}${mm}${dd}-${hex}`;
}

function generateRandomHex(len: number): string {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, len).toUpperCase();
}

export function generateMemo(
  agentWallet: string,
  serviceWallet: string,
  atomicAmount: string,
  endpoint: string,
  method: string,
  clockOffsetMs: number,
  chainId: number,
  endToEndId?: string
): { memo: ArcFlowMemo; onchainMemo: Hex; fullRecordJson: string } {
  // Convert atomic to decimal USDC string (e.g. "50000" -> "0.05")
  const amtDecimal = (Number(atomicAmount) / 1_000_000).toFixed(6).replace(/\.?0+$/, '');
  
  const now = new Date();
  const afRef = generateAfRef(now);
  const msgId = `ARCFLOW-${Date.now().toString(36).toUpperCase()}-${generateRandomHex(4)}`;
  const e2eId = endToEndId ?? `E2E-${Date.now().toString(36).toUpperCase()}-${generateRandomHex(4)}`;

  const memo: ArcFlowMemo = {
    af_ref: afRef,
    af_version: '1.0',
    MsgId: msgId,
    EndToEndId: e2eId,
    PurpsCd: 'APIC',
    Amt: amtDecimal,
    Ccy: 'USDC',
    CdtTrfTxInf: {
      CdtrAcct: getAddress(serviceWallet),
      DbtrAcct: getAddress(agentWallet),
    },
    service_endpoint: endpoint,
    service_method: method.toUpperCase(),
    timestamp: now.toISOString(),
    network: 'arc',
    chain_id: chainId,
    clock_offset_ms: clockOffsetMs,
  };

  const fullRecordJson = JSON.stringify(memo);
  const onchainMemo = keccak256(toHex(fullRecordJson));

  return { memo, onchainMemo, fullRecordJson };
}

// ─── EIP-712 Types ────────────────────────────────────────────────────────

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

export interface SigningResult {
  x402Version: number;
  payload: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  };
  memo: ArcFlowMemo;
}

/**
 * Sign a TransferWithAuthorization EIP-712 payload.
 */
export async function signPaymentAuthorization(config: {
  privateKey: Hex;
  verifyingContract: `0x${string}`;
  payTo: `0x${string}`;
  atomicAmount: string;
  chainId: number;
  endpoint: string;
  method: string;
  endToEndId?: string;
}): Promise<SigningResult> {
  const { privateKey, verifyingContract, payTo, atomicAmount, chainId, endpoint, method, endToEndId } = config;
  const account = privateKeyToAccount(privateKey);

  // Measure or refresh clock offset
  const clockOffsetMs = clockSync.getOffsetMs();
  
  // Generate the ISO 20022 memo and use its hash as the EIP-3009 nonce
  const { memo, onchainMemo } = generateMemo(
    account.address,
    payTo,
    atomicAmount,
    endpoint,
    method,
    clockOffsetMs,
    chainId,
    endToEndId
  );

  const validAfterVal = clockSync.validAfter();
  const validBeforeVal = clockSync.validBefore();

  const domain = {
    name: 'GatewayWalletBatched',
    version: '1',
    chainId,
    verifyingContract: getAddress(verifyingContract),
  } as const;

  const message = {
    from: account.address,
    to: getAddress(verifyingContract),
    value: BigInt(atomicAmount),
    validAfter: validAfterVal,
    validBefore: validBeforeVal,
    nonce: onchainMemo,
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

  return {
    x402Version: 2,
    payload: {
      from: account.address,
      to: getAddress(verifyingContract),
      value: atomicAmount,
      validAfter: Number(validAfterVal),
      validBefore: Number(validBeforeVal),
      nonce: onchainMemo,
      v,
      r,
      s,
    },
    memo,
  };
}
