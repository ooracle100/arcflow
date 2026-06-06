# Session 6: Backend API

This session focuses on building out the REST API for the ArcFlow dashboard, implementing the 9 requested endpoints with standard response wrappers, and adding CSV export functionality.

## Proposed Changes

### Core Helpers and Queries

#### [MODIFY] [queries.ts](file:///Users/orcl/Documents/arcflow/backend/src/db/queries.ts)
- Extend `getPayments` to accept `startDate` and `endDate` filters for CSV export.
- Add `getStats()` to aggregate total volume, transaction count, and fee totals.
- Add `reconcilePayment(afRef, invoiceRef, txHash)` to update payment records.

#### [NEW] [wrapper.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/wrapper.ts)
- Implement `apiResponse(data)` to wrap successes with the `meta` block (timestamp, version).
- Implement `apiError(code, message, details)` to standardise error JSON format.

---

### Route Implementation

#### [MODIFY] [payments.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/payments.ts)
- Add `GET /api/payments` to return paginated history with filters (`agent_wallet`, `reconciled`, `startDate`, `endDate`).
- Add `GET /api/payments/:af_ref` to return a single payment and its associated webhooks.

#### [NEW] [agents.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/agents.ts)
- `GET /api/agents`: Returns all agents with spend totals (`getAllAgents()`).
- `GET /api/agents/:wallet`: Returns a single agent profile and their recent payments.

#### [NEW] [reconcile.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/reconcile.ts)
- `GET /api/reconcile`: Returns unmatched payments and overall match rate percentage.
- `POST /api/reconcile/match`: Accepts `{ af_ref, invoice_ref, tx_hash }` to mark a payment as reconciled.

#### [NEW] [stats.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/stats.ts)
- `GET /api/stats`: Returns aggregated data (volume, tx count, top agents, fees earned).

#### [NEW] [export.ts](file:///Users/orcl/Documents/arcflow/backend/src/routes/export.ts)
- `GET /api/export/csv`: Streams a CSV file of payments. Accepts `startDate` and `endDate` queries.

#### [MODIFY] [server.ts](file:///Users/orcl/Documents/arcflow/backend/src/server.ts)
- Wire up `agentsRouter`, `reconcileRouter`, `statsRouter`, and `exportRouter` to the Express app.

---

## Verification Plan

### Automated Tests
- Since backend testing has been largely integration-based, I will run `curl` commands against the live local backend to verify every new route returns the standard JSON wrapper.

### Manual Verification
- Start the server (`npx pnpm start`).
- Verify `/api/payments` returns the mocked transaction from Session 5.
- Verify `/api/export/csv` downloads a `.csv` file format.
- Run `/health` to ensure it continues to function properly.
