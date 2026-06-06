# ArcFlow Technical Validation Findings & Product Specification

**Objective:** Validate Circle's `arc-nanopayments` reference implementation to identify technical friction, permission constraints, and required UX improvements for building **ArcFlow**, a no-code payment layer for agents.

**Date:** May 15, 2026
**Environment:** Next.js (Seller), Node.js (Buyer Agent), Local Supabase, Circle Gateway Testnet (`arcTestnet`).

---

## 1. Validation Results (The Friction)

During the exercise, we successfully paywalled an API endpoint (`/api/custom/weather`) and consumed it with an agent script using the `@circle-fin/x402-batching` SDK. However, several critical technical and UX friction points emerged:

### Friction Point 1: Gateway Clock Sync (The "authorization_validity_too_short" Error)
- **What happened:** The most significant blocker encountered was the `authorization_validity_too_short` error when verifying signatures.
- **Why it happened:** The Circle Gateway API requires time-bound signatures (TransferWithAuthorization) using `validAfter` and `validBefore`. If a local agent running the SDK has a skewed system clock—or in our case, if the dev environment timestamp drastically differs from the server's expected timestamp—the signatures are rejected as invalid because they haven't started or already expired from the Gateway's perspective.
- **The Workaround:** We had to patch the SDK directly in `node_modules` to set `validAfter: "0"` and an extremely large `validBefore` to force the signatures to be unconditionally accepted regardless of the local machine time.
- **ArcFlow Implication:** Agent developers cannot be expected to maintain perfect clock sync or debug complex EIP-712 timestamp failures. ArcFlow must abstract this timing requirement, potentially offering a centralized signing relayer, or patching the client SDK we distribute to handle time skews seamlessly.

### Friction Point 2: Environment Complexity & DB Dependency
- **What happened:** To run the seller application, we had to install Docker, pull 13 images, and boot a full local Supabase Postgres instance just to track nonces and micropayment statuses.
- **ArcFlow Implication:** We cannot ask API providers to run Postgres or Supabase to use our payment layer. ArcFlow **must** be a completely hosted SaaS or a stateless reverse proxy where *we* run the database and the API provider simply adds a middleware or routes their traffic through us.

### Friction Point 3: Key Management & Funding
- **What happened:** The agent script needed a funded ephemeral key. It required passing around private keys in `.env` files and executing a complex two-step funding process (transfer USDC/Gas -> deposit to Gateway Wallet) before making a single API call.
- **ArcFlow Implication:** If an AI agent wants to buy data, managing private keys and depositing to the Circle Gateway is too complex. ArcFlow needs an "Agent Wallet SDK" that auto-funds or uses a pre-paid "ArcFlow Credits" balance that abstracts the underlying blockchain entirely from the agent script.

### Friction Point 4: Strict Header Payload Complexity
- **What happened:** The HTTP 402 implementation requires parsing a complex Base64-encoded `PAYMENT-REQUIRED` header, finding the matching network, extracting `verifyingContract`, and signing a typed data object perfectly. If `maxTimeoutSeconds` or other config is missing, it crashes the SDK (`Cannot convert NaN to a BigInt`).
- **ArcFlow Implication:** A generic `fetch` wrapper is required. Agents should only need to write `const res = await arcflow.fetch("url")` and the wrapper handles all 402 negotiation, header extraction, signing, and retries.

---

## 2. Product Specification for ArcFlow

Based on the validated friction, **ArcFlow** must be built as a two-sided platform that completely abstracts the `arc-nanopayments` architecture.

### For API Providers (Sellers)
**The Goal:** Paywall an endpoint in < 3 minutes without touching a database or smart contract.
- **Architecture:** ArcFlow acts as a Reverse Proxy Gateway or a stateless Next.js Middleware. 
- **The Spec:**
  1. API Provider registers on the ArcFlow dashboard and links their USDC receiving address.
  2. They receive an `ARCFLOW_API_KEY`.
  3. They wrap their endpoint: `export const GET = withArcFlow(handler, { price: "$0.05" })`.
  4. **Crucial Change:** The `withArcFlow` middleware does NOT connect to a local database. It offloads verification and nonce tracking to the ArcFlow SaaS backend via a fast REST call. This removes the Supabase/Docker requirement for sellers.

### For AI Agents (Buyers)
**The Goal:** Give an agent a budget and let it seamlessly pay for 402 endpoints without managing EIP-712 signatures, nonces, or clock synchronization.
- **Architecture:** A lightweight SDK `arcflow-client` that wraps standard fetch/axios.
- **The Spec:**
  1. `const arcflow = new ArcFlowClient({ apiKey: "..." })`
  2. The agent calls `arcflow.fetch(url)`.
  3. The SDK intercepts the 402. It communicates with the ArcFlow SaaS backend to generate the proper signature (bypassing the `authorization_validity_too_short` clock sync bug by handling time perfectly on the server side), or it uses a seamlessly pre-funded abstraction.
  4. The request succeeds in one line of code.

### Platform Economics
- Sellers get paid directly in USDC via the Circle Gateway batched settlement.
- ArcFlow can inject a configurable fee (e.g., 2%) into the payment requirements, charging the buyer slightly more or deducting from the seller.

---

## 3. Conclusion & Next Steps

The `arc-nanopayments` reference implementation works perfectly at the protocol level but is far too heavy and brittle for mainstream AI developer adoption. By building **ArcFlow** to abstract the database requirements, clock synchronization bugs, and key management, we have a clear path to building the "Stripe for AI Agents."

**Decision:** The validation is a success. We are ready to proceed with building the ArcFlow SaaS Platform based on this specification.
