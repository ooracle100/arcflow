# ArcFlow Decision Log

All architectural decisions logged here. Every entry requires a date, the deciding agent, and reasoning.

---

## DECISION LOG 001
Date:                   2026-05-20
Agent:                  Antigravity (Claude Opus 4.6)
Component:              constants.ts — Arc testnet addresses
Decision:               Use the following verified addresses from @circle-fin/x402-batching SDK v1.x:
                        - Chain ID: 5042002 (NOT 2088 as stated in the build brief — brief was incorrect)
                        - USDC: 0x3600000000000000000000000000000000000000 (precompile address unique to Arc)
                        - Gateway Wallet: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9 (shared across all testnets)
                        - Gateway Minter: 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B (shared across all testnets)
                        - Gateway API: https://gateway-api-testnet.circle.com/v1
                        - RPC Primary: https://rpc.testnet.arc.network
                        - RPC Fallback 1: https://rpc.quicknode.testnet.arc.network
                        - RPC Fallback 2: https://rpc.blockdaemon.testnet.arc.network
Alternatives considered: Using the placeholder 2088 chain ID from the build brief. Rejected because
                        viem/chains/definitions/arcTestnet.ts confirms 5042002 as the actual chain ID.
Reasoning:              SDK source code is the canonical truth. These addresses were also validated in the
                        May 15 exercise — payments succeeded using them.
Impact:                 All EIP-155 network identifiers will use eip155:5042002. Mainnet chain ID is still
                        unknown (no Arc mainnet chain config exists in the SDK yet).
Approved by:            Product Owner (pending review)

---

## DECISION LOG 002
Date:                   2026-05-20
Agent:                  Antigravity (Claude Opus 4.6)
Component:              Project scaffold — monorepo tooling
Decision:               Use pnpm workspaces for monorepo management.
Alternatives considered: npm workspaces (slower, less reliable), Turborepo (overkill for 4 packages),
                        Lerna (deprecated ecosystem).
Reasoning:              pnpm workspaces is zero-config beyond a pnpm-workspace.yaml file. No extra
                        dependencies. Clean cross-package resolution. The project has 4 packages
                        (middleware, client, backend, dashboard) that need shared TypeScript config.
Impact:                 All packages share a root tsconfig.json. Individual packages extend it.
                        `pnpm install` from root installs everything.
Approved by:            Product Owner (pending review)

---

## DECISION LOG 003
Date:                   2026-05-20
Agent:                  Antigravity (Claude Opus 4.6)
Component:              Arc mainnet configuration
Decision:               Leave mainnet chain ID, USDC address, and Gateway addresses as explicit TODOs.
                        No Arc mainnet chain exists in viem or Circle's SDK yet.
Alternatives considered: Using the brief's placeholder chain ID of 1234. Rejected — better to fail loudly
                        at compile time than silently use wrong addresses.
Reasoning:              Arc mainnet doesn't exist yet. The SDK only defines arcTestnet. When mainnet
                        launches, we update constants.ts and log it as a decision.
Impact:                 Mainnet deployment is blocked until Circle publishes Arc mainnet addresses. This is
                        expected and correct for a testnet-first build.
Approved by:            Product Owner (pending review)

---

## DECISION LOG 004
Date:                   2026-05-24
Agent:                  Antigravity (Claude Opus 4.6)
Component:              pnpm workspace build approvals (allowBuilds)
Decision:               Migrate built-in dependency approvals to `allowBuilds` in `pnpm-workspace.yaml`.
Alternatives considered: Running interactive `pnpm approve-builds` commands. Rejected because it blocks
                        non-interactive builds and headless CI runners.
Reasoning:              pnpm v11 has deprecated `onlyBuiltDependencies` in `package.json` and `.npmrc`
                        for dependency scripts, enforcing the new YAML-based `allowBuilds` map in
                        `pnpm-workspace.yaml`. Explicitly setting `better-sqlite3: true` and `esbuild: true`
                        resolves this cleanly.
Impact:                 Enables flawless, non-interactive installations and compilation of binary modules
                        globally across the monorepo workspace.
Approved by:    Product Owner (pending review)

---

## DECISION LOG 005
Date:                   2026-06-04
Agent:                  Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:              backend/src/routes/payments.ts — Settlement endpoint
Decision:               Trust the middleware-forwarded memo and requirements for payment logging.
                        Verify only that the memo's amount and wallet match the requirements, then
                        log directly to SQLite. No on-chain transaction verification at this stage.
