# ArcFlow Frequently Asked Questions (FAQ)

This document captures critical product and architectural questions raised during the initial build and validation phases.

---

### Q: Where does the money actually come from when ArcFlow records a payment?
**A:** During development, we build on the Arc Testnet using "Testnet USDC", which is completely free and dispensed by a faucet. No real money was spent building ArcFlow.

However, when Arc Mainnet launches, the tokens will be real US Dollars. The payments come directly from the **crypto wallets of the autonomous agents** that are calling the API. 
When an agent developer (e.g., Dispatch) builds an agent, they fund that agent's wallet with USDC. When the agent hits an ArcFlow-protected API paywall, its internal logic signs a transaction authorizing the payment. The USDC is then moved directly from the Agent's wallet to the Seller's wallet on the blockchain.

### Q: How do developers building on Arc currently handle these payments without ArcFlow?
**A:** Because Arc is a brand-new ecosystem, the tooling is extremely raw. Right now, developers building on Arc handle payments in one of two ways:
1. **Building from scratch (The Hard Way):** Using Circle's raw `@circle-fin/x402-batching` SDK. This requires manually formatting base64 `x402` JSON headers, writing custom `viem` frontend logic for `EIP-712` signatures, building a custom settlement backend, and fighting complex "clock sync" errors. It takes weeks of work.
2. **Mocking payments (The Easy/Fake Way):** Giving up on true on-chain nanopayments entirely. Instead, they track "credits" in a traditional Web2 database (like Supabase) and fake the crypto aspect, hoping better tooling will emerge.

ArcFlow solves this by reducing a 3-week crypto-engineering task down to 3 lines of middleware for the seller and 1 line of SDK for the buyer.

### Q: What is the "Manual Match" tool in the Reconciliation Dashboard used for?
**A:** The Manual Match tool bridges the gap between Web3 blockchain payments and traditional Web2 corporate accounting.

When a payment settles on the blockchain via ArcFlow, it receives an ArcFlow Reference ID (e.g., `AF-20260607-E95659`). However, the API seller's company likely uses traditional accounting software (QuickBooks, Xero) with its own internal Invoice IDs (e.g., `INV-9942`).

If automated webhooks fail, or a client pays an invoice manually on-chain, the accountant is left with an `AF-...` payment on the blockchain and an unpaid `INV-...` in QuickBooks. The Manual Match tool allows the accountant to paste both IDs and link them together, permanently proving to auditors that a specific traditional invoice was paid by a specific cryptographic transaction.

### Q: How does ArcFlow simplify debugging compared to the raw Circle SDK?
**A:** ArcFlow introduces several developer experience (DX) improvements:
- **Specific Error Codes:** Returns readable errors like `MISSING_PARAMETERS` or `InvalidAddressError` instead of silent failures or generic 500s.
- **Automatic Clock Sync:** The client automatically calculates the time offset between the buyer's machine and the Arc blockchain, eliminating the `#1` cause of signature verification failures.
- **Persistent Logging:** All failed webhooks and payment attempts are preserved in the backend SQLite database for inspection.
