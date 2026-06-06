// receipt.ts — Logs and stores payment receipts for AI agents.

import { type Hex } from 'viem';
import { type ArcFlowMemo } from './signer.js';

export interface PaymentReceipt {
  afRef: string;
  e2eId: string;
  amount: string;          // decimal USDC string
  endpoint: string;
  method: string;
  payer: `0x${string}`;
  transactionHash?: Hex;   // returned from the PAYMENT-RESPONSE header
  timestamp: string;
  memo: ArcFlowMemo;
}

export class ReceiptStore {
  private receipts: PaymentReceipt[] = [];

  /**
   * Log a new payment receipt.
   */
  logReceipt(receipt: PaymentReceipt): void {
    this.receipts.push(receipt);
  }

  /**
   * Retrieve all logged receipts.
   */
  getReceipts(): PaymentReceipt[] {
    return [...this.receipts];
  }

  /**
   * Find a specific receipt by its ArcFlow reference.
   */
  getReceiptByRef(afRef: string): PaymentReceipt | undefined {
    return this.receipts.find(r => r.afRef === afRef);
  }

  /**
   * Clear the in-memory log.
   */
  clearReceipts(): void {
    this.receipts = [];
  }
}

// Singleton store instance
export const receiptStore = new ReceiptStore();
