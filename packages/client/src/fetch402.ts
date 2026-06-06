// fetch402.ts — Intercepts HTTP 402 challenges, negotiates EIP-712 signatures, and retries.
// Provides a transparent, seamless fetch client wrapper for paywalled APIs.

import { type Hex } from 'viem';
import { signPaymentAuthorization, type SigningResult, type ArcFlowMemo } from './signer.js';
import { receiptStore, type PaymentReceipt } from './receipt.js';
import { clockSync } from './clockSync.js';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from './gateway.js';

export interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  endToEndId?: string;
}

export interface FetchResult {
  response: Response;
  paid: boolean;
  paymentDetails?: {
    afRef: string;
    amount: string;
    txHash?: Hex;
    payer: `0x${string}`;
    memo: ArcFlowMemo;
  };
}

/**
 * Performs a standard HTTP fetch, automatically resolving x402 payment requirements.
 * Bypasses the clock sync skew via clockSync.ts.
 *
 * @param url - Target paywalled URL
 * @param privateKey - Buyer wallet private key to sign the micropayments
 * @param options - Standard fetch options + custom x-e2e-id parameters
 * @param rpcUrl - Arc testnet RPC URL for clock synchronization
 * @returns FetchResult containing the final HTTP Response, paid status, and paymentDetails receipt
 */
export async function fetchWith402(
  url: string,
  privateKey: Hex,
  options: FetchOptions = {},
  rpcUrl = 'https://rpc.testnet.arc.network'
): Promise<FetchResult> {
  const method = options.method ?? 'GET';
  const headers = { ...(options.headers ?? {}) };
  
  // 1. Ensure clockSync is initialized and synced
  if (!clockSync.isInitialized()) {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    });
    await clockSync.sync(publicClient);
  }

  // 2. Execute initial request
  const initRequestOptions: RequestInit = {
    ...options,
    headers: {
      ...headers,
    },
  };
  
  let response = await fetch(url, initRequestOptions);

  // 3. If response status is not 402, return immediately
  if (response.status !== 402) {
    return { response, paid: false };
  }

  const paymentRequiredBase64 = response.headers.get('PAYMENT-REQUIRED');
  if (!paymentRequiredBase64) {
    return { response, paid: false };
  }

  // 4. Decode challenge from PAYMENT-REQUIRED header
  let challenge: any;
  try {
    const json = Buffer.from(paymentRequiredBase64, 'base64').toString('utf-8');
    challenge = JSON.parse(json);
  } catch (err) {
    throw new Error(`[ArcFlow Client] Failed to parse PAYMENT-REQUIRED challenge header: ${err}`);
  }

  const requirements = challenge.accepts?.[0];
  if (!requirements) {
    throw new Error(`[ArcFlow Client] Challenge contains no valid payment requirements`);
  }

  if (requirements.scheme !== 'exact' || requirements.extra?.name !== 'GatewayWalletBatched') {
    throw new Error(`[ArcFlow Client] Unsupported payment scheme: "${requirements.scheme}" / "${requirements.extra?.name}"`);
  }

  // Extract path and query from the URL to match originalUrl
  const urlObj = new URL(url);
  const endpoint = urlObj.pathname + urlObj.search;

  // 5. Generate and sign payment authorization EIP-712 payload
  const verifyingContract = requirements.extra.verifyingContract as `0x${string}`;
  const payTo = requirements.payTo as `0x${string}`;
  const atomicAmount = requirements.amount as string;
  const chainId = parseInt(requirements.network.split(':')[1]) || 5042002;

  const signingResult: SigningResult = await signPaymentAuthorization({
    privateKey,
    verifyingContract,
    payTo,
    atomicAmount,
    chainId,
    endpoint,
    method,
    endToEndId: options.endToEndId,
  });

  const paymentSignatureBase64 = Buffer.from(JSON.stringify({
    x402Version: signingResult.x402Version,
    payload: signingResult.payload,
    memo: signingResult.memo,
  })).toString('base64');

  // 6. Retry the request with the Payment-Signature header
  const retryHeaders: Record<string, string> = {
    ...headers,
    'payment-signature': paymentSignatureBase64,
  };
  
  if (options.endToEndId) {
    retryHeaders['x-e2e-id'] = options.endToEndId;
  }

  const retryRequestOptions: RequestInit = {
    ...options,
    headers: retryHeaders,
  };

  const retryResponse = await fetch(url, retryRequestOptions);

  if (!retryResponse.ok) {
    return { response: retryResponse, paid: true };
  }

  // 7. Extract the transaction hash from the PAYMENT-RESPONSE header
  const paymentResponseBase64 = retryResponse.headers.get('PAYMENT-RESPONSE');
  let txHash: Hex | undefined;
  if (paymentResponseBase64) {
    try {
      const json = Buffer.from(paymentResponseBase64, 'base64').toString('utf-8');
      const parsed = JSON.parse(json);
      txHash = parsed.transaction;
    } catch {
      // Non-fatal if header parsing fails
    }
  }

  // 8. Log the payment receipt in the store
  const receipt: PaymentReceipt = {
    afRef: signingResult.memo.af_ref,
    e2eId: signingResult.memo.EndToEndId,
    amount: signingResult.memo.Amt,
    endpoint,
    method,
    payer: signingResult.payload.from,
    transactionHash: txHash,
    timestamp: signingResult.memo.timestamp,
    memo: signingResult.memo,
  };

  receiptStore.logReceipt(receipt);

  return {
    response: retryResponse,
    paid: true,
    paymentDetails: {
      afRef: receipt.afRef,
      amount: receipt.amount,
      txHash,
      payer: receipt.payer,
      memo: receipt.memo,
    },
  };
}
