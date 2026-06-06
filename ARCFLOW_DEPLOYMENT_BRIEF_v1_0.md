# ArcFlow — Deployment Brief for Antigravity
**Version:** 1.0
**Date:** 2026-06-05
**Follows:** ARCFLOW_BUILD_BRIEF_v1_0.md
**Prepared by:** Claude (Anthropic)

---

## Read This First

This document picks up exactly where the Build Brief ended. The local build is complete and the executive summary confirms a successful end-to-end simulation. What exists right now is a working product on one machine. What this brief produces is a product that anyone, anywhere, can install and use.

This brief has seven phases. They must be executed in order. Each phase depends on the one before it — skipping ahead will cause failures that are harder to debug than doing it right.

**Who does what:** Every task in this brief is clearly labelled.
- `[ANTIGRAVITY]` — Antigravity executes this. No action needed from the builder.
- `[YOU]` — The builder (Orcl) does this manually. Steps are written simply and completely. Do exactly what is written. Nothing extra.

**The workspace:** `/Users/orcl/Documents/arcflow/` — this is the live ArcFlow folder. All Antigravity work happens here unless this brief says otherwise.

---

## Accounts — All Already Set Up ✅

> **Why this matters to Antigravity:** Every deployment platform in this brief is already connected and ready. No account creation is needed. The details below are the confirmed credentials and connections — use these exact usernames and service relationships throughout every phase. Do not assume different usernames or ask the builder to create new accounts.

---

### Confirmed Account Details

| Platform | Username | Connection | Status |
|----------|----------|------------|--------|
| GitHub | `ooracle100` | `https://github.com/ooracle100` | ✅ Active |
| Railway | — | Connected via GitHub (`ooracle100`) | ✅ Active |
| Vercel | `ooracle100` | Connected via GitHub (`ooracle100`) | ✅ Active — existing projects: `dvn-intelligence`, `0gm-counter-app` |
| npm | `oracle100` | `https://www.npmjs.com/~oracle100` | ✅ Active |

**What this means for every phase:**
- When the brief says "push to GitHub," the remote is `https://github.com/ooracle100/arcflow`
- When the brief says "deploy to Railway," it connects using the `ooracle100` GitHub account
- When the brief says "deploy to Vercel," it connects using the `ooracle100` GitHub account — the new ArcFlow project will appear alongside the existing two projects
- When the brief says "publish to npm," the authenticated user is `oracle100`

**npm scope:** The npm organisation `@getarcflow` has been created and is owned by `oracle100`. The confirmed package names are `@getarcflow/middleware` and `@getarcflow/client`. There is no fallback needed — the scope is secured and ready.

---

## Phase 1 — Real Arc Testnet Validation

> **Why this phase exists:** The build brief's Executive Summary confirms a successful simulation using mock components. A simulation is not a real test. Before anything gets deployed to the internet, we must confirm that the four friction points documented on May 15 are actually solved — against the real Arc testnet, with real faucet USDC, with zero manual workarounds. If anything fails here, it gets fixed now before it becomes a live problem that external users encounter. This phase is the quality gate for everything that follows.

---

### Step 1.1 — Confirm Test Wallet Funding ✅ Already Done

**[YOU — confirm this before opening Antigravity]**

> **Why:** Antigravity needs the funded wallet address to run the testnet payment tests. You already collected USDC, EURC, and cirBTC from the Circle faucet — this step is just confirming which wallet holds those funds and making the address available for the tests.

1. Open MetaMask
2. Make sure it is connected to **Arc Testnet** (Chain ID 2088 — the same network you used on May 15)
3. Confirm the wallet shows a USDC balance (from the faucet you already ran)
4. Copy the wallet address — the long `0x...` string at the top of MetaMask
5. Keep it ready — paste it to Antigravity when Step 1.2 asks for it

**Note:** You collected USDC, EURC, and cirBTC. The tests use USDC only. The EURC and cirBTC are available if any test requires a different token — Antigravity will specify if needed.

**DONE when:** You have the funded Arc Testnet wallet address copied and ready to paste.

---

### Step 1.2 — Run the Four Friction Point Tests

**[ANTIGRAVITY]**

> **Why:** Each of the four tests below maps directly to one of the friction points documented in VALIDATION_FINDINGS.md. The validation exercise on May 15 confirmed these problems exist in Circle's reference implementation. These tests confirm ArcFlow has solved each one. This is what differentiates ArcFlow from the reference demo — if any test fails, that is a build problem, not a deployment problem, and it must be fixed before proceeding.

**Read before starting:** The ArcFlow project is at `/Users/orcl/Documents/arcflow/`. The validation reference (READ ONLY, do not modify) is at `/Users/orcl/Documents/arc-testnet/arc-nanopayments/`. Do not touch the validation reference folder.

**Test 1 — Clock Sync (Friction Point 1)**

Start the ArcFlow backend:
```bash
cd /Users/orcl/Documents/arcflow/backend
npm run dev
```

Call the `/health` endpoint and confirm the response includes a `clock_offset_ms` field that is non-null and non-zero:
```bash
curl http://localhost:3000/health
```

Expected response must include:
```json
{
  "success": true,
  "data": {
    "rpc_connected": true,
    "clock_offset_ms": [any non-null number],
    "latest_block": [any block number above 0],
    "db_status": "ok"
  }
}
```

If `clock_offset_ms` is null or missing, the ClockSync module is not working. Stop and fix `clockSync.ts` before continuing.

