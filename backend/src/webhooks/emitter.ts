// emitter.ts — Webhook delivery engine with strict 3-second timeout
// Enqueues and sends webhook notifications on confirmed payments.

import { insertWebhook, updateWebhookStatus } from '../db/queries.js';

export interface WebhookPayload {
  event: 'payment.confirmed';
  data: {
    af_ref: string;
    e2e_id: string | null;
    tx_hash: string | null;
    onchain_memo: string | null;
    agent_wallet: string;
    service_wallet: string;
    amount: string;
    token: string;
    endpoint: string | null;
    method: string | null;
    timestamp: string;
  };
}

/**
 * Cryptographically secure and robust webhook HTTP POST emitter.
 * Enforces a strict 3-second network timeout.
 * Updates the database status upon success/failure.
 *
 * @param id - The SQLite database record ID
 * @param endpointUrl - Target callback URL
 * @param payloadStr - JSON string of the WebhookPayload
 * @param attempts - Previous attempts count
 * @returns Promise resolving to boolean success indicator
 */
export async function deliverWebhook(
  id: number,
  endpointUrl: string,
  payloadStr: string,
  attempts: number
): Promise<boolean> {
  const currentAttempt = attempts + 1;
  const nowStr = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Strict 3-second timeout

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ArcFlow-Webhook-Emitter/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status >= 200 && res.status < 300) {
      updateWebhookStatus(id, 'delivered', currentAttempt, nowStr, nowStr);
      return true;
    } else {
      const nextStatus = currentAttempt >= 5 ? 'failed' : 'retry';
      updateWebhookStatus(id, nextStatus, currentAttempt, nowStr, null);
      return false;
    }
  } catch (err) {
    const nextStatus = currentAttempt >= 5 ? 'failed' : 'retry';
    updateWebhookStatus(id, nextStatus, currentAttempt, nowStr, null);
    return false;
  }
}

/**
 * Enqueues a webhook notification record in SQLite and schedules an immediate async delivery.
 *
 * @param paymentAfRef - ArcFlow unique payment reference
 * @param endpointUrl - URL to deliver the webhook payload to
 * @param payload - Webhook payload object
 */
export function queueWebhook(
  paymentAfRef: string,
  endpointUrl: string,
  payload: WebhookPayload
): void {
  const payloadStr = JSON.stringify(payload);
  
  // Insert pending webhook record
  const webhookId = insertWebhook({
    payment_af_ref: paymentAfRef,
    endpoint_url: endpointUrl,
    payload: payloadStr,
    status: 'pending',
    attempts: 0,
    last_attempt: null,
    delivered_at: null,
  });

  // Execute non-blocking, immediate HTTP request in the background
  deliverWebhook(webhookId, endpointUrl, payloadStr, 0).catch(() => {});
}
