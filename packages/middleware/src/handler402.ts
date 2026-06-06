// handler402.ts — Challenge-response logic for x402 nanopayments
// Formats payment requirements and constructs Base64-encoded PAYMENT-REQUIRED headers.

import { type Hex } from 'viem';

// ─── Constants ──────────────────────────────────────────────────────────

const ARC_TESTNET_USDC = '0x3600000000000000000000000000000000000000';
const ARC_TESTNET_GATEWAY = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ChallengeRequirements {
  scheme: 'exact';
  network: string;       // e.g. "eip155:5042002"
  asset: `0x${string}`;  // USDC address
  amount: string;        // Atomic units (string)
  payTo: `0x${string}`;  // Seller receiver wallet
  maxTimeoutSeconds: number;
  extra: {
    name: 'GatewayWalletBatched';
    version: '1';
    verifyingContract: `0x${string}`; // Gateway Wallet
  };
}

export interface PaymentRequiredPayload {
  x402Version: number;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: ChallengeRequirements[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Parses decimal USDC string to atomic units (6 decimals).
 * e.g., "0.05" -> "50000"
 */
export function usdcToAtomic(price: string): string {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`[ArcFlow] Invalid price format: "${price}"`);
  }
  return Math.round(parsed * 1_000_000).toString();
}

/**
 * Builds the EIP-712 challenge requirements object.
 */
export function buildPaymentRequirements(
  price: string,
  sellerAddress: `0x${string}`,
  chainId = 5042002
): ChallengeRequirements {
  const atomicAmount = usdcToAtomic(price);

  return {
    scheme: 'exact',
    network: `eip155:${chainId}`,
    asset: ARC_TESTNET_USDC,
    amount: atomicAmount,
    payTo: sellerAddress,
    maxTimeoutSeconds: 345600, // 4 days (Circle standard)
    extra: {
      name: 'GatewayWalletBatched',
      version: '1',
      verifyingContract: ARC_TESTNET_GATEWAY,
    },
  };
}

/**
 * Constructs the standard Base64-encoded PAYMENT-REQUIRED payload.
 */
export function buildPaymentRequiredHeader(
  endpoint: string,
  price: string,
  requirements: ChallengeRequirements,
  customDescription?: string
): string {
  const payload: PaymentRequiredPayload = {
    x402Version: 2,
    resource: {
      url: endpoint,
      description: customDescription ?? `Paid API Resource (${price} USDC)`,
      mimeType: 'application/json',
    },
    accepts: [requirements],
  };

  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64');
}