**Test 2 — No Docker, No Supabase (Friction Point 2)**

Confirm that the backend started in Test 1 with zero Docker involvement. Run:
```bash
docker ps
```

The ArcFlow backend must NOT appear in the Docker process list. The backend must run on Node.js alone. If the backend requires Docker to start, there is a dependency problem that must be fixed before deployment.

**Test 3 — Real Testnet Payment Without node_modules Patching (Friction Points 1 and 4 combined)**

In a second terminal, run the ArcFlow client SDK against a locally-running `withArcFlow()`-protected endpoint:

```bash
cd /Users/orcl/Documents/arcflow
node test-e2e.mts
```

> **Note to Antigravity:** If `test-e2e.mts` does not exist, create it now. It should:
> 1. Spin up a temporary Express server with one `withArcFlow()`-protected endpoint at `/api/test`
> 2. Instantiate `ArcFlowClient` with the test wallet private key (from `.env.local`)
> 3. Call `arcflow.fetch('http://localhost:3001/api/test')`
> 4. Log the full result
> 5. Confirm the response contains actual data (not a 402 rejection)

The test PASSES when:
- `arcflow.fetch()` succeeds and returns the endpoint's data
- There is NO `authorization_validity_too_short` error anywhere in the logs
- There is NO mention of `node_modules` patching required
- The payment record appears in SQLite immediately after

The test FAILS if any of those conditions are not met. Fix the failure before proceeding.

**Test 4 — End-to-End SQLite Logging**

After Test 3 completes, query the database to confirm the payment was logged:
```bash
cd /Users/orcl/Documents/arcflow/backend
sqlite3 data/arcflow.db "SELECT af_ref, amount, agent_wallet, endpoint, clock_offset_ms FROM payments ORDER BY created_at DESC LIMIT 1;"
```

Expected: one row with all fields populated. `clock_offset_ms` must be non-null.

**Phase 1 is DONE when:**
- [ ] `/health` returns a real Arc testnet block number and non-null `clock_offset_ms`
- [ ] Backend starts with no Docker involvement
- [ ] `arcflow.fetch()` completes a payment with zero `authorization_validity_too_short` errors
- [ ] No `node_modules` patching was required at any point
- [ ] Payment record exists in SQLite with all fields populated

**Write Prompt Log entry for Phase 1 before continuing.**

---

## Phase 2 — Pre-Deployment Preparation

> **Why this phase exists:** Deploying code that works on one machine to a server requires three things the current codebase does not yet have: a way to get the code onto the server (GitHub), configuration that tells the server how to run it (environment variables and config files), and a fix to a very common deployment problem called CORS. CORS is the reason a dashboard hosted on one URL cannot talk to a backend hosted on a different URL unless the backend explicitly gives permission. Skipping this phase means the deployment will appear to succeed but the dashboard will silently fail to load any data.

---

### Step 2.1 — Audit Environment Variables

**[ANTIGRAVITY]**

> **Why:** Environment variables are settings that the application reads at startup — things like database file paths, API keys, and server URLs. On a local machine these live in `.env` files. On Railway and Vercel they must be entered manually through a web interface. Before deployment, every environment variable the application needs must be identified and documented so none are missed.

Read every `.env`, `.env.local`, and `.env.example` file in the ArcFlow project. Produce a complete list of every environment variable the application reads, in this format:

```
VARIABLE_NAME
  Used by:      backend / dashboard / middleware / client
  What it is:   plain English description
  Example value: an example (not the real secret value)
  Required:     yes / no
  Set by whom:  YOU (builder enters this in Railway/Vercel dashboard) or AUTO (Railway sets it automatically)
```

Save this list to `docs/ENV_VARIABLES.md`. This document will be the reference used when entering variables into Railway and Vercel.

**DONE when:** `docs/ENV_VARIABLES.md` exists and lists every environment variable with no gaps.

---

### Step 2.2 — Add CORS Configuration to the Backend

**[ANTIGRAVITY]**

> **Why:** When the dashboard (which will be hosted at a Vercel URL like `https://arcflow.vercel.app`) makes requests to the backend (hosted at a Railway URL like `https://arcflow-backend.railway.app`), the browser blocks those requests by default. This is a browser security rule called CORS — Cross-Origin Resource Sharing. The backend must explicitly tell the browser "requests from the Vercel domain are allowed." Without this, the dashboard will load but every data fetch will fail silently and all five screens will be empty.

In `backend/src/server.ts`, install and configure the `cors` npm package:

```bash
cd /Users/orcl/Documents/arcflow/backend
npm install cors
npm install --save-dev @types/cors
```

Add CORS configuration that reads the allowed origin from an environment variable:

