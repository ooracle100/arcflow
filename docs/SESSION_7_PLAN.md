# Session 7: Dashboard — 5-Screen Financial Terminal UI

Build the ArcFlow monitoring dashboard as a **Vite SPA** (vanilla HTML/CSS/JS — no React) that connects to the backend API at `localhost:3000`. The dashboard runs on port **4000**.

## Design System

All colours, fonts, and tokens come directly from the build brief:

| Element | Value |
|---|---|
| Background | `#0A0A0A` |
| Surface (cards) | `#111111` |
| Accent — confirmed | `#00FF88` |
| Accent — warning | `#FF6B35` |
| Accent — info/links | `#4A9EFF` |
| Typography — data | JetBrains Mono (Google Fonts) |
| Typography — body | IBM Plex Sans (Google Fonts) |
| Borders | `#1E1E1E` |

## Architecture Decision: Vite SPA (No Framework)

> [!IMPORTANT]
> The build brief specifies the dashboard file structure as plain `index.html`, `app.ts`, `styles.css`, and 5 screen `.ts` files — not a Next.js or React project. We will honour this by using **Vite** in vanilla TS mode. Each screen is a module that exports a `render()` function returning an HTML string. `app.ts` handles client-side routing via hash navigation (`#setup`, `#monitor`, etc.). This keeps the project lightweight, framework-free, and true to the brief's file structure.

## Proposed Changes

### Vite & Package Setup

#### [MODIFY] [package.json](file:///Users/orcl/Documents/arcflow/dashboard/package.json)
- Add `vite` as a dev dependency.
- Update `dev` script to `vite --port 4000`.
- Update `build` script to `vite build`.
- Move `index.html` to the project root (Vite convention) and point the entry to `src/app.ts`.

---

### Design System & Layout

#### [MODIFY] [styles.css](file:///Users/orcl/Documents/arcflow/dashboard/src/styles.css)
Full CSS design system implementing the dark institutional aesthetic:
- CSS custom properties for all tokens (colours, spacing, fonts).
- Global resets, scrollbar styling, typography.
- Card, table, nav, badge, button, stat-card, and chart component styles.
- Responsive layout using CSS grid.
- Micro-animations (fade-in for screen transitions, pulse for live indicators).

#### [MODIFY] [index.html](file:///Users/orcl/Documents/arcflow/dashboard/src/index.html)
- Google Fonts links for JetBrains Mono and IBM Plex Sans.
- Sidebar navigation with 5 screen links (`#setup`, `#monitor`, `#reconcile`, `#agents`, `#billing`).
- `<main id="app">` container where screens render.
- `<script type="module" src="/src/app.ts">` entry point.

---

### Application Shell

#### [MODIFY] [app.ts](file:///Users/orcl/Documents/arcflow/dashboard/src/app.ts)
- Hash-based router: listens for `hashchange`, maps `#screen` to the correct screen module's `render()` function.
- Shared `apiFetch(path)` helper that wraps `fetch('http://localhost:3000' + path)` and returns `data` from the standard response wrapper.
- Auto-refresh: the active screen's `render()` re-fires every 10 seconds for live data.
- Default route: `#monitor` (the live payment feed).

---

### Screen Implementations

#### [MODIFY] [setup.ts](file:///Users/orcl/Documents/arcflow/dashboard/src/screens/setup.ts) — Screen 1: Onboarding
- npm install code snippet with copy-to-clipboard button.
- 3-line `withArcFlow()` config example.
- Wallet connection status indicator (calls `/health` for RPC/DB status).
- Live 402 preview — shows an example JSON challenge payload.

#### [MODIFY] [monitor.ts](file:///Users/orcl/Documents/arcflow/dashboard/src/screens/monitor.ts) — Screen 2: Live Payment Feed
- Summary stat cards: Total Volume, Transaction Count, Fees Earned, Match Rate (calls `/api/stats` and `/api/reconcile`).
- Real-time payment table with rows from `/api/payments` (auto-refreshes via `app.ts` interval).
- 30-day daily volume bar chart rendered in inline SVG (from `/api/stats` `dailyVolume` array).
- Top Agents leaderboard sidebar (from `/api/stats` `topAgents`).
- Live indicator pulse dot.

#### [MODIFY] [reconcile.ts](file:///Users/orcl/Documents/arcflow/dashboard/src/screens/reconcile.ts) — Screen 3: Reconciliation
- Unmatched payments table from `/api/reconcile`.
- Match rate percentage badge.
- Match form: select a payment, enter `invoice_ref`, submit `POST /api/reconcile/match`.
- CSV export download button that opens `/api/export/csv` in a new tab.

#### [MODIFY] [agents.ts](file:///Users/orcl/Documents/arcflow/dashboard/src/screens/agents.ts) — Screen 4: Agent Monitor
- Agent list table from `/api/agents` (wallet, total spent, tx count, last seen).
- Click an agent row to expand and show their recent payment history from `/api/agents/:wallet`.
- Anomaly flag: highlight any agent whose single-transaction amount exceeds 2× their average.

#### [MODIFY] [billing.ts](file:///Users/orcl/Documents/arcflow/dashboard/src/screens/billing.ts) — Screen 5: ArcFlow Billing
- Current fee tier indicator (Free / Growth / Scale) based on total volume from `/api/stats`.
- Fee rate display and progress bar to next tier threshold.
- Fee history: total fees earned to date.
- Tier breakdown table showing the 3 tiers with limits and rates from the build brief.

---

## Open Questions

> [!NOTE]
> No blocking questions — the build brief fully specifies all 5 screens, the colour palette, and the API contract. Proceeding as described.

## Verification Plan

### Manual Verification
- Start backend: `cd backend && pnpm start`
- Start dashboard: `cd dashboard && pnpm dev`
- Open `http://localhost:4000` and verify:
  - Dashboard loads without console errors.
  - All 5 screens navigate via sidebar.
  - Monitor screen shows live data from SQLite (even if empty — it should show "No payments yet", not crash).
  - Reconciliation CSV export button triggers a file download.
  - Billing screen shows "Free" tier for zero volume.
  - No mock/placeholder data visible anywhere.
