# ArcFlow Session 5: Transaction Logging and Webhooks

This session implements the core backend logging and notification system. When a buyer agent signs a payment and the seller's `withArcFlow()` middleware offloads settlement to the SaaS backend via `POST /api/payments/settle`, the backend will log the transaction, update the agent's spending profile, and fire a webhook to the seller's configured endpoint.

## User Review Required

> [!NOTE]
> The build brief indicates `/payments` endpoints are meant for Session 6, but since the middleware from Session 3 requires `POST /api/payments/settle` to actually settle the payment and complete the flow, we will implement this specific POST endpoint now in Session 5.

## Proposed Changes

### Database Queries

#### [NEW] [queries.ts](file:///Users/orcl/Documents/arcflow/backend/src/db/queries.ts)
Implementation of all SQLite read/write operations required for payments and webhooks:
- `insertPayment`: Inserts a confirmed payment record.
- `upsertAgent`: Updates or creates an agent's spending profile (increments `total_spent` and `tx_count`).
- `insertWebhook`: Logs a pending webhook delivery attempt.
- `updateWebhookStatus`: Updates webhook status (`delivered`, `failed`) and attempt counts.
- `getPendingWebhooks`: Retrieves webhooks needing retry.

### Webhook System

#### [NEW] [emitter.ts](file:///Users/orcl/Documents/arcflow/backend/src/webhooks/emitter.ts)
Handles the immediate ingestion of webhooks. When a payment settles, this module will write a `pending` webhook record to SQLite and immediately kick off a delivery attempt to ensure the 3-second SLA is met.

#### [NEW] [queue.ts](file:///Users/orcl/Documents/arcflow/backend/src/webhooks/queue.ts)
A background processor for webhook retries.
- Implements exponential backoff.
- Caps attempts at a maximum of 5.
- Logs permanent failures into the database for dashboard visibility.

### API Routes

#### [NEW] [payments.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/payments.ts)
Implements the `POST /api/payments/settle` endpoint required by the middleware.
- Validates the incoming settlement request from the middleware.
- Uses `queries.ts` to log the transaction in `< 1 second`.
- Triggers `emitter.ts` to enqueue the webhook.
- Returns the expected standard JSON response payload (`transaction`, `payer`, `network`).

#### [MODIFY] [server.ts](file:///Users/orcl/Documents/arcflow/backend/src/server.ts)
- Mounts the new `paymentsRouter`.
- Initializes the background webhook retry queue on startup.

## Verification Plan

### Automated Tests
- I will create a test script (or use Node's native test runner) to verify the SQLite queries work as expected.
- I will test the webhook queue by simulating both a successful endpoint (e.g., webhook.site) and a deliberately broken URL to ensure the exponential backoff retry mechanism correctly logs attempts to the database.

### Manual Verification
- I will start the Express backend and send a mock `POST /api/payments/settle` request.
- I will verify the database contains the correct payment and updated agent profile.
- I will verify the webhook fires and updates its state in the database.