```typescript
import cors from 'cors';

const allowedOrigins = [
  process.env.DASHBOARD_URL,      // e.g. https://arcflow.vercel.app (set after Vercel deploy)
  'http://localhost:4000',         // local dashboard during development
  'http://localhost:3000',         // local testing
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

Add `DASHBOARD_URL` to the ENV_VARIABLES.md document with:
- Used by: backend
- What it is: The public URL of the deployed dashboard (Vercel URL). Set after Phase 4 completes.
- Required: yes
- Set by whom: YOU (entered in Railway dashboard after Vercel deploys)

**DONE when:** CORS middleware is in `server.ts` and reads `DASHBOARD_URL` from environment.

---

### Step 2.3 — Add the Demo API Endpoint

**[ANTIGRAVITY]**

> **Why:** When ArcFlow goes live, potential users need to be able to test it immediately without building their own API first. A live demo endpoint — a real paywalled API that anyone can call with the ArcFlow client SDK — is the product's handshake with the world. It is what you show in content, what you link in the grant application, and what you send to Dispatch when asking them to try ArcFlow. Without a demo endpoint, the product is technically real but functionally invisible.

Create a demo endpoint at `/api/demo/summary` inside the backend. This endpoint:
- Is protected by `withArcFlow()` at a price of `0.001` USDC per call
- Accepts a POST request with a JSON body containing a `text` field (max 500 characters)
- Returns a JSON response with a word count, character count, and the first 100 characters of the text
- Requires no external API calls — it processes text locally only
- Is documented in a new file: `docs/DEMO_ENDPOINT.md` with a copy-paste curl example and a copy-paste `arcflow.fetch()` example

This endpoint is intentionally simple. Its purpose is to demonstrate the payment flow, not to provide a complex service. Anyone who installs `@getarcflow/client` should be able to call this endpoint and see a real USDC payment settle on Arc testnet in under 5 seconds.

**DONE when:**
- Demo endpoint returns data when called with a valid payment
- Demo endpoint returns HTTP 402 when called without payment
- `docs/DEMO_ENDPOINT.md` contains copy-paste examples for both curl and the ArcFlow client SDK

---

### Step 2.4 — Configure Railway Deployment Files

**[ANTIGRAVITY]**

> **Why:** Railway needs to know how to start the backend when the code arrives from GitHub. Without a configuration file, Railway will guess — and it will guess wrong. The `railway.toml` file is the instruction sheet that tells Railway exactly how to start the application, what port to use, and where the database file lives.

Create `backend/railway.toml`:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node dist/server.js"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[environments.production.deploy]
startCommand = "npm run build && node dist/server.js"
```

Also update `backend/src/server.ts` to read the port from the environment variable that Railway sets automatically:

```typescript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ArcFlow backend running on port ${PORT}`);
});
```

> **Critical note:** Railway sets `process.env.PORT` automatically to a value it chooses. The backend must use this value exactly. Never hardcode port 3000 in production — Railway's internal router will not connect to it.

Also update the DATABASE_PATH in the backend to use an environment variable:

```typescript
const DB_PATH = process.env.DATABASE_PATH || './data/arcflow.db';
```

Add `DATABASE_PATH` to ENV_VARIABLES.md:
- Used by: backend
- What it is: File path where SQLite database is stored. On Railway this points to the persistent volume.
- Example value: `/data/arcflow.db`
- Required: yes
- Set by whom: YOU (entered in Railway dashboard)

**DONE when:**
- `backend/railway.toml` exists
- Backend reads PORT from `process.env.PORT`
- Backend reads DATABASE_PATH from `process.env.DATABASE_PATH`

---

### Step 2.5 — Configure Vercel Deployment Files

**[ANTIGRAVITY]**

> **Why:** The dashboard is a Vite single-page application. Vercel handles Vite applications well, but needs one configuration to handle client-side routing correctly. Without this, navigating between the five dashboard screens will return 404 errors on Vercel even though they work perfectly on localhost.

Create `dashboard/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "env": {
    "VITE_BACKEND_URL": "@arcflow_backend_url"
  }
}
```

Also confirm that every place in the dashboard code that calls the backend uses `import.meta.env.VITE_BACKEND_URL` rather than a hardcoded `localhost:3000`. If any hardcoded localhost references exist, replace them now.

Add `VITE_BACKEND_URL` to ENV_VARIABLES.md:
- Used by: dashboard
- What it is: The public URL of the deployed backend (Railway URL). Set after Phase 3 completes.
- Example value: `https://arcflow-backend.railway.app`
- Required: yes
- Set by whom: YOU (entered in Vercel dashboard)

**DONE when:**
- `dashboard/vercel.json` exists
- Zero hardcoded `localhost` references remain in dashboard source code

---

### Step 2.6 — Prepare npm Package Files

**[ANTIGRAVITY]**

> **Why:** npm packages have strict requirements about what fields must be present in `package.json` before a package can be published. Missing fields cause the publish command to fail. The packages also must not accidentally contain private keys, `.env` files, or the SQLite database. The `.npmignore` file is the instruction list that tells npm what to leave out.

For both `packages/middleware/` and `packages/client/`, verify and update `package.json` to include all required fields:

