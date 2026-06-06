# ArcFlow Validation Runbook

**Purpose**: Test Circle's `arc-nanopayments` reference implementation. Paywall a custom API endpoint. Document exactly where it breaks. That document becomes the ArcFlow v1 product spec.

**This is NOT the ArcFlow build.** This is the 60–90 minute validation exercise Claude prescribed before a single line of ArcFlow code gets written.

---

## System State (verified 2026-05-15 18:41 WAT)

| Prerequisite | Status | Required |
|---|---|---|
| Node.js | ✅ v24.13.0 | v22+ |
| npm | ✅ 11.6.2 | any |
| Docker Desktop | ✅ v29.1.3, daemon running | for local Supabase |
| Git | ✅ 2.50.1 | yes |
| Supabase CLI | ❌ not installed | **NEEDS INSTALL** |
| OpenAI API key | ❌ not available | optional (mock mode works) |
| Workspace | `/Users/orcl/Documents/arc-testnet` | existing ARC testnet work here |

---

## Step 1: Install Supabase CLI

**What**: Install the Supabase CLI globally so we can run a local Supabase instance.

**Command**:
```bash
npm install -g supabase
```

**DONE when**: `supabase --version` returns a version number.

**Expected output**: Something like `2.x.x`.

---

## Step 2: Clone the Reference Repo

**What**: Clone Circle's official `arc-nanopayments` repo into the workspace.

**Command**:
```bash
cd /Users/orcl/Documents/arc-testnet
git clone https://github.com/circlefin/arc-nanopayments.git
cd arc-nanopayments
```

**DONE when**: Directory `/Users/orcl/Documents/arc-testnet/arc-nanopayments` exists and contains `package.json`, `agent.mts`, `.env.example`.

---

## Step 3: Install Dependencies

**What**: Install all npm packages the reference app needs.

**Command**:
```bash
cd /Users/orcl/Documents/arc-testnet/arc-nanopayments
npm install
```

**DONE when**: `npm install` completes without errors. `node_modules/` directory exists. Key packages present: `@circle-fin/x402-batching`, `next`, `langchain`.

**Expected duration**: 1–3 minutes depending on network speed.

---

## Step 4: Set Up Environment Variables

**What**: Copy the example env file and prepare it for editing.

**Command**:
```bash
cp .env.example .env.local
```

**DONE when**: `.env.local` exists in the project root. We'll fill in values in subsequent steps.

---

## Step 5: Generate Seller & Buyer Wallets

**What**: Auto-generate two fresh EVM wallets (one seller, one buyer). The script writes their addresses and private keys directly into `.env.local`.

**Command**:
```bash
npm run generate-wallets
```

**DONE when**: `.env.local` contains populated values for all four:
- `SELLER_ADDRESS=0x...`
- `SELLER_PRIVATE_KEY=0x...`
- `BUYER_ADDRESS=0x...`
- `BUYER_PRIVATE_KEY=0x...`

**Log**: Copy the BUYER_ADDRESS — needed for Step 6.

---

## Step 6: Fund Buyer Wallet with Testnet USDC

**What**: Use Circle's faucet to send free testnet USDC to the buyer wallet.

> [!IMPORTANT]
> This is a **manual step** that requires opening a browser.

**Steps**:
1. Open https://faucet.circle.com/ in browser
2. Select **Arc Testnet** as the network
3. Paste the `BUYER_ADDRESS` from Step 5
4. Click to receive testnet USDC
5. Wait for confirmation

**DONE when**: The faucet confirms USDC was sent. Verify by checking the address on https://testnet.arcscan.app

**Log**: Record the faucet transaction hash and amount received.

---

## Step 7: Start Local Supabase (Docker)

**What**: Spin up a local Supabase instance in Docker and run the database migrations.

> [!NOTE]
> Docker handles everything automatically. You don't need to configure Docker manually — the Supabase CLI manages the containers for you.

**Commands**:
```bash
cd /Users/orcl/Documents/arc-testnet/arc-nanopayments
npx supabase start
```
Wait for it to finish (downloads images on first run — may take 2–5 minutes).

Then run migrations:
```bash
npx supabase migration up
```

**DONE when**: 
- `npx supabase start` outputs a table with `API URL`, `anon key`, `service_role key`
- Migrations complete without errors

**Log**: Copy these three values from the output:
- `API URL` → put in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
- `anon key` → put in `.env.local` as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `service_role key` → put in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 8: Update `.env.local` with Supabase Values

