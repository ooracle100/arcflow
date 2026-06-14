# ArcFlow Retry & Idempotency Build Brief

**Purpose:** Implement automatic retry handling and idempotency in the ArcFlow client SDK so agents are never double-charged when network connections are unstable.

**Priority:** High — A developer publicly asked about this on X (2026-06-14). Our honest reply acknowledged this is on the roadmap.

**Pre-requisite reading:** `docs/DEPLOYMENT_SAFETY.md` — You MUST follow deployment safety rules.

---

## Background

When an AI agent calls `arcflow.fetch(url)`, the following happens:
1. SDK sends initial request → server returns HTTP 402 with a `PAYMENT-REQUIRED` header
2. SDK parses the challenge, signs an EIP-712 payment authorization
3. SDK retries the request with a `payment-signature` header
4. Server verifies signature, settles payment on backend, returns data

**The problem:** If the network drops at step 3 or 4:
- The agent doesn't know if the payment was settled or not
- If the agent retries naively, it generates a NEW `af_ref` and `e2e_id`, so the backend sees it as a brand new payment
- The agent gets double-charged

---

## What Needs to Be Built

### Fix 1: Automatic `endToEndId` Generation (Client SDK)

**File:** `packages/client/src/fetch402.ts`

**Current behavior (line ~50):**
```ts
const result = await fetchWith402(url, this.privateKey, options, this.rpcUrl);
```
The `endToEndId` is optional in `FetchOptions`. If not provided, `signer.ts` (line 73) generates a random one:
```ts
const e2eId = endToEndId ?? `E2E-${Date.now().toString(36).toUpperCase()}-${generateRandomHex(4)}`;
```

**Required change:**
If the developer does NOT pass an `endToEndId`, generate a **deterministic** one from the request content instead of a random one. This way, retrying the exact same request automatically produces the same ID.

**Implementation approach:**
```ts
// In fetch402.ts, before the initial request:
const autoEndToEndId = options.endToEndId ?? generateDeterministicId(url, options.method, options.body);
```

Where `generateDeterministicId` hashes the URL + method + body:
```ts
import { keccak256, toHex } from 'viem';

function generateDeterministicId(url: string, method?: string, body?: any): string {
  const input = `${method ?? 'GET'}:${url}:${typeof body === 'string' ? body : JSON.stringify(body ?? '')}`;
  const hash = keccak256(toHex(input));
  return `E2E-${hash.slice(2, 14).toUpperCase()}`;
}
```

**IMPORTANT:** This must be generated BEFORE the first request attempt and reused across retries within the same `fetchWith402` call.

---

### Fix 2: Auto-Retry with Backoff (Client SDK)

**File:** `packages/client/src/fetch402.ts`

**Current behavior (line ~64 and ~136):**
```ts
let response = await fetch(url, initRequestOptions);  // line 64 — can throw on network error
...
const retryResponse = await fetch(url, retryRequestOptions);  // line 136 — can throw on network error
```

Neither of these is wrapped in retry logic. A network drop throws an unhandled error.

**Required change:**
Wrap both fetch calls in a retry helper that:
- Retries up to 3 times
- Uses exponential backoff (500ms, 1000ms, 2000ms)
- Only retries on network errors (TypeError, AbortError), NOT on HTTP error responses (4xx, 5xx)
- Reuses the same `endToEndId` across all retries (critical for idempotency)

**Implementation approach:**
```ts
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on network errors, not HTTP status errors
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

Then replace both raw `fetch()` calls in `fetchWith402` with `fetchWithRetry()`.

---

### Fix 3: Safe Database Index Migration (Backend)

**File:** `backend/src/db/schema.ts`

**Context:** On 2026-06-14, a direct `CREATE UNIQUE INDEX` was pushed and crashed production because the existing database may have had conflicting rows.

**Required change:**
Add the unique index on `e2e_id` safely, as a migration that handles conflicts:

```ts
// After the CREATE TABLE statements, add a safe migration block:
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_e2e_id ON payments(e2e_id) WHERE e2e_id IS NOT NULL;`);
} catch (err) {
  // If index creation fails due to existing duplicates, log warning but don't crash
  console.warn('[ArcFlow DB] Could not create unique index on e2e_id — existing duplicates may need manual cleanup:', err);
}
```

**CRITICAL:** This must be wrapped in try/catch so the backend starts even if the index can't be created. The previous attempt crashed production because it was inside the `db.exec()` batch statement with no error handling.

---

### Fix 4: Middleware Should Handle 409 Gracefully

**File:** `packages/middleware/src/index.ts`

**Current behavior (line ~128):**
```ts
if (!backendRes.ok || !backendResult.success) {
  res.status(402).json({ ... });
  return;
}
```

When the backend returns `409 PAYMENT_ALREADY_SETTLED`, the middleware treats it as a payment failure and returns 402 to the client. This means even a correctly guarded retry gets rejected.

**Required change:**
Check specifically for 409 status and treat it as a successful idempotent replay:

```ts
if (backendRes.status === 409 && backendResult.error?.code === 'PAYMENT_ALREADY_SETTLED') {
  // Idempotent replay — payment was already settled, proceed to handler
  handler(req, res, next);
  return;
}

if (!backendRes.ok || !backendResult.success) {
  res.status(402).json({ ... });
  return;
}
```

**Note:** This means on a retry, the seller's handler will be called again. The seller must ensure their own handler is idempotent (returning the same data for the same request). This is standard practice for any API.

---

## Verification Plan

1. **Unit test:** Create a test that calls `arcflow.fetch()` twice with the same URL/body. Verify the second call reuses the same `endToEndId` and does NOT create a duplicate payment record.
2. **Network failure test:** Mock a network error on the first attempt. Verify the SDK retries and succeeds on the second attempt.
3. **Manual test against live endpoint:** After deploying, call the demo endpoint with the same request body twice quickly. Verify only one payment appears in the dashboard.

---

## Files to Modify (Summary)

| File | Change |
|---|---|
| `packages/client/src/fetch402.ts` | Add `generateDeterministicId()`, add `fetchWithRetry()`, wire both into `fetchWith402()` |
| `packages/client/src/index.ts` | No changes needed (public API stays the same) |
| `backend/src/db/schema.ts` | Add try/catch-wrapped unique index migration |
| `packages/middleware/src/index.ts` | Handle 409 as idempotent success |
| `docs/CHANGE_LOG.md` | Log all changes |
| `docs/DECISION_LOG.md` | Log the design decisions |

---

## What NOT to Do

- Do NOT push schema changes directly to `main` without testing. See `docs/DEPLOYMENT_SAFETY.md`.
- Do NOT change the public API surface of `ArcFlowClient`. The `fetch()` and `fetchWithReceipt()` methods must continue to work exactly as they do today.
- Do NOT make `endToEndId` a required parameter. The whole point is making it automatic.