```json
{
  "name": "@getarcflow/middleware",
  "version": "0.1.0",
  "description": "Paywall any API endpoint for AI agents in 3 lines. Built for Arc nanopayments.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["arc", "nanopayments", "x402", "usdc", "ai-agents", "middleware", "getarcflow"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/ooracle100/arcflow"
  }

Create `.npmignore` in both package folders:
```
src/
*.env
*.env.local
data/
node_modules/
.DS_Store
*.test.ts
```

The npm scope `@getarcflow` is already secured — the organisation was created before this build session began. No scope availability check is needed. Proceed directly to confirming both `package.json` files use `@getarcflow` as their scope and that `.npmignore` exists in both package folders.

**DONE when:**
- Both `package.json` files have all required fields
- `.npmignore` exists in both package folders
- npm scope availability is confirmed and documented in Change Log

---

### Step 2.7 — Push Code to GitHub

**[ANTIGRAVITY — except the password step, which is YOU]**

> **Why:** GitHub is the bridge between your local machine and the deployment servers. Railway and Vercel do not accept code by upload — they connect directly to GitHub and pull whatever is in the repository. Every time you push new code to GitHub, Railway and Vercel can automatically redeploy. Without this connection, deployment is impossible.

**[ANTIGRAVITY]** Run these commands in the ArcFlow project root:

```bash
cd /Users/orcl/Documents/arcflow
git init
git add .
git commit -m "ArcFlow v0.1.0 — initial deployment commit"
```

Then create the remote connection to GitHub. This command will open a browser prompt:
```bash
gh auth login
```

> **Note to Antigravity:** If the `gh` CLI is not installed, install it first:
> ```bash
> brew install gh
> ```
> After running `gh auth login`, the terminal will pause and display instructions.

**[YOU]** When the terminal shows instructions:
1. It will ask: **What account do you want to log into?** → Select **GitHub.com**
2. It will ask: **What is your preferred protocol?** → Select **HTTPS**
3. It will ask: **Authenticate Git with your GitHub credentials?** → Select **Yes**
4. It will say: **Copy the one-time code** and show an 8-character code like `XXXX-XXXX`
5. Press Enter — your browser will open
6. On the GitHub page, paste the 8-character code
7. Click **Authorize GitHub CLI**
8. Return to the terminal — it will confirm you are logged in
9. Tell Antigravity: **"GitHub login is done"**

**[ANTIGRAVITY]** After the builder confirms login, create the repository and push:

```bash
gh repo create arcflow --public --source=. --remote=origin --push
```

The repository will be created at `https://github.com/ooracle100/arcflow`.

**DONE when:**
- `https://github.com/ooracle100/arcflow` exists and shows the ArcFlow code
- The repository contains all folders: `backend/`, `dashboard/`, `packages/`, `docs/`

---

## Phase 3 — Railway: Backend Deployment

> **Why this phase matters:** The backend is the engine of ArcFlow. The SQLite database, the payment verification logic, the webhook system, the 9 API endpoints — all of it runs on the Railway server. Until the backend has a live public URL, the dashboard has nowhere to point and the npm packages have no backend to talk to. This phase creates that URL.

---

### Step 3.1 — Create the Railway Project

**[YOU]**

> **Why:** Railway projects are created through the web interface, not the terminal. Antigravity cannot click buttons in a browser, so you do this part.

1. Go to `https://railway.app` and log in
2. Click **New Project**
3. Click **Deploy from GitHub repo**
4. Find and click **arcflow** in your repository list
5. Railway will show you a list of folders — select **backend** as the root directory
6. Click **Deploy Now**
7. Railway will start building. Wait for it to show a green **Active** status (takes 2-5 minutes)
8. Once active, click on the service name → click **Settings** → click **Generate Domain**
9. Railway will show a URL like `https://arcflow-backend-production.up.railway.app`
10. Copy that URL — you will need it in the next step
11. Tell Antigravity: **"Railway is deployed. The URL is: [paste the URL]"**

**DONE when:** Railway shows **Active** status and you have copied the Railway URL.

---

### Step 3.2 — Add a Persistent Volume for SQLite

**[YOU]**

> **Why:** Railway's servers reset periodically. Without a persistent volume, the SQLite database file gets deleted on every reset and all payment history is lost. A volume is a permanent storage attachment that survives resets. This step is critical — skipping it means the database is not reliable in production.

1. In Railway, click on your **arcflow** service
2. Click the **Volumes** tab
3. Click **Add Volume**
4. In the **Mount Path** field, type exactly: `/data`
5. Click **Create** — Railway will attach the volume
6. Tell Antigravity: **"Volume is attached at /data"**

**DONE when:** Railway shows a volume mounted at `/data`.

---

### Step 3.3 — Enter Environment Variables in Railway

**[YOU]**

> **Why:** The backend reads configuration from environment variables — the Arc RPC URL, the database path, the fee wallet address. These were documented in `docs/ENV_VARIABLES.md` during Phase 2. Railway stores them securely and injects them into the backend at startup. Without them, the backend will start but fail to connect to anything.

1. In Railway, click on your **arcflow** service
2. Click the **Variables** tab
3. Ask Antigravity: **"Show me every environment variable from ENV_VARIABLES.md that is marked 'Set by whom: YOU' for the backend, with the exact values I should enter"**
4. Antigravity will give you a list of `VARIABLE_NAME = value` pairs
5. Enter each one in Railway by clicking **New Variable**, typing the name and value, clicking **Add**
6. After all variables are entered, click **Deploy** to restart with the new variables
7. Tell Antigravity: **"Variables are entered. Railway is redeploying."**

**DONE when:** Railway shows **Active** after the redeploy with all variables set.

---

### Step 3.4 — Verify the Live Backend

**[ANTIGRAVITY]**

> **Why:** The backend is only confirmed working when it responds correctly from its public Railway URL — not from localhost. This is the first time the production environment is tested. Common failures here are missing environment variables, database path errors, or RPC connection failures.

Run these checks against the Railway URL provided by the builder:

```bash
# Replace with actual Railway URL
curl https://[RAILWAY_URL]/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "rpc_connected": true,
    "clock_offset_ms": [non-null number],
    "latest_block": [number above 0],
    "db_status": "ok",
    "uptime_seconds": [number]
  }
}
```