**What**: Fill in the three Supabase environment variables from Step 7's output.

**DONE when**: `.env.local` has all 7 required variables populated:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SELLER_ADDRESS=0x...
SELLER_PRIVATE_KEY=0x...
BUYER_ADDRESS=0x...
BUYER_PRIVATE_KEY=0x...
```

---

## Step 9: Run the Official Demo — Seller App

**What**: Start the Next.js seller app (the API server with paywalled endpoints).

**Command**:
```bash
npm run dev
```

**DONE when**: Terminal shows `Ready` and `http://localhost:3000` is accessible in browser. The seller dashboard loads at `http://localhost:3000/dashboard`.

**Log**: Screenshot the dashboard (even if empty — it proves the app runs).

---

## Step 10: Run the Official Demo — Buyer Agent

**What**: Run the AI payment agent in mock mode (no OpenAI key). It will call the paywalled endpoints and sign payment authorizations.

**Command** (in a second terminal):
```bash
cd /Users/orcl/Documents/arc-testnet/arc-nanopayments
npm run agent
```

**DONE when**: Agent output shows:
- It attempted to access paywalled endpoints
- It received `402 Payment Required` responses
- It signed payment authorizations
- It successfully received content after paying

**Log**: Copy the full agent output. This is critical evidence that:
1. The SDK works without special permissions (no Tempo-style wall)
2. The payment flow completes end-to-end on testnet

> [!CAUTION]
> **If this step FAILS with a permissions/whitelisting error**, that's the Tempo scenario repeating. Document the exact error and STOP — bring findings to Claude immediately.

---

## Step 11: THE REAL TEST — Create a Custom Paywalled Endpoint

**What**: This is the exercise Claude specifically asked for. Create a new API endpoint (e.g. `/api/custom/weather`) that is NOT part of the demo, and try to protect it with the x402 `withGateway()` middleware.

**What I'll do**:
1. Study how the existing endpoints (`/api/premium/quote`, `/api/premium/dataset`, etc.) use `withGateway()`
2. Create a new file: `app/api/custom/weather/route.ts`
3. Apply the same middleware pattern to a simple weather-data response
4. Document every friction point, missing feature, and manual work required

**DONE when**: 
- The custom endpoint exists and returns `402 Payment Required` for unpaid requests
- The buyer agent can pay for and receive data from it
- All friction/gaps are documented

---

## Step 12: Run Buyer Agent Against Custom Endpoint

**Command**:
```bash
npm run agent -- "Buy me data at http://localhost:3000/api/custom/weather"
```

**DONE when**: Agent either succeeds (proving the middleware is generalizable) or fails (revealing the exact gap).

**Log**: Full output + what happened.

---

## Step 13: Document All Findings

**What**: Create the structured findings document that becomes:
1. **ArcFlow v1 product spec** (paste to Claude to lock scope)
2. **X thread content** (authentic builder content)
3. **Grant application evidence**

**Document structure**:
```
1. What worked out of the box
2. Where it broke / required manual changes
3. What's completely missing for a real middleware
4. FlowGate features that map here (SQLite logging, retry logic, reconciliation, webhooks)
5. Permission/access friction encountered (or not — contrast with Tempo)
6. Exact boundary where Circle's demo stops being useful → ArcFlow begins
```

**DONE when**: Document exists at `/Users/orcl/Documents/arc-testnet/arc-nanopayments/VALIDATION_FINDINGS.md` and can be pasted directly to Claude.

---

## Execution Order & Dependencies

```
Step 1 (Supabase CLI) → Step 2 (Clone) → Step 3 (Install) → Step 4 (Env file)
    → Step 5 (Generate wallets) → Step 6 (Fund buyer - MANUAL)
    → Step 7 (Start Supabase) → Step 8 (Update env)
    → Step 9 (Run seller) → Step 10 (Run buyer agent)
    → Step 11 (Create custom endpoint) → Step 12 (Test custom endpoint)
    → Step 13 (Document findings)
```

**Total estimated time**: 60–90 minutes (including Step 6 manual faucet step).

---

## Agent Handoff Protocol

If this session runs out of tokens:
1. Check `task.md` for current progress (which steps are ✅ / 🔄 / ⬜)
2. Check the execution log at `/Users/orcl/Documents/arc-testnet/arc-nanopayments/EXECUTION_LOG.md`
3. Resume from the next incomplete step
4. All DONE criteria are self-contained — any agent can verify completion
