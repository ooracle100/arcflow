# ArcFlow Change Log

All deviations from the build brief logged here. Every spec deviation requires Product Owner approval.

---

## CHANGE LOG 001
Date:           2026-05-20
Agent:          Antigravity (Claude Opus 4.6)
Component:      constants.ts — Arc testnet chain ID
Original spec:  Build brief specified chain ID as 2088
Change made:    Using chain ID 5042002 (verified from viem/chains/definitions/arcTestnet.ts)
Reason:         The brief had an incorrect chain ID. The SDK and viem both confirm 5042002.
                This was also confirmed during the May 15 validation exercise where payments
                succeeded on chain 5042002.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 002
Date:           2026-05-20
Agent:          Antigravity (Claude Opus 4.6)
Component:      RPC failover endpoints
Original spec:  Brief listed 2 fallback RPCs: rpc.testnet.arc.network, arc-testnet.drpc.org
Change made:    Using 3 RPCs from viem chain definition: rpc.testnet.arc.network,
                rpc.quicknode.testnet.arc.network, rpc.blockdaemon.testnet.arc.network.
                drpc.org endpoint was not found in any official source.
Reason:         Official viem chain definition provides QuickNode and Blockdaemon as verified
                fallback endpoints. These are more reliable than an unverified drpc.org URL.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 003
Date:           2026-06-04
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      packages/client/src/fetch402.ts — Payment signature payload
Original spec:  Client sends `{ x402Version, payload }` in the payment-signature header
Change made:    Now sends `{ x402Version, payload, memo }` so the backend receives the
                full ISO 20022 memo (af_ref, EndToEndId, amounts, wallets, timestamps)
Reason:         Without the memo, the backend settle endpoint had no way to extract af_ref
                or agent/service wallet addresses for the payment record. This was a Session 4
                omission discovered during Session 5 integration.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 004
Date:           2026-06-04
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      backend/package.json — ESM module type
Original spec:  Backend package.json had no `type` field (defaulting to CommonJS)
Change made:    Added `"type": "module"` to enable ESM imports (import.meta.url, .js extensions)
Reason:         backend/src/db/schema.ts uses `import.meta.url` for __dirname resolution.
                TypeScript's NodeNext module mode requires the package to declare ESM explicitly.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 005
Date:           2026-06-06
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      backend/railway.toml — Builder declaration
Original spec:  File included `builder = "nixpacks"` to specify the Railway builder
Change made:    Removed the `builder = "nixpacks"` line entirely
Reason:         Nixpacks detected the monorepo's root pnpm-lock.yaml and attempted to use pnpm,
                which was not available in the build environment, causing a hard failure. Removing
                the line lets Railway use its default Railpack builder which respects the
                buildCommand and startCommand already in the file.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 006
Date:           2026-06-06
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      backend/tsconfig.json — Removed monorepo extends
Original spec:  File used `"extends": "../tsconfig.json"` to inherit root TypeScript config
Change made:    Removed the extends reference and made the file self-contained with
                `module: "NodeNext"` and `moduleResolution: "NodeNext"`
Reason:         Railway builds only the `backend/` root directory, so `../tsconfig.json` does not
                exist in the build container. TypeScript compilation failed on the missing parent
                config. NodeNext resolution is required for `import.meta.url` in `src/db/schema.ts`.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 007
Date:           2026-06-06
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      backend/src/routes/demo.ts — Removed external SDK import
Original spec:  File imported `withArcFlow` from `@getarcflow/middleware`
Change made:    Removed the import entirely. Reimplemented 402 challenge/settle inline using only
                the backend's own `chain/gateway.ts` module (`getConfig`)
Reason:         The backend cannot import from its own published npm packages — this creates a
                circular dependency in the build context. The demo endpoint now constructs the 402
                challenge payload directly and forwards settlement to the backend's internal
                `/api/payments/settle` route.
Approved by:    Product Owner (pending review)