If `rpc_connected` is false: the Arc RPC environment variable is wrong. Check ENV_VARIABLES.md and correct it in Railway.

If `db_status` is not "ok": the DATABASE_PATH variable does not match the Railway volume mount path `/data`. Correct it in Railway.

If the curl command returns a connection error: Railway has not finished deploying or the domain was not generated. Wait 2 minutes and retry.

**Phase 3 is DONE when:**
- [ ] `curl https://[RAILWAY_URL]/health` returns success with a live Arc block number
- [ ] `db_status` is "ok"
- [ ] `clock_offset_ms` is non-null
- [ ] Railway volume is attached at `/data`

**Write Prompt Log entry for Phase 3 before continuing.**

---

## Phase 4 — Vercel: Dashboard Deployment

> **Why this phase matters:** The dashboard is ArcFlow's face. It is what a seller sees when they log in to check their payment volume, reconcile transactions, and manage agent budgets. A dashboard that only runs on localhost is not a product — it is a prototype. After this phase, the dashboard has a permanent public URL that works on any browser, anywhere.

---

### Step 4.1 — Update Dashboard Backend URL

**[ANTIGRAVITY]**

> **Why:** The dashboard makes API calls to the backend. Until this step, those calls pointed to `localhost:3000`. Now that the backend is live on Railway, every call must point to the Railway URL instead. This change must be made before deploying to Vercel.

The builder will provide the Railway URL from Phase 3. Update the Vercel environment variable configuration so `VITE_BACKEND_URL` is set to the Railway URL. Verify zero remaining `localhost` references in the dashboard source code. Commit and push the change to GitHub:

```bash
cd /Users/orcl/Documents/arcflow
git add .
git commit -m "chore: point dashboard to production backend URL"
git push
```

**DONE when:** GitHub shows the updated commit and no localhost references remain in dashboard source.

---

### Step 4.2 — Deploy the Dashboard to Vercel

**[YOU]**

> **Why:** Like Railway, Vercel is configured through its web interface. Antigravity cannot do this step.

1. Go to `https://vercel.com` and log in
2. Click **Add New** → **Project**
3. Click **Import Git Repository**
4. Find and click **arcflow** in your repository list
5. Under **Root Directory**, click **Edit** and type `dashboard` — this tells Vercel to deploy only the dashboard folder, not the whole project
6. Under **Framework Preset**, Vercel should automatically detect **Vite** — if not, select it manually
7. Click **Environment Variables**
8. Add one variable:
   - Name: `VITE_BACKEND_URL`
   - Value: the Railway URL from Phase 3 (the full URL including `https://`)
9. Click **Deploy**
10. Wait for Vercel to build (2-4 minutes). When done, Vercel shows a URL like `https://arcflow.vercel.app`
11. Copy that URL — you need it for the next step
12. Tell Antigravity: **"Vercel is deployed. The URL is: [paste the URL]"**

**DONE when:** Vercel shows a deployment success screen and you have copied the Vercel URL.

---

### Step 4.3 — Connect Dashboard URL Back to Backend (CORS)

**[ANTIGRAVITY]**

> **Why:** Remember the CORS configuration added in Phase 2? It reads `DASHBOARD_URL` from the environment to know which domain is allowed to make requests. Now that the Vercel URL is known, this variable must be set in Railway — otherwise the dashboard will load but every data fetch will be silently blocked by the browser.

The builder will provide the Vercel URL from Step 4.2. Add `DASHBOARD_URL` as an environment variable in Railway with the exact Vercel URL as the value. Then instruct the builder to trigger a Railway redeploy.

**[YOU]** After Antigravity tells you to:
1. Go to `https://railway.app` and log into your project
2. Click on the **arcflow** service → **Variables** tab
3. Click **New Variable**
4. Name: `DASHBOARD_URL`
5. Value: paste the full Vercel URL (e.g. `https://arcflow.vercel.app`)
6. Click **Add**
7. Click **Deploy** to restart the backend with the new variable
8. Tell Antigravity: **"DASHBOARD_URL is set. Railway is redeploying."**

---

### Step 4.4 — Verify the Live Dashboard

**[ANTIGRAVITY]**

> **Why:** A successful Vercel deployment does not guarantee the dashboard works. It only means the files were uploaded. This test confirms the dashboard can actually load data from the live Railway backend.

Open the Vercel URL in a browser (or ask the builder to open it). Verify:

1. The dashboard loads the dark institutional UI without errors — `#0A0A0A` background, monospace fonts visible
2. Navigate to Screen 2 (Live Monitor) — it must show either real payment records or an empty state message, not an error
3. Navigate to Screen 1 (Setup) — the npm install snippet must be visible
4. Open browser developer tools → Network tab → reload the page → confirm requests to the Railway URL return 200 status codes, not CORS errors

If CORS errors appear in the Network tab: the DASHBOARD_URL variable in Railway is incorrect. Double-check the exact Vercel URL matches the value entered in Railway, including the `https://` prefix and no trailing slash.

**Phase 4 is DONE when:**
- [ ] Dashboard loads at the Vercel URL without errors
- [ ] All 5 screens navigate correctly
- [ ] Network tab shows no CORS errors
- [ ] Requests to Railway return 200 status

**Write Prompt Log entry for Phase 4 before continuing.**

---

## Phase 5 — npm: Publish the Packages

