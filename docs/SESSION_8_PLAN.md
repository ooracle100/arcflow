# Session 8: End-to-End Test and Package

Yes, Session 8 is the final active development session! (Session 9 is simply a buffer phase reserved for fixing anything that might have broken in Session 8, ensuring the MVP definition of done is met).

This session focuses on preparing the SDKs for distribution and proving that the entire system works flawlessly together on the live Arc testnet.

## Proposed Changes

### 1. Package Documentation

We need to provide the 3-line integration guides as promised so developers can easily adopt the protocol.

#### [NEW] [packages/middleware/README.md](file:///Users/orcl/Documents/arcflow/packages/middleware/README.md)
- Write a concise guide explaining how a developer (seller) installs `@arcflow/middleware` and wraps an Express endpoint using `withArcFlow(cost)`.

#### [NEW] [packages/client/README.md](file:///Users/orcl/Documents/arcflow/packages/client/README.md)
- Write a concise guide explaining how an AI Agent developer (buyer) installs `@arcflow/client`, initializes it with a private key, and uses the drop-in `arcflow.fetch()` replacement to seamlessly bypass 402 paywalls.

### 2. End-to-End Simulation Environment

To prove the system works, we will build an automated E2E test harness. This will simulate a completely independent "Merchant" server and a separate "AI Buyer" script interacting over the network, settling payments through the ArcFlow backend.

#### [NEW] [e2e-test/package.json](file:///Users/orcl/Documents/arcflow/e2e-test/package.json)
- A fresh, independent test package using `express`, `@arcflow/middleware` (via workspace link), and `@arcflow/client` (via workspace link).

#### [NEW] [e2e-test/server.ts](file:///Users/orcl/Documents/arcflow/e2e-test/server.ts)
- A simple Express server running on port **5000**.
- Exposes an endpoint `POST /api/generate-image` protected by `withArcFlow(0.01)`.
- Returns a dummy image URL when a valid payment is verified.

#### [NEW] [e2e-test/client.ts](file:///Users/orcl/Documents/arcflow/e2e-test/client.ts)
- Instantiates the `ArcFlowClient` using a testnet private key with funded ARC.
- Uses `arcflow.fetch('http://localhost:5000/api/generate-image')` to call the merchant.
- Validates that it successfully receives the image payload despite the 402 challenge.

#### [NEW] [e2e-test/run.sh](file:///Users/orcl/Documents/arcflow/e2e-test/run.sh)
- The orchestrator script to run the full simulation:
  1. Starts the ArcFlow backend (`localhost:3000`) in the background.
  2. Starts the test Merchant server (`localhost:5000`) in the background.
  3. Executes the AI Buyer `client.ts` script.
  4. Waits 3 seconds for the payment to settle into SQLite.
  5. Queries `localhost:3000/api/payments` to ensure the new transaction appears.
  6. Shuts down the background processes and prints `SUCCESS`.

## Open Questions
None. The build brief strictly defines the success criteria for Session 8 as the completion of this exact E2E flow.

## Verification Plan
We will execute `bash e2e-test/run.sh`. 
If it succeeds, prints the transaction, and shuts down cleanly, we have proven the ArcFlow nanopayment cycle works on the live blockchain!
