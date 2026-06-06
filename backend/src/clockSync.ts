// clockSync.ts — EIP-712 timestamp handling (the fix for authorization_validity_too_short)
//
// On May 15, 2026, Circle's SDK failed with authorization_validity_too_short because
// the local machine's clock was out of sync with the Circle Gateway's server clock.
// ArcFlow fixes this by measuring the offset between local time and Arc network time,
// then applying that offset to all EIP-712 validAfter/validBefore calculations.

import { type PublicClient } from 'viem';

export class ClockSync {
  private offsetMs: number = 0;
  private lastSyncBlock: number = 0;
  private syncInterval: number = 50; // resync every 50 blocks
  private initialized: boolean = false;

  /**
   * Measure the offset between local time and the Arc network's block timestamp.
   * Should be called once at startup and then refreshed periodically.
   */
  async sync(client: PublicClient): Promise<void> {
    const block = await client.getBlock({ blockTag: 'latest' });
    const networkTimeMs = Number(block.timestamp) * 1000;
    const localTimeMs = Date.now();
    this.offsetMs = networkTimeMs - localTimeMs;
    this.lastSyncBlock = Number(block.number);
    this.initialized = true;
  }

  /**
   * Check if we need to resync based on block progression.
   */
  async maybeSyncIfNeeded(client: PublicClient): Promise<void> {
    if (!this.initialized) {
      await this.sync(client);
      return;
    }

    try {
      const currentBlock = await client.getBlockNumber();
      if (Number(currentBlock) - this.lastSyncBlock >= this.syncInterval) {
        await this.sync(client);
      }
    } catch {
      // If block fetch fails, keep using cached offset
    }
  }

  /**
   * Get network-adjusted current time in milliseconds.
   */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  /**
   * Get network-adjusted current time in seconds (Unix timestamp).
   */
  nowSeconds(): number {
    return Math.floor(this.now() / 1000);
  }

  /**
   * EIP-712 validAfter: 60 seconds before network time.
   * This gives a generous grace period for clock drift.
   */
  validAfter(): bigint {
    return BigInt(Math.floor((this.now() - 60_000) / 1000));
  }

  /**
   * EIP-712 validBefore: 1 hour after network time.
   * This is a safe window that Circle Gateway will accept.
   */
  validBefore(): bigint {
    return BigInt(Math.floor((this.now() + 3_600_000) / 1000));
  }

  /**
   * Get the current clock offset in milliseconds.
   * Positive = network is ahead of local. Negative = network is behind.
   */
  getOffsetMs(): number {
    return this.offsetMs;
  }

  /**
   * Whether the clock has been synced at least once.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the block number when we last synced.
   */
  getLastSyncBlock(): number {
    return this.lastSyncBlock;
  }
}

// Singleton instance for the entire ArcFlow system
export const clockSync = new ClockSync();