> **Why this phase matters:** The npm packages are the primary distribution channel for ArcFlow. They are how a developer in Singapore installs the seller middleware without ever visiting a website. They are what gets linked in the grant application, the Arc House forum post, and the DM to Dispatch. Publishing to npm is what makes ArcFlow a real, installable product.

---

### Step 5.1 — Log In to npm from the Terminal

**[ANTIGRAVITY — except the verification step, which is YOU]**

> **Why:** npm publish requires an authenticated npm session in the terminal. Without this, the publish command will reject with an authentication error.

**[ANTIGRAVITY]** Run:
```bash
npm login
```

The terminal will open a browser window asking for npm credentials.

**[YOU]** When the browser opens:
1. Log in with your npm username and password
2. npm may ask for a one-time verification code sent to your email — check your email and enter the code
3. The browser will confirm you are logged in
4. Return to the terminal
5. Tell Antigravity: **"npm login is done"**

**[ANTIGRAVITY]** Confirm the login succeeded:
```bash
npm whoami
```
Expected output: `oracle100` — your confirmed npm username. If anything else is printed, or if an error appears, the login failed. Stop and retry `npm login` before continuing.

---

### Step 5.2 — Build and Publish @getarcflow/middleware

**[ANTIGRAVITY]**

> **Why:** The build step compiles TypeScript to JavaScript so the package works for any developer regardless of whether they use TypeScript. Publishing without building would produce a package that throws import errors immediately. The `--access public` flag is required because npm treats packages with a `@scope/` prefix as private by default — without this flag, the publish succeeds but nobody can install it.

```bash
cd /Users/orcl/Documents/arcflow/packages/middleware
npm run build
npm publish --access public
```

Expected output includes a line like:
```
+ @getarcflow/middleware@0.1.0
```

If the publish fails with "403 Forbidden": confirm you are logged in as `oracle100` by running `npm whoami`. The `@getarcflow` org is owned by `oracle100` — if a different user is logged in, run `npm login` first and authenticate as `oracle100`.

**DONE when:** `https://www.npmjs.com/package/@getarcflow/middleware` exists and shows version 0.1.0.

---

### Step 5.3 — Build and Publish @getarcflow/client

**[ANTIGRAVITY]**

> **Why:** Same reasoning as Step 5.2. Both packages must be published for the product to be complete — the seller middleware is useless without a buyer client SDK, and vice versa.

```bash
cd /Users/orcl/Documents/arcflow/packages/client
npm run build
npm publish --access public
```

**DONE when:** `https://www.npmjs.com/package/@getarcflow/client` exists and shows version 0.1.0.

---

### Step 5.4 — Update READMEs with Live URLs

**[ANTIGRAVITY]**

> **Why:** The npm package READMEs are the first thing a developer reads after finding the package. They must contain the live dashboard URL and the live demo endpoint URL — not localhost references. A README that points to localhost tells every developer "this is a prototype, not a real product."

Update both package READMEs to replace any localhost references with:
- Dashboard URL: the Vercel URL from Phase 4
- Demo endpoint: `https://[RAILWAY_URL]/api/demo/summary`
- Backend URL: the Railway URL from Phase 3

Commit and push the updated READMEs:
```bash
cd /Users/orcl/Documents/arcflow
git add .
git commit -m "docs: update READMEs with live production URLs"
git push
```

**Phase 5 is DONE when:**
- [ ] `npm install @getarcflow/middleware` works from any machine
- [ ] `npm install @getarcflow/client` works from any machine
- [ ] Both npm pages show version 0.1.0 with complete README
- [ ] READMEs contain live URLs, not localhost

**Write Prompt Log entry for Phase 5 before continuing.**

---

## Phase 6 — Clean Machine Test

> **Why this phase matters:** Every test so far has run on the same machine that built ArcFlow. That machine has all the right dependencies, environment variables, and context. The clean machine test proves that a developer who has never heard of ArcFlow can install and use it in under 30 minutes with only the README. If this test fails, a stranger will also fail — and they will not send a bug report, they will just leave. This is the final quality gate before the product reaches real users.

---

### Step 6.1 — Create a Fresh Test Project

**[ANTIGRAVITY]**

> **Why:** Testing in the existing arcflow folder does not prove anything — those folders already have all the right files. The test must happen in a completely fresh folder that has never seen ArcFlow.

```bash
cd /tmp
mkdir arcflow-integration-test
cd arcflow-integration-test
npm init -y
```

---

### Step 6.2 — Install and Test the Seller Middleware

**[ANTIGRAVITY]**

> **Why:** This is the test that answers: "Can a developer who found ArcFlow on npm use it in under 30 minutes?" If it takes more than 30 minutes, the README is incomplete.

```bash
npm install @getarcflow/middleware
```

Create a minimal test server using only the README instructions — no knowledge from the build process:

```javascript
// test-server.js
const express = require('express');
const { withArcFlow } = require('@getarcflow/middleware');

const app = express();

const handler = (req, res) => {
  res.json({ message: 'Payment accepted. Here is your data.', timestamp: new Date() });
};

app.get('/api/test', withArcFlow(handler, {
  price: '0.001',
  wallet: process.env.TEST_WALLET,
  apiKey: 'test-mode'
}));

app.listen(3001, () => console.log('Test server running on port 3001'));
```

Start the server and test it:
```bash
node test-server.js &
curl http://localhost:3001/api/test
```

Expected: HTTP 402 response with a valid payment challenge JSON. If this fails, the package is broken. Fix and republish before continuing.

