// index.ts — Main export for ArcFlow buyer client SDK
// Exports ArcFlowClient to let AI agents pay for 402 paywalled endpoints in one line.

import { type Hex } from 'viem';
import { fetchWith402, type FetchOptions, type FetchResult } from './fetch402.js';
import { ArcFlowGateway } from './gateway.js';
import { receiptStore, type PaymentReceipt } from './receipt.js';

export { ArcFlowGateway } from './gateway.js';
export { clockSync } from './clockSync.js';
export { receiptStore, type PaymentReceipt } from './receipt.js';
export { signPaymentAuthorization, type SigningResult, type ArcFlowMemo } from './signer.js';

export interface ArcFlowClientConfig {
  /** The EVM private key of the buyer wallet */
  privateKey: Hex;
  /** Optional custom RPC URL for the Arc network */
  rpcUrl?: string;
  /** Optional ArcFlow dashboard API key */
  apiKey?: string;
  /** Enable debug logging for retry attempts and network errors */
  debug?: boolean;
}

export class ArcFlowClient {
  private privateKey: Hex;
  private rpcUrl: string;
  private apiKey?: string;
  private debug: boolean;
  public gateway: ArcFlowGateway;

  constructor(config: ArcFlowClientConfig) {
    if (!config.privateKey) {
      throw new Error('[ArcFlow Client] Missing privateKey in configuration');
    }
    this.privateKey = config.privateKey;
    this.rpcUrl = config.rpcUrl ?? 'https://rpc.testnet.arc.network';
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
    
    // Initialize the gateway helper for depositing USDC
    this.gateway = new ArcFlowGateway(this.privateKey, this.rpcUrl);
  }

  /**
   * Perform an HTTP request, automatically resolving x402 payment requirements.
   * If a 402 is encountered, EIP-712 TransferWithAuthorization is automatically signed and retried.
   *
   * @param url - Target paywalled URL
   * @param options - Fetch options (method, headers, body, endToEndId)
   * @returns Standard HTTP Response on success/failure
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const result = await fetchWith402(url, this.privateKey, options, this.rpcUrl, this.debug);
    return result.response;
  }

  /**
   * Perform an HTTP request, returning both the Response and granular payment details receipt.
   *
   * @param url - Target paywalled URL
   * @param options - Fetch options (method, headers, body, endToEndId)
   * @returns FetchResult with final Response, paid boolean, and paymentDetails receipt
   */
  async fetchWithReceipt(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    return await fetchWith402(url, this.privateKey, options, this.rpcUrl, this.debug);
  }

  /**
   * Retrieve all logged payment receipts from this client session.
   */
  getReceipts(): PaymentReceipt[] {
    return receiptStore.getReceipts();
  }

  /**
   * Find a specific payment receipt by its ArcFlow reference code.
   */
  getReceiptByRef(afRef: string): PaymentReceipt | undefined {
    return receiptStore.getReceiptByRef(afRef);
  }
}