---

## CHANGE LOG 008
Date:           2026-06-07
Agent:          Antigravity
Component:      dashboard/src/
Original spec:  The build brief specified USDC as the payment token. Dashboard drifted and used ARC. Logo was not clickable. Clock offset showed undefined.
Change made:    Replaced "ARC" with "USDC" in UI strings (agents.ts, monitor.ts, reconcile.ts, billing.ts). Wrapped ArcFlow logo in index.html in an <a> tag pointing to #monitor. Fixed health check reading in app.ts from health.arc.clockOffsetMs to health.clock.offsetMs.
Reason:         Align with original spec for token currency, improve navigation, and correct data access path for backend health response.
Approved by:    Product Owner (pending review)

## [1.0.1] - 2026-06-07
### Fixed
- Fixed missing 'memo' propagation in the backend demo endpoint which caused settlement failures.
- Diagnosed and assisted user in fixing the hidden newline character in the SELLER_ADDRESS Railway variable that crashed the Viem signer.

### Fixed
- Fixed an async race condition in the dashboard router that caused ghost intervals to overwrite the active screen with the Live Feed.

---

## CHANGE LOG 009 — PRODUCTION INCIDENT
Date:           2026-06-14
Agent:          Antigravity (Gemini 3.1 Pro — original change; Claude Opus 4.6 — revert)
Component:      backend/src/db/schema.ts — UNIQUE index on e2e_id
Incident:       **Railway production deployment crashed** (~14:21 UTC)

### What happened
Gemini added a `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_e2e_id ON payments(e2e_id) WHERE e2e_id IS NOT NULL;` line to schema.ts (commit `5809370`). This was pushed directly to `main` without testing, without logging in the Decision Log or Change Log, and without verifying whether the production database had existing duplicate `e2e_id` values. Railway auto-deployed and the backend crashed.

### What was the intended fix
Gemini was responding to a developer question on X about retry idempotency. Rather than just answering the question, it also pushed a code fix to enforce uniqueness on `e2e_id` in the payments table. The intent was correct (idempotency guard), but the execution was unsafe.

### What broke
The live backend at `getarcflowbackend-production.up.railway.app` went down. This is the same URL shared with Wyck (Dispatch) and posted publicly on X.

### How it was fixed
Claude reverted commit `5809370` (revert commit `2500f52`), pushed to `main`, and Railway auto-redeployed with the working schema.

### Root cause
No deployment safety process existed. Schema changes were pushed directly to production without:
1. Testing against the production database state
2. Logging in the Decision Log or Change Log
3. Product Owner review

### Prevention
See `docs/DEPLOYMENT_SAFETY.md` for the new mandatory deployment rules.

---

## CHANGE LOG 010
Date:           2026-06-16
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      packages/client/src/fetch402.ts
Original spec:  Client SDK generated a random `endToEndId` if the developer didn't pass one.
Change made:    Added `generateDeterministicE2EId(url, method, body)` using keccak256. If no explicit ID is passed, the SDK auto-generates a deterministic one based on the request content.
Reason:         Prevents agents from being double-charged on network retries. Retrying the exact same request now generates the same `endToEndId`, triggering the backend's idempotency guard.
Approved by:    Product Owner (via X community feedback)

---

## CHANGE LOG 011
Date:           2026-06-16
Agent:          Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:      packages/client/src/fetch402.ts
Original spec:  Client SDK `fetch()` crashed directly on network failures without retrying.
Change made:    Added `fetchWithRetry()` helper that wraps the raw fetch calls. Retries up to 2 times with a 1000ms linear backoff. Only retries on network errors (timeouts, DNS) and 5xx server errors. Does NOT retry on 402 or 409. Added `debug` config option to `ArcFlowClient` to log retries.
Reason:         Provides out-of-the-box resilience for agents running on unstable networks without requiring developers to write their own retry wrappers.
Approved by:    Product Owner (via X community feedback)