---

### Step 6.3 — Install and Test the Buyer Client SDK

**[ANTIGRAVITY]**

> **Why:** Proving the seller middleware works is only half the test. The full product value depends on both packages working together, as a stranger would use them.

```bash
npm install @getarcflow/client
```

Run a payment against the test server using only the README instructions:

```javascript
// test-agent.mjs
import { ArcFlowClient } from '@getarcflow/client';

const arcflow = new ArcFlowClient({
  privateKey: process.env.TEST_PRIVATE_KEY,
  network: 'arcTestnet'
});

const result = await arcflow.fetch('http://localhost:3001/api/test');
const data = await result.json();
console.log('Payment succeeded:', data);
```

Expected: `Payment succeeded: { message: "Payment accepted...", timestamp: "..." }` — no errors.

---

### Step 6.4 — Test the Demo Endpoint on Arc Testnet

**[ANTIGRAVITY]**

> **Why:** This is the ultimate clean-machine test. It proves that a developer who installs the client SDK can pay for a real ArcFlow-protected endpoint on Arc testnet, with a real transaction recorded in the production database.

```bash
node --input-type=module << 'EOF'
import { ArcFlowClient } from '@getarcflow/client';

const arcflow = new ArcFlowClient({
  privateKey: process.env.TEST_PRIVATE_KEY,
  network: 'arcTestnet'
});

const result = await arcflow.fetch('https://[RAILWAY_URL]/api/demo/summary', {
  method: 'POST',
  body: JSON.stringify({ text: 'ArcFlow makes nanopayments simple for AI agents.' })
});

const data = await result.json();
console.log('Live demo payment result:', JSON.stringify(data, null, 2));
EOF
```

Expected: JSON response with word count and character count. Simultaneously, check the Railway dashboard or call `/payments` endpoint to confirm the transaction was logged.

**Phase 6 is DONE when:**
- [ ] `npm install @getarcflow/middleware` works in a fresh folder
- [ ] `npm install @getarcflow/client` works in a fresh folder
- [ ] HTTP 402 is returned by a fresh middleware install with no extra setup
- [ ] `arcflow.fetch()` completes a payment against the live demo endpoint on Arc testnet
- [ ] The payment appears in the production SQLite database on Railway

**Write Prompt Log entry for Phase 6 before continuing.**

---

## Phase 7 — First External User

> **Why this phase matters:** Everything before this was internal. Phase 7 is the moment the product gets tested by someone with no context, no patience for broken things, and no obligation to report what went wrong. The first real user is not a metric — it is proof that the product exists in the world, not just on your machine.

---

### Step 7.1 — Create the Outreach Package

**[ANTIGRAVITY]**

> **Why:** The first external user is Dispatch (@wyckoffweb on X) — the builder of an AI agent marketplace already live on Arc testnet. Their agents make API calls that need exactly what ArcFlow provides. The outreach must be specific enough to show that ArcFlow was built for exactly their use case, not a generic product announcement.

Create a document at `docs/OUTREACH_DISPATCH.md` with three things:

**A.** A short DM draft (under 200 words) that:
- Names one specific technical pain Dispatch agents experience when paying for APIs today
- Describes what ArcFlow does in one sentence
- Provides the npm install command, live dashboard URL, and live demo endpoint
- Ends with a single clear question: "Would it be useful if your agents could pay for tools with one line?"

**B.** A demo script (3 commands) that Dispatch can copy-paste to test ArcFlow against the live demo endpoint with their own agent

**C.** A content thread outline (for X) — 6 posts structured as:
1. "I tried to use Circle's own nanopayments demo to paywall a real API. Here's exactly where it breaks." (the validation story)
2. "So I built the missing piece." (introduce ArcFlow)
3. "Seller side: 3 lines. No Docker. No Supabase." (code snippet + result)
4. "Buyer side: one line. No clock sync errors." (code snippet + result)
5. "Live now on Arc testnet. Demo endpoint anyone can test." (Railway URL + npm links)
6. "Built this in Lagos using only AI tools. The agentic payment layer for Arc is open." (CTA to Arc House + GitHub)

**DONE when:** `docs/OUTREACH_DISPATCH.md` exists with all three sections complete.

---

### Step 7.2 — Send the Outreach

**[YOU]**

> **Why:** Antigravity cannot send messages on X. This step is yours.

1. Go to `https://x.com` and log in
2. Search for `@wyckoffweb`
3. Click **Message**
4. Copy the DM draft from `docs/OUTREACH_DISPATCH.md` (Antigravity will show it to you)
5. Read it once to make sure it sounds like you wrote it, not a template
6. Send it
7. Tell Antigravity: **"DM sent"**

**DONE when:** The DM is sent.

---

### Step 7.3 — Post the Content Thread

**[YOU]**

> **Why:** The content thread does three things simultaneously: it earns points in the Arc House Architects program (written content, builder story), it signals to Circle's grant team that you shipped something real, and it makes ArcFlow discoverable to developers who are not yet in your network.

1. Go to `https://x.com` and log in
2. Draft the 6-post thread from `docs/OUTREACH_DISPATCH.md`
3. Post Post 1 first. Then reply to it with Post 2. Continue replying to create a thread.
4. After posting the full thread, cross-post the link to:
   - Arc House forum (`https://community.arc.network`) as a new post titled "I built the missing middleware layer for Arc nanopayments"
   - Tag `@circle` and `@arc` in the X thread

