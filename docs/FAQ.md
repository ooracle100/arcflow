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

### Q: Who exactly are the Sellers and Buyers in the ArcFlow ecosystem?
**A:** You have it exactly right.
- **The Seller:** Any business or developer that provides an API (e.g., a Weather API, a Financial Data API, an LLM) and wants to get paid instantly per-request instead of dealing with monthly credit card subscriptions and Stripe fees.
- **The Buyer:** An autonomous AI Agent that is out on the internet doing tasks. When the agent needs data to complete its task, it acts as the buyer, paying the Seller API instantly using its own crypto wallet.

### Q: Why do things like "clock sync drift" and "complex off-chain handshakes" matter?
**A:** Because they are the invisible hurdles that make blockchain micropayments crash constantly in the real world.
- **Clock Sync Drift:** Blockchains only accept cryptographic signatures if they are generated within a strict time window (e.g., within 30 seconds). If an AI Agent is running on a server where the internal clock is just 1.5 seconds out of sync with the Arc blockchain's clock, the blockchain rejects the payment as "expired." ArcFlow automatically calculates this mismatch and adjusts the signature's timestamps so it never fails.
- **Complex off-chain handshakes:** To do a nanopayment, the agent and the server have to negotiate: *"I want data" -> "It costs 0.05 USDC" -> "Here is my signature for 0.05" -> "Signature verified, here is data."* Developers normally have to code this dance manually. ArcFlow automates the entire handshake in one line of code.

### Q: If Machine-to-Machine (M2M) Micropayments were built to solve paywalls, why do we still talk about "hitting paywalls"?
**A:** Excellent point! M2M payments *do* solve the paywall, but the paywall itself still technically exists—it just becomes **invisible**.
- **Before ArcFlow:** An agent hits a paywall, crashes, and throws a "Please enter a credit card" error. The human has to wake up, log in, and pay.
- **With ArcFlow (M2M):** The agent hits the paywall, instantly reads the digital price tag, mathematically negotiates the payment, pays it using its own crypto wallet, and breaches the paywall in 300 milliseconds.
We still talk about paywalls because the API is still protected (the seller still demands money), but ArcFlow gives the agent the superpower to seamlessly unlock it without human intervention.
