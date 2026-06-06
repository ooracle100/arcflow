// queue.ts — Webhook exponential backoff retry queue worker
// Periodically polls SQLite for retryable webhooks and delivers them with backoff math.

import { getPendingWebhooks } from '../db/queries.js';
import { deliverWebhook } from './emitter.js';

let queueInterval: NodeJS.Timeout | null = null;
let processing = false;

/**
 * Calculates exponential backoff delay in milliseconds.
 * Formula: 2^attempts * 1000 milliseconds.
 * E.g., attempt 1 = 2s, attempt 2 = 4s, attempt 3 = 8s, attempt 4 = 16s.
 */
export function getBackoffDelayMs(attempts: number): number {
  return Math.pow(2, attempts) * 1000;
}

/**
 * Main queue processing worker loop.
 * Fetches pending/retryable webhooks and processes them if backoff delay has elapsed.
 */
export async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const webhooks = getPendingWebhooks();
    const now = Date.now();

    for (const w of webhooks) {
      if (!w.id) continue;
      
      // Skip standard fresh "pending" status records.
      // Emitter.ts already executes a fast non-blocking first attempt for them at creation time.
      if (w.status === 'pending') {
        continue;
      }

      // Check if backoff window has been fully satisfied
      if (w.last_attempt) {
        const lastAttemptTime = new Date(w.last_attempt).getTime();
        const elapsedMs = now - lastAttemptTime;
        const requiredDelayMs = getBackoffDelayMs(w.attempts || 0);

        if (elapsedMs < requiredDelayMs) {
          continue; // Backoff has not expired yet, skip
        }
      }

      // Re-trigger webhook HTTP delivery in a blocking call (one by one inside worker)
      await deliverWebhook(w.id, w.endpoint_url, w.payload, w.attempts || 0);
    }
  } catch (err) {
    console.error('[ArcFlow Webhook Queue] Error processing queue:', err);
  } finally {
    processing = false;
  }
}

/**
 * Starts the polling worker to run every intervalMs.
 */
export function startQueueWorker(intervalMs = 1000): void {
  if (queueInterval) return;
  
  queueInterval = setInterval(() => {
    processQueue().catch(() => {});
  }, intervalMs);
}

/**
 * Stops the background polling worker cleanly.
 */
export function stopQueueWorker(): void {
  if (queueInterval) {
    clearInterval(queueInterval);
    queueInterval = null;
  }
}