**DONE when:** The thread is live on X and the forum post is live on Arc House.

---

## Definition of Done — Full Deployment Complete

All items below must be simultaneously true before this brief is considered complete.

**Phase 1 — Testnet Validation**
- [ ] Four friction points confirmed solved on Arc testnet with no manual workarounds
- [ ] No `authorization_validity_too_short` errors in any test
- [ ] No `node_modules` patching at any point

**Phase 2 — Pre-Deployment**
- [ ] `docs/ENV_VARIABLES.md` documents every environment variable
- [ ] CORS configured and reads `DASHBOARD_URL` from environment
- [ ] Demo endpoint `/api/demo/summary` works and is documented
- [ ] `railway.toml` exists and reads PORT from environment
- [ ] `vercel.json` exists with routing configured
- [ ] npm packages have all required `package.json` fields and `.npmignore`
- [ ] Code is on GitHub in a public repository

**Phase 3 — Backend**
- [ ] `https://[RAILWAY_URL]/health` returns live Arc block number
- [ ] SQLite volume attached at `/data`
- [ ] All environment variables set in Railway

**Phase 4 — Dashboard**
- [ ] Dashboard loads at Vercel URL without errors
- [ ] All 5 screens work with live data
- [ ] Zero CORS errors in browser Network tab

**Phase 5 — npm Packages**
- [ ] `npm install @getarcflow/middleware` works from any machine
- [ ] `npm install @getarcflow/client` works from any machine
- [ ] Both packages on npmjs.com with complete READMEs and live URLs

**Phase 6 — Clean Machine Test**
- [ ] Full payment cycle completed from a fresh folder with no prior ArcFlow context
- [ ] Transaction appears in production database on Railway

**Phase 7 — First External User**
- [ ] DM sent to @wyckoffweb
- [ ] Content thread live on X
- [ ] Forum post live on Arc House

---

## Documentation Log

Use the same Decision Log, Change Log, and Prompt Log formats from the Build Brief. Every phase ends with a Prompt Log entry written by Antigravity.

---

## What Antigravity Does at the Start of Every Session

1. Read this document from top to bottom
2. Read `docs/DECISION_LOG.md`, `docs/CHANGE_LOG.md`, `docs/PROMPT_LOG.md` to know current state
3. Check the Definition of Done above and identify which items are still unchecked
4. Work only on the next incomplete phase
5. At the end of the session: write Prompt Log entries for everything completed
6. Never end a session without confirming which Phase items are now checked

---

## First Prompt to Paste into Antigravity

Copy and paste this exactly as your opening message in Antigravity:

---

> I have finished building ArcFlow locally. We are now in the deployment phase. I have a deployment brief that tells us exactly what to do, phase by phase. The brief is the only source of truth — do not make assumptions outside it.
>
> **Before reading anything else, do this security check first:**
> 1. Scan the entire `/Users/orcl/Documents/arcflow/` folder recursively for any file containing the words `PRIVATE_KEY`, `privateKey`, or `private_key`
> 2. Scan the same folder for any `.env` or `.env.local` files
> 3. Confirm that a `.gitignore` file exists at `/Users/orcl/Documents/arcflow/.gitignore`
> 4. Show me the current contents of `.gitignore` and confirm it includes at minimum these entries: `.env`, `.env.local`, `data/`, `*.db`, `*.key`, and any pattern matching files containing private keys
> 5. If `.gitignore` is missing any of those entries, add them now before doing anything else
> 6. Tell me explicitly: "Security check complete. The following sensitive files exist but are protected by .gitignore: [list them]. No sensitive files will be included in the GitHub push."
> 7. Only after confirming this, proceed to the rest of this prompt
>
> **Confirmed account details — use these throughout every phase, no need to create new accounts:**
> - GitHub username: `ooracle100` — profile at `https://github.com/ooracle100`
> - Railway: connected via GitHub account `ooracle100`
> - Vercel: connected via GitHub account `ooracle100` — existing projects are `dvn-intelligence` and `0gm-counter-app`, ArcFlow will be a new third project
> - npm username: `oracle100` — profile at `https://www.npmjs.com/~oracle100`
> - npm org: `@getarcflow` — created and owned by `oracle100`. Package names are `@getarcflow/middleware` and `@getarcflow/client`. No fallback needed.
>
> **Testnet wallet:** Already funded with USDC, EURC, and cirBTC from the Circle faucet. The builder will provide the wallet address when Phase 1 Step 1.2 requires it.
>
> **Now do these three things:**
> 1. Read the full deployment brief I am about to paste
> 2. Read `docs/DECISION_LOG.md`, `docs/CHANGE_LOG.md`, and `docs/PROMPT_LOG.md` in `/Users/orcl/Documents/arcflow/` to understand the current state of the build
> 3. Tell me: which Definition of Done items from the Build Brief are already complete, and which are not — so we know exactly where we stand before Phase 1 begins
>
> Once you have read everything, start Phase 1. Tell me clearly every time you need me to do something manually, what to do, and when to come back to you.
>
> Here is the full deployment brief:
> [paste the entire ARCFLOW_DEPLOYMENT_BRIEF_v1_0.md here]

---

*This document is the single source of truth for the ArcFlow deployment.*
*Phases run in order. No phase is skipped. Every session ends with a Prompt Log entry.*
*The product is not live until every item in the Definition of Done is checked.*
