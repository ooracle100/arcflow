// verifier.ts — Arc Gateway payment verification logic
// Uses viem to cryptographically verify EIP-712 TransferWithAuthorization signatures.
// Applies clockSync network-adjusted time checks to eliminate clock drift errors.

import { recoverTypedDataAddress, type Hex } from 'viem';
import { clockSync } from './clockSync.js';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Standard EIP-3009 TransferWithAuthorization signature components.
 * This is the signature format sent by the buyer's SDK.
 */
export interface PaymentSignaturePayload {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;         // Atomic units as string (e.g. "50000" for $0.05)
  validAfter: number;    // Unix timestamp
  validBefore: number;   // Unix timestamp
  nonce: Hex;            // 32-byte on-chain memo hash
  v: number;
  r: Hex;
  s: Hex;
}

export interface PaymentSignatureHeader {
  x402Version: number;
  payload: PaymentSignaturePayload;
}

export interface VerificationRequirement {
  amount: string;        // Expected atomic amount (e.g. "50000")
  payTo: `0x${string}`;  // Expected seller receiver address
  gatewayWallet: `0x${string}`; // Circle Gateway contract address
  chainId: number;       // e.g. 5042002 for Arc testnet
}

export interface VerificationResult {
  isValid: boolean;
  payer?: `0x${string}`;
  errorReason?: string;
}

// ─── EIP-712 Configuration ──────────────────────────────────────────────

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

// ─── Reconstruct Hex Signature ──────────────────────────────────────────

/**
 * Reconstruct a 65-byte hex signature from v, r, s components.
 * Safely normalizes v values (adds 27 if less than 27).
 */
export function reconstructHexSignature(v: number, r: Hex, s: Hex): Hex {
  let normalizedV = v;
  if (normalizedV < 27) {
    normalizedV += 27;
  }
  const vHex = normalizedV.toString(16).padStart(2, '0');
  const rHex = r.startsWith('0x') ? r.slice(2) : r;
  const sHex = s.startsWith('0x') ? s.slice(2) : s;

  if (rHex.length !== 64 || sHex.length !== 64) {
    throw new Error('r and s signature components must be exactly 32 bytes hex');
  }

  return `0x${rHex}${sHex}${vHex}` as Hex;
}

// ─── Verification Logic ──────────────────────────────────────────────────

/**
 * Cryptographically verifies an EIP-712 TransferWithAuthorization signature.
 * Combines signature recovery with timing and configuration checks.
 *
 * @param payload - The parsed payment payload from the headers
 * @param requirement - The payment parameters expected by the seller
 * @returns VerificationResult containing success state and recovered payer or failure reason
 */
export async function verifyPaymentSignature(
  payload: PaymentSignaturePayload,
  requirement: VerificationRequirement
): Promise<VerificationResult> {
  try {
    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = payload;
    const { amount, payTo, gatewayWallet, chainId } = requirement;

    // 1. Basic structure checks
    if (!from || !to || !value || !nonce || v === undefined || !r || !s) {
      return { isValid: false, errorReason: 'Missing required signature payload fields' };
    }

    // 2. Value matches the requirement
    if (value !== amount) {
      return {
        isValid: false,
        errorReason: `Amount mismatch: expected atomic amount "${amount}", got "${value}"`,
      };
    }

    // 3. verifyingContract / Gateway Wallet matches the requirement
    if (to.toLowerCase() !== gatewayWallet.toLowerCase()) {
      return {
        isValid: false,
        errorReason: `Target Gateway mismatch: expected "${gatewayWallet}", got "${to}"`,
      };
    }

    // 4. Timing checks utilizing network-adjusted time
    const networkAdjustedTime = clockSync.nowSeconds();

    if (networkAdjustedTime < validAfter) {
      return {
        isValid: false,
        errorReason: `Signature timing error: validAfter is in the future (${validAfter} > ${networkAdjustedTime})`,
      };
    }

    if (networkAdjustedTime > validBefore) {
      return {
        isValid: false,
        errorReason: `Signature timing error: validBefore has expired (${validBefore} < ${networkAdjustedTime})`,
      };
    }

    // 5. Cryptographic signature verification
    const signature = reconstructHexSignature(v, r, s);

    const domain = {
      name: 'GatewayWalletBatched',
      version: '1',
      chainId,
      verifyingContract: gatewayWallet,
    } as const;

    const message = {
      from,
      to,
      value: BigInt(value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    };

    // Recover the signer address using viem EIP-712 helper
    const recoveredAddress = await recoverTypedDataAddress({
      domain,
      types: EIP712_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
      signature,
    });

    if (recoveredAddress.toLowerCase() !== from.toLowerCase()) {
      return {
        isValid: false,
        errorReason: `Cryptographic signature recovery mismatch: expected signer "${from}", recovered "${recoveredAddress}"`,
      };
    }

    return {
      isValid: true,
      payer: recoveredAddress,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      errorReason: `Cryptographic verification failed: ${message}`,
    };
  }
}
