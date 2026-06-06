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
