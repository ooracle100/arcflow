// clockSync.test.ts — Unit tests for ClockSync offset and drift calculations
// Session 2 DONE criteria:
//   ✓ ClockSync.now() returns network-adjusted time
//   ✓ Clock offset applies correctly to EIP-712 timestamps

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClockSync } from '../clockSync.js';
import { type PublicClient } from 'viem';

// ─── Mock Public Client ──────────────────────────────────────────────────

function createMockClient(blockNumber: bigint, blockTimestamp: bigint): PublicClient {
  return {
    getBlock: async (args: any) => {
      return {
        number: blockNumber,
        timestamp: blockTimestamp,
      } as any;
    },
    getBlockNumber: async () => {
      return blockNumber;
    },
  } as unknown as PublicClient;
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('ClockSync core logic', () => {
  it('correctly calculates positive offset (local clock is slow / behind network)', async () => {
    const clockSync = new ClockSync();
    
    // Set network block time to 10 seconds ahead of now
    const networkTimeSec = Math.floor(Date.now() / 1000) + 10;
    const mockClient = createMockClient(100n, BigInt(networkTimeSec));

    await clockSync.sync(mockClient);

    const offset = clockSync.getOffsetMs();
    assert.ok(offset >= 9000 && offset <= 11000, `Offset ${offset}ms should be around 10000ms`);
    assert.equal(clockSync.isInitialized(), true);
    assert.equal(clockSync.getLastSyncBlock(), 100);

    // Adjusted now() should be in the future relative to Date.now()
    const localNow = Date.now();
    const adjustedNow = clockSync.now();
    assert.ok(adjustedNow > localNow + 9000, 'Adjusted now() should apply the positive offset');
  });

  it('correctly calculates negative offset (local clock is fast / ahead of network)', async () => {
    const clockSync = new ClockSync();

    // Set network block time to 5 seconds behind now
    const networkTimeSec = Math.floor(Date.now() / 1000) - 5;
    const mockClient = createMockClient(200n, BigInt(networkTimeSec));

    await clockSync.sync(mockClient);

    const offset = clockSync.getOffsetMs();
    assert.ok(offset <= -4000 && offset >= -6000, `Offset ${offset}ms should be around -5000ms`);

    // Adjusted now() should be in the past relative to Date.now()
    const localNow = Date.now();
    const adjustedNow = clockSync.now();
    assert.ok(adjustedNow < localNow - 4000, 'Adjusted now() should apply the negative offset');
  });

  it('EIP-712 validAfter and validBefore windows apply offset correctly', async () => {
    const clockSync = new ClockSync();

    // Set network block time to exactly 60 seconds ahead of now
    const networkTimeSec = Math.floor(Date.now() / 1000) + 60;
    const mockClient = createMockClient(300n, BigInt(networkTimeSec));

    await clockSync.sync(mockClient);

    const validAfter = clockSync.validAfter();
    const validBefore = clockSync.validBefore();

    const expectedValidAfter = BigInt(networkTimeSec - 60);
    const expectedValidBefore = BigInt(networkTimeSec + 3600);

    // Give 2s tolerance for CPU execution time during tests
    assert.ok(validAfter >= expectedValidAfter - 2n && validAfter <= expectedValidAfter + 2n,
      `validAfter ${validAfter} should be close to expected ${expectedValidAfter}`);
    assert.ok(validBefore >= expectedValidBefore - 2n && validBefore <= expectedValidBefore + 2n,
      `validBefore ${validBefore} should be close to expected ${expectedValidBefore}`);
  });

  it('maybeSyncIfNeeded respects block sync intervals', async () => {
    const clockSync = new ClockSync();
    
    let callCount = 0;
    const client: PublicClient = {
      getBlock: async () => {
        callCount++;
        return { number: 100n, timestamp: BigInt(Math.floor(Date.now() / 1000)) } as any;
      },
      getBlockNumber: async () => {
        return 100n;
      }
    } as any;

    // First call triggers sync
    await clockSync.maybeSyncIfNeeded(client);
    assert.equal(callCount, 1);

    // Call again at same block, should NOT sync
    await clockSync.maybeSyncIfNeeded(client);
    assert.equal(callCount, 1);

    // Simulate 50 blocks progression
    const clientAtBlock150: PublicClient = {
      getBlock: async () => {
        callCount++;
        return { number: 150n, timestamp: BigInt(Math.floor(Date.now() / 1000)) } as any;
      },
      getBlockNumber: async () => {
        return 150n;
      }
    } as any;

    await clockSync.maybeSyncIfNeeded(clientAtBlock150);
    assert.equal(callCount, 2, 'Should have synced again after 50 blocks');
  });
});