Alternatives considered: Full on-chain tx_hash verification before logging. Rejected because the
                        middleware already performs cryptographic EIP-712 signature recovery and the
                        Circle Gateway handles actual settlement. On-chain verification will be added
                        in Session 7 (reconciliation).
Reasoning:              The middleware is the trust boundary. It verifies the EIP-712 signature
                        cryptographically before forwarding to the backend. Adding redundant on-chain
                        checks would add latency and RPC cost without meaningful security gain at
                        this stage.
Impact:                 Payment records are logged with status 'confirmed' immediately. The tx_hash
                        field is null until the reconciliation engine fills it in Session 7.
Approved by:            Product Owner (pending review)

---

## DECISION LOG 006
Date:                   2026-06-04
Agent:                  Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:              backend/src/webhooks/queue.ts — Retry strategy
Decision:               Use a 5-second polling interval with exponential backoff (2^attempts seconds)
                        and a maximum of 5 attempts before marking as 'failed'.
Alternatives considered: (1) Immediate retry with no backoff — rejected, would hammer failing endpoints.
                        (2) Message queue (BullMQ/Redis) — rejected, adds infrastructure complexity
                        that violates the "no Docker, no external deps" constraint.
Reasoning:              SQLite-backed polling is simple, crash-resilient, and sufficient for MVP
                        webhook volumes. The backoff schedule (2s, 4s, 8s, 16s, 32s) gives endpoints
                        ~62 seconds total to recover before giving up.
Impact:                 Webhook delivery is best-effort with guaranteed persistence. Failed webhooks
                        remain in the database for manual inspection or future retry.
Approved by:            Product Owner (pending review)

---

## DECISION LOG 007
Date:                   2026-06-06
Agent:                  Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:              backend/railway.toml — Builder configuration
Decision:               Remove `builder = "nixpacks"` line entirely. Let Railway use its default
                        Railpack builder, which correctly respects the buildCommand and startCommand
                        already defined in railway.toml.
Alternatives considered: (1) Keeping Nixpacks and adding a nixpacks.toml to force npm over pnpm —
                        rejected, adds unnecessary config. (2) Adding pnpm install to the Nixpacks
                        build plan — rejected, fragile and non-standard.
Reasoning:              Nixpacks detected the root-level pnpm-lock.yaml and attempted to use pnpm,
                        but pnpm was not available in the Nixpacks build environment. This caused a
                        hard build failure. Railpack handles the existing `buildCommand = "npm install
                        && npm run build"` correctly without any builder declaration.
Impact:                 Railway deployments now succeed. No functional change to the application.
Approved by:            Product Owner (pending review)

---

## DECISION LOG 008
Date:                   2026-06-06
Agent:                  Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:              backend/tsconfig.json — Monorepo isolation
Decision:               Remove `"extends": "../tsconfig.json"` and make the backend's tsconfig.json
                        fully self-contained. Set `module` and `moduleResolution` to `NodeNext`.
Alternatives considered: (1) Copying the root tsconfig.json into the backend folder during build —
                        rejected, adds a brittle build step. (2) Keeping the extends and including
                        the root tsconfig in Railway's build context — rejected, Railway only builds
                        the root directory (`backend/`), so parent files are unavailable.
Reasoning:              Railway sets the root directory to `backend/`, meaning the parent
                        `../tsconfig.json` does not exist in the build container. The extends
                        reference caused a hard TypeScript compilation failure. Making it
                        self-contained also ensures the backend can be built independently.
Impact:                 Backend builds succeed in isolation. `NodeNext` module resolution is required
                        for `import.meta.url` usage in `src/db/schema.ts`.
Approved by:            Product Owner (pending review)

---

## DECISION LOG 009
Date:                   2026-06-06
Agent:                  Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro)
Component:              backend/src/routes/demo.ts — Circular dependency removal
Decision:               Remove `import { withArcFlow } from '@getarcflow/middleware'` and reimplement
                        the 402 payment protection inline using the backend's own internal
                        `chain/gateway.ts` module.
Alternatives considered: (1) Adding @getarcflow/middleware as an npm dependency in backend/package.json
                        — rejected, creates a circular dependency (backend depends on middleware which
                        depends on backend for settlement). (2) Copying the middleware source into the
                        backend — rejected, code duplication with drift risk.
Reasoning:              The backend is the SaaS settlement authority. It should never depend on its
                        own published SDK packages. The demo endpoint only needs the 402 challenge
                        format and the internal settlement route, both of which are already available
                        within the backend's own codebase.
Impact:                 Zero files in `backend/src/` import from `@getarcflow/middleware` or
                        `@getarcflow/client`. The demo endpoint works identically but is self-contained.
Approved by:            Product Owner (pending review)
