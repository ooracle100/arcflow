# ArcFlow — Master Build Brief for Antigravity

**Version:** 1.0
**Date:** 2026-05-20
**Builder:** Non-technical vibecoder using Antigravity (Claude + Gemini agents)
**Prepared by:** Claude (Anthropic) — product strategy and architecture layer

---

## Read This First — Before Any Code

This document is the single source of truth for the ArcFlow build. Every session starts here. Every decision that deviates from this spec gets logged. Every useful prompt gets logged. No agent writes a single line of code without reading this document first.

## What ArcFlow Is

ArcFlow is payment infrastructure middleware for Circle's Arc blockchain. It turns any API into a nanopayment-powered paywall in three lines of configuration. Developers install it. AI agents pay through it. ArcFlow handles everything in between — payment enforcement, clock-sync correction, transaction logging, reconciliation output, and accounting webhooks — automatically and without requiring Docker, Supabase, or any database infrastructure on the seller's side.

**The one sentence:** ArcFlow is to Circle's x402/Nanopayments stack what Stripe is to card payments — except built specifically for AI agents paying per API call in USDC on Arc.

## Why It Exists

The builder previously shipped FlowGate — an identical middleware product for Tempo (Stripe's private blockchain). FlowGate reached 11 of 14 Definition of Done items. It failed not because of product logic but because Tempo required wallet whitelisting by Stripe, which stopped responding after acknowledging the request. The product was validated. The dependency was the mistake.

ArcFlow is FlowGate ported to open infrastructure. Arc has no equivalent permission gate. The builder ran a full validation exercise on May 15, 2026 (documented in VALIDATION_FINDINGS.md) and confirmed:

- Arc testnet is fully open — no whitelisting required from any single company
- Circle's reference implementation (circlefin/arc-nanopayments) works at the protocol level but has four critical friction points that make it unusable for real developers
- No general-purpose middleware exists yet — the gap is confirmed and open

## The Four Friction Points ArcFlow Solves (from Validation, May 15)

| # | Problem in Circle's Demo | ArcFlow Solution |
|---|---|---|
| 1 | `authorization_validity_too_short` clock sync error — required patching node_modules directly to set `validAfter: "0"` | ArcFlow handles EIP-712 timestamp generation server-side, eliminating clock drift issues for any developer using the middleware |
| 2 | Full Docker + 13 images + Supabase Postgres required just to track nonces | ArcFlow is a hosted SaaS backend — sellers add middleware only, no database setup |
| 3 | Agent key management: private keys in .env, two-step funding (USDC → Gateway deposit) before first call | ArcFlow Client SDK abstracts this — `arcflow.fetch(url)` handles all payment negotiation |
| 4 | Complex Base64-encoded PAYMENT-REQUIRED header parsing crashes with `Cannot convert NaN to a BigInt` if any config is missing | ArcFlow wraps this in a resilient fetch client that handles header parsing, signing, and retries |

## Architecture — Two Sides, One Platform

ArcFlow is a two-sided platform. This is the complete picture before any session starts.

```
┌─────────────────────────────────────────────────────────────┐
│                         ARCFLOW                             │
│                                                             │
│  SELLER SIDE                    BUYER SIDE                  │
│  (API Providers)                (AI Agents)                 │
│                                                             │
│  withArcFlow() middleware  ←→  arcflow.fetch() client SDK   │
│       ↓                              ↓                      │
│  No Docker. No Supabase.       One line. Clock sync fixed.  │
│  3-line config.                Payment negotiation hidden.  │
│       ↓                              ↓                      │
│       └──────── ArcFlow SaaS Backend ────────┘             │
│                       ↓                                     │
│              SQLite (WAL mode)                              │
│              Webhook delivery + retry                       │
│              Reconciliation + CSV export                    │
│              Dashboard (5 screens)                          │
│              Fee engine (0% → 0.5% → 0.25%)                │
└─────────────────────────────────────────────────────────────┘
```

### What a Developer Does (Seller)

```javascript
// npm install @arcflow/middleware
import { withArcFlow } from '@arcflow/middleware';

export const GET = withArcFlow(myHandler, {
  price: '0.05',        // USDC per request
  wallet: '0xYours',   // your Arc wallet address
  apiKey: 'af_...',    // your ArcFlow dashboard key
});
```

That is the entire integration. No database. No Docker. No clock sync debugging.

### What an Agent Does (Buyer)

```javascript
// npm install @arcflow/client
import { ArcFlowClient } from '@arcflow/client';

const arcflow = new ArcFlowClient({ apiKey: 'af_agent_...' });
const data = await arcflow.fetch('https://api.example.com/weather');
// ↑ Handles 402 detection, EIP-712 signing, retry, receipt logging. One line.
```

## File Structure — Complete

Every file has one job. If a file does two things, split it.

```
arcflow/
├── packages/
│   ├── middleware/                  ← seller-side npm package
│   │   ├── src/
│   │   │   ├── index.ts             ← main export: withArcFlow()
│   │   │   ├── handler402.ts        ← x402 challenge-response logic
│   │   │   ├── verifier.ts          ← Arc Gateway payment verification
│   │   │   ├── memo.ts              ← ISO 20022 reference tag generation
│   │   │   ├── clockSync.ts         ← EIP-712 timestamp handling (the fix)
│   │   │   └── config.ts            ← middleware configuration schema
│   │   ├── package.json
│   │   └── README.md                ← 3-line integration guide
│   │
│   └── client/                      ← buyer-side agent SDK
│       ├── src/
│       │   ├── index.ts             ← main export: ArcFlowClient
│       │   ├── fetch402.ts          ← intercepts 402, negotiates payment
│       │   ├── signer.ts            ← EIP-712 signing with clock correction
│       │   ├── gateway.ts           ← Arc Gateway deposit abstraction
│       │   └── receipt.ts           ← logs payment receipts
│       ├── package.json
│       └── README.md
│
├── backend/                         ← hosted SaaS backend (replaces Supabase)
│   ├── src/
│   │   ├── server.ts                ← Express entry point
│   │   ├── routes/
│   │   │   ├── payments.ts          ← GET /payments, GET /payments/:id
│   │   │   ├── agents.ts            ← GET /agents, GET /agents/:address
│   │   │   ├── reconcile.ts         ← GET /reconcile, POST /reconcile/match
│   │   │   ├── export.ts            ← GET /export/csv
│   │   │   ├── health.ts            ← GET /health
│   │   │   └── stats.ts             ← GET /stats
│   │   ├── db/
│   │   │   ├── schema.ts            ← SQLite schema (WAL mode)
│   │   │   ├── migrations/          ← versioned schema changes
│   │   │   └── queries.ts           ← all DB queries in one file
│   │   ├── chain/
│   │   │   ├── provider.ts          ← Arc RPC with failover (3 endpoints)
│   │   │   └── gateway.ts           ← Circle Gateway client
│   │   ├── webhooks/
│   │   │   ├── emitter.ts           ← webhook delivery
│   │   │   └── queue.ts             ← exponential backoff retry queue
│   │   └── fees/
│   │       └── engine.ts            ← 3-tier fee calculator + collection
│   ├── data/                        ← SQLite files (gitignored)
│   └── package.json
│
├── dashboard/                       ← 5-screen monitoring UI
│   ├── src/
│   │   ├── index.html
│   │   ├── app.ts
│   │   ├── screens/
│   │   │   ├── setup.ts             ← Screen 1: onboarding + config
│   │   │   ├── monitor.ts           ← Screen 2: live payment feed
│   │   │   ├── reconcile.ts         ← Screen 3: match + export
│   │   │   ├── agents.ts            ← Screen 4: per-agent spend + anomalies
│   │   │   └── billing.ts           ← Screen 5: ArcFlow fee history
│   │   └── styles.css
│   └── package.json
│
├── .env.example
├── .env                             ← gitignored
└── docs/
    ├── DECISION_LOG.md              ← every architectural decision
    ├── PROMPT_LOG.md                ← every useful Antigravity prompt
    ├── CHANGE_LOG.md                ← every deviation from this spec
    └── INTEGRATION_GUIDE.md        ← how to add withArcFlow() to any API
```

## Arc Constants — Verified Testnet and Mainnet

> **NOTE (2026-05-20):** The build brief originally listed chain ID 2088. This was incorrect.
> Verified chain ID is **5042002** — see DECISION_LOG.md entry 001 and CHANGE_LOG.md entry 001.

```typescript
// src/config/constants.ts — DO NOT CHANGE WITHOUT A LOGGED DECISION

export const ARC_CONSTANTS = {
  TESTNET: {
    CHAIN_ID: 5042002,                       // Arc testnet chain ID (verified from viem)
    NETWORK: 'eip155:5042002',
    RPC: {
      PRIMARY:    'https://rpc.testnet.arc.network',
      FALLBACK_1: 'https://rpc.quicknode.testnet.arc.network',
      FALLBACK_2: 'https://rpc.blockdaemon.testnet.arc.network',
    },
    EXPLORER:   'https://testnet.arcscan.app',
    USDC:       '0x3600000000000000000000000000000000000000',
    GATEWAY_WALLET: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    GATEWAY_MINTER: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    GATEWAY_API: 'https://gateway-api-testnet.circle.com/v1',
    GATEWAY_DOMAIN: 26,
  },
  MAINNET: {
    CHAIN_ID: null,                          // Arc mainnet not yet launched
    RPC: {
      PRIMARY:    null,
      FALLBACK_1: null,
      FALLBACK_2: null,
    },
    EXPLORER:   'https://arcscan.app',
    USDC:       null,
    GATEWAY_WALLET: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
    GATEWAY_MINTER: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
    GATEWAY_API: 'https://gateway-api.circle.com/v1',
  },
};
```

## SQLite Schema — Reused from FlowGate (Modified for Arc)

```sql
-- payments table — every confirmed nanopayment
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  af_ref          TEXT UNIQUE NOT NULL,    -- ArcFlow reference: AF-YYYYMMDD-XXXXXX
  e2e_id          TEXT,                    -- end-to-end ID from agent header
  tx_hash         TEXT UNIQUE,            -- Arc transaction hash
  onchain_memo    TEXT,                   -- 32-byte keccak256 of full_record
  agent_wallet    TEXT NOT NULL,          -- buyer agent wallet
  service_wallet  TEXT NOT NULL,          -- seller wallet
  amount          TEXT NOT NULL,          -- USDC amount (string, not float)
  token           TEXT DEFAULT 'USDC',
  endpoint        TEXT,                   -- /api/custom/weather
  method          TEXT,                   -- GET, POST, etc.
  status          TEXT DEFAULT 'confirmed',
  reconciled      INTEGER DEFAULT 0,
  invoice_ref     TEXT,
  full_record     TEXT,                   -- JSON: complete ISO 20022 record
  arcflow_fee     TEXT,                   -- fee collected by ArcFlow
  created_at      TEXT DEFAULT (datetime('now')),
  block_number    INTEGER,
  clock_offset_ms INTEGER                 -- clock drift detected at signing time
);

-- agents table — spending profiles
CREATE TABLE IF NOT EXISTS agents (
  wallet          TEXT PRIMARY KEY,
  total_spent     TEXT DEFAULT '0',
  tx_count        INTEGER DEFAULT 0,
  daily_limit     TEXT,
  alert_threshold TEXT,
  last_seen       TEXT
);

-- webhooks table — delivery log with retry
CREATE TABLE IF NOT EXISTS webhooks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_af_ref  TEXT NOT NULL,
  endpoint_url    TEXT NOT NULL,
  payload         TEXT NOT NULL,
  status          TEXT DEFAULT 'pending',
  attempts        INTEGER DEFAULT 0,
  last_attempt    TEXT,
  delivered_at    TEXT
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_payments_agent      ON payments(agent_wallet);
CREATE INDEX IF NOT EXISTS idx_payments_date       ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_reconciled ON payments(reconciled);
CREATE INDEX IF NOT EXISTS idx_webhooks_status     ON webhooks(status);
```

## The Clock Sync Fix — The Most Important Technical Decision in ArcFlow

### What Happens in Circle's Demo (The Problem)

When an agent signs a TransferWithAuthorization, it must provide `validAfter` (Unix timestamp: not valid before this time) and `validBefore` (Unix timestamp: not valid after this time). The Circle Gateway rejects signatures where these timestamps don't match its server clock within a tight tolerance.

In the validation run, the local machine's clock was interpreted as being ahead of or behind the Gateway's expected window, causing all signatures to be rejected.

### What ArcFlow Does (The Solution)

ArcFlow's `clockSync.ts` module:

1. On first connection, measures the offset between local time and Arc network time by querying the latest block timestamp
2. Caches that offset in memory
3. Applies it to all EIP-712 `validAfter` / `validBefore` calculations
4. Sets a generous but safe window: `validAfter = networkTime - 60s`, `validBefore = networkTime + 3600s`
5. Refreshes the offset every 50 blocks

```typescript
// clockSync.ts
export class ClockSync {
  private offsetMs: number = 0;
  private lastSyncBlock: number = 0;

  async getNetworkTime(provider: Provider): Promise<number> {
    const block = await provider.getBlock('latest');
    const networkTimeMs = block.timestamp * 1000;
    const localTimeMs = Date.now();
    this.offsetMs = networkTimeMs - localTimeMs;
    this.lastSyncBlock = block.number;
    return networkTimeMs;
  }

  now(): number {
    return Date.now() + this.offsetMs;
  }

  validAfter(): bigint {
    return BigInt(Math.floor((this.now() - 60_000) / 1000));  // 60s grace period
  }

  validBefore(): bigint {
    return BigInt(Math.floor((this.now() + 3_600_000) / 1000)); // 1hr window
  }
}
```

## ISO 20022 Memo Standard — Reused from FlowGate

```typescript
// memo.ts
interface ArcFlowMemo {
  af_ref:     string;          // AF-YYYYMMDD-XXXXXX
  af_version: string;          // '1.0'
  MsgId:      string;          // MessageIdentification
  EndToEndId: string;          // from x-e2e-id header or generated
  PurpsCd:    'APIC';          // Purpose: API Call
  Amt:        string;
  Ccy:        'USDC';
  CdtTrfTxInf: {
    CdtrAcct: string;          // seller wallet
    DbtrAcct: string;          // agent wallet
  };
  service_endpoint: string;
  service_method:   string;
  timestamp:        string;
  network:          'arc';     // changed from 'tempo'
  chain_id:         number;
  clock_offset_ms:  number;    // NEW: log the clock sync offset at signing time
}
```

## Fee Engine — Reused from FlowGate (Modified)

```typescript
// fees/engine.ts
const TIERS = {
  FREE:   { limit: 10_000,  rate: 0 },
  GROWTH: { limit: 500_000, rate: 0.005  },   // 0.5%
  SCALE:  { limit: Infinity, rate: 0.0025 },  // 0.25%
};
```

## Dashboard Aesthetic — Dark Institutional

| Element | Value | Notes |
|---|---|---|
| Background | #0A0A0A | Financial terminal |
| Surface (cards) | #111111 | Panels and containers |
| Accent — confirmed/paid | #00FF88 | Green for success states |
| Accent — warning/pending | #FF6B35 | Orange for unmatched / alerts |
| Accent — info/links | #4A9EFF | Blue for neutral data |
| Typography — data values | JetBrains Mono or IBM Plex Mono | Monospace only for numbers |
| Typography — body | IBM Plex Sans | Clean, professional |
| Borders | #1E1E1E | Subtle separation |

### Five Dashboard Screens

1. **Setup** — npm install snippet, config form, wallet connection status, live 402 preview
2. **Live Monitor** — Real-time payment feed, summary cards, 30-day volume chart, top agents
3. **Reconciliation** — Unmatched payments, match interface, auto-match on EndToEndId, CSV export
4. **Agent Monitor** — All agents, per-agent history, budget controls, anomaly flags
5. **ArcFlow Billing** — Monthly fees, fee history, current tier, progress to next

## Backend API — 9 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | RPC status, DB status, latest Arc block, uptime |
| GET | /payments | Paginated history. Filter: agent, date, reconciled |
| GET | /payments/:af_ref | Single payment by ArcFlow reference |
| GET | /agents | All agents with spend totals |
| GET | /agents/:wallet | Single agent profile + payment history |
| GET | /reconcile | Unmatched payments + match rate |
| POST | /reconcile/match | Mark payment reconciled against invoice ref |
| GET | /export/csv | Date-filtered CSV export |
| GET | /stats | Daily volume, tx count, top agents, fees earned |

### Standard Response Wrapper

```typescript
// Every endpoint returns this
{
  success: true,
  data: { ... },
  meta: {
    timestamp: string,
    block: number,
    cached: boolean,
    version: '1.0'
  }
}

// Every error returns this
{
  success: false,
  error: {
    code: 'PAYMENT_VERIFICATION_FAILED',
    message: 'Human readable explanation',
    details: { ... }
  }
}
```

---

## Build Sessions — 9 Sessions, Maximum 3 Hours Each

### Session 1 — Foundation and Constants ✅ COMPLETE

**What gets built:**
- Project scaffold — all folders and empty files created
- constants.ts — Arc testnet and mainnet addresses verified from Circle docs
- provider.ts — Arc RPC connection with 3-endpoint failover
- clockSync.ts — network time measurement and offset calculation
- schema.ts and first migration — SQLite database created in WAL mode
- /health endpoint — returns Arc block number, DB status, clock offset

**Session 1 is DONE when:**
- [x] `curl localhost:3000/health` returns a real Arc testnet block number
- [x] Clock offset is logged and non-null
- [x] SQLite database file exists and all tables created
- [x] All Decision Log, Change Log, and Prompt Log files exist with Session 1 entries

---

### Session 2 — Clock Sync and Memo System

**What gets built:**
- clockSync.ts — complete implementation with auto-refresh every 50 blocks
- memo.ts — ISO 20022 aligned memo generation with ArcFlow fields
- Unit tests: memo schema validation, onchain hash is 32 bytes, clock offset applies correctly

**Session 2 is DONE when:**
- [ ] `ClockSync.now()` returns network-adjusted time
- [ ] `generateMemoTag()` produces a valid memo with all ISO 20022 fields populated
- [ ] `onchainMemo` is exactly 66 characters (0x + 32 bytes hex)
- [ ] Clock offset is included in every memo record
- [ ] Prompt Log written at end of session

---

### Session 3 — The 402 Handler (Seller Middleware Core)

**What gets built:**
- handler402.ts — x402 challenge-response logic using Circle's x402 spec
- verifier.ts — Circle Gateway payment verification
- index.ts — `withArcFlow()` main export tying handler + verifier + memo together

**Session 3 is DONE when:**
- [ ] Unauthenticated GET to a `withArcFlow()`-wrapped endpoint returns HTTP 402 with valid challenge JSON
- [ ] Challenge JSON includes: USDC amount, Arc wallet address, EIP-712 parameters, expiry
- [ ] Payment header present + verified → request proceeds to handler
- [ ] Payment header present + invalid → clear 402 rejection with reason
- [ ] No Docker. No Supabase. No local database required for this to work.
- [ ] Prompt Log written at end of session

---

### Session 4 — Client SDK (Buyer Agent Core)

**What gets built:**
- fetch402.ts — intercepts 402, extracts payment requirements, triggers signing
- signer.ts — EIP-712 signing using clockSync.ts for timestamp correction
- gateway.ts — Circle Gateway deposit abstraction (simplified funding flow)
- index.ts — ArcFlowClient main export

**Session 4 is DONE when:**
- [ ] `arcflow.fetch('http://localhost:3000/api/test')` against a `withArcFlow()`-protected endpoint:
  - Receives 402
  - Extracts payment requirements
  - Signs with clock-corrected timestamps
  - Retries with Payment-Signature header
  - Receives data
  - Logs receipt
- [ ] No `authorization_validity_too_short` error at any point
- [ ] No node_modules patching required
- [ ] Prompt Log written at end of session

---

### Session 5 — Transaction Logging and Webhooks

**What gets built:**
- queries.ts — all SQLite read/write operations
- Payment logging wired into `withArcFlow()` — every confirmed payment written within 1 second
- Agent profile upsert on every payment
- emitter.ts — webhook delivery within 3 seconds of payment
- queue.ts — exponential backoff retry (max 5 attempts), failed webhooks visible in DB

**Session 5 is DONE when:**
- [ ] Every confirmed payment appears in SQLite within 1 second
- [ ] Webhook fires to webhook.site test endpoint within 3 seconds
- [ ] Deliberately broken webhook URL triggers retry queue
- [ ] Failed webhooks visible via /payments/:af_ref with attempt count
- [ ] Prompt Log written at end of session

---

### Session 6 — Backend API

**What gets built:**
- All 9 REST endpoints (see list above)
- Standard response wrapper on every endpoint
- CSV export with date range filter

**Session 6 is DONE when:**
- [ ] All 9 endpoints return valid JSON with the standard wrapper
- [ ] /payments returns real records from SQLite
- [ ] /export/csv downloads a file that opens in a spreadsheet with correct columns
- [ ] /health shows real Arc testnet block and clock offset
- [ ] /stats returns accurate daily volume and fee totals
- [ ] Prompt Log written at end of session

---

### Session 7 — Dashboard

**What gets built:**
- All 5 dashboard screens
- Dark institutional aesthetic (spec in this document)
- Live data from backend API — no mock data in production build
- Real-time payment feed on Screen 2

**Session 7 is DONE when:**
- [ ] Dashboard loads at localhost:4000 without errors
- [ ] All 5 screens navigate correctly
- [ ] Live payment feed shows real records from SQLite
- [ ] Reconciliation export downloads a valid CSV
- [ ] ArcFlow Billing screen shows correct fee total
- [ ] No mock data visible in any screen
- [ ] Prompt Log written at end of session

---

### Session 8 — End-to-End Test and Package

**What gets built:**
- npm package structure for @arcflow/middleware and @arcflow/client
- README.md for each package (3-line integration guide)
- Full end-to-end test on Arc testnet (not localhost mock)

**Session 8 is DONE when this exact flow works on Arc testnet with zero errors:**
1. Fresh Express app created
2. `npm install @arcflow/middleware` runs without errors
3. Three lines of middleware added
4. ArcFlowClient agent runs and calls the protected endpoint
5. No `authorization_validity_too_short` error
6. Payment appears in SQLite within 1 second
7. Payment appears in dashboard within 5 seconds
8. Webhook fires to test endpoint
9. CSV export includes the payment
10. ArcFlow fee appears in Billing screen
- [ ] Prompt Log written at end of session

---

### Session 9 — Buffer and Hardening

**Purpose:** Fix whatever broke in Session 8. No new features.

**Session 9 is DONE when every item in the Definition of Done below is simultaneously true.**

---

## Definition of Done — MVP Complete When ALL Are True

- [ ] `npm install @arcflow/middleware` completes without errors
- [ ] Three-line `withArcFlow()` integration runs on a test Express app without errors
- [ ] Unauthenticated request returns HTTP 402 with valid x402 challenge payload
- [ ] Invalid payment signature returns clear rejection — not a crash
- [ ] Valid payment on Arc testnet unlocks protected endpoint
- [ ] No Docker, no Supabase, no local database required on seller's machine
- [ ] `arcflow.fetch()` completes a full payment cycle without `authorization_validity_too_short`
- [ ] Every confirmed payment written to SQLite within 1 second
- [ ] Every payment record includes valid ISO 20022 memo with af_ref, onchain hash, clock offset
- [ ] Onchain memo hash matches keccak256 of full record in SQLite
- [ ] Webhook fires within 3 seconds of payment confirmation
- [ ] Failed webhooks retry with exponential backoff and appear in dashboard
- [ ] Dashboard loads at live URL — all 5 screens functional with real data
- [ ] /export/csv downloads a valid, spreadsheet-importable file
- [ ] /health confirms Arc testnet RPC connectivity and returns current block
- [ ] ArcFlow fee appears in Billing screen for Growth tier transactions
- [ ] A developer with no prior ArcFlow knowledge can complete integration in under 30 minutes using only the README
- [ ] Zero silent failures — every error returns a structured JSON error response
- [ ] All Decision Log, Prompt Log, and Change Log entries are complete and current

---

## Documentation Log Formats

### Decision Log Format
```
## DECISION LOG [number]
Date:                   YYYY-MM-DD
Agent:                  Claude / Gemini / Antigravity / Product Owner
Component:              which file or system
Decision:               what was decided
Alternatives considered: what else was considered
Reasoning:              why this option
Impact:                 what this affects downstream
Approved by:            Product Owner
```

### Change Log Format
```
## CHANGE LOG [number]
Date:           YYYY-MM-DD
Agent:          who made the change
Component:      what file or system was changed
Original spec:  what this document said to do
Change made:    what was actually done instead
Reason:         why
Approved by:    Product Owner required for spec deviations
```

### Prompt Log Format
```
## PROMPT LOG [number]
Date:           YYYY-MM-DD
Session:        Session number
Agent:          Antigravity (Claude / Gemini)
Task:           what we were trying to accomplish
Prompt:         [exact text of the prompt that produced working output]
Output:         [file created or result produced]
Quality:        yes / partial / no
Iterations:     how many attempts before useful output
Notes:          what made the final version work; what to do differently next time
```

---

## Workspace and File Location

- **Workspace:** `/Users/orcl/Documents/`
- **ArcFlow folder:** `/Users/orcl/Documents/arcflow/` ← the live build
- **Validation reference (READ ONLY):** `/Users/orcl/Documents/arc-testnet/arc-nanopayments/` ← the May 15 validation exercise. Read it for reference. Do not copy files from it. Do not modify anything in it.

## What Antigravity Does at the Start of Every Session

1. Read this document from top to bottom
2. Read `docs/DECISION_LOG.md`, `docs/CHANGE_LOG.md`, `docs/PROMPT_LOG.md` to know current state
3. Identify which session is next and what the Done criteria are
4. Build only what is in scope for that session
5. At the end of the session: write Prompt Log entries for every section built
6. Update the Decision Log and Change Log with anything that deviated from this spec

**Never start a session without reading the logs. Never end a session without writing the Prompt Log.**

---

*This document is the single source of truth for the ArcFlow build.*
*Any deviation requires a logged decision. Any useful prompt requires a log entry.*
*Build it. Ship it. Let the transactions tell the next story.*
