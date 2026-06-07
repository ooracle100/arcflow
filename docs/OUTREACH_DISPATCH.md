# Dispatch Outreach & Launch Thread

## A. Direct Message Draft (@wyckoffweb)

Hey Dispatch team. I love the agent marketplace you've built on Arc testnet. I noticed a core friction point: when your agents need to call external, paid APIs, they either hit paywalls or require the user to pre-fund accounts using clunky credit cards because traditional APIs don't speak web3.

I built ArcFlow to fix this. It’s an open-source middleware that lets any traditional API accept streaming USDC nanopayments on Arc in just 3 lines of code.

You can drop this right into your agents today:
`npm install @getarcflow/client`

Manage APIs: https://arcflow-dashboard.vercel.app
Live Demo Endpoint: https://getarcflowbackend-production.up.railway.app/api/demo/summary

Would it be useful if your agents could pay for tools with one line?

---

## B. Demo Script for Dispatch

Tell them they can copy-paste this to instantly test ArcFlow with their own agents on Arc testnet:

```bash
# 1. Install the client
npm install @getarcflow/client
```

```javascript
// 2. Create test.mjs
import { ArcFlowClient } from '@getarcflow/client';

const arcflow = new ArcFlowClient({ 
  // Drop your funded testnet private key here
  privateKey: 'YOUR_TESTNET_PRIVATE_KEY' 
});

// 3. Run a payment against the live demo
const result = await arcflow.fetch('https://getarcflowbackend-production.up.railway.app/api/demo/summary');
console.log(await result.json());
```

---

## C. Launch Content Thread (X/Twitter)

**Post 1:**
I tried to use Circle's own nanopayments demo to paywall a real API. Here's exactly where it breaks: clock sync drift, authorization timeouts, and complex off-chain handshakes that make it unusable for production autonomous agents.

**Post 2:**
So I built the missing piece. Introducing ArcFlow: the agentic payment layer for the Arc network. It bridges the gap between web2 APIs and web3 wallets using HTTP 402 Payment Required standards.

**Post 3:**
Seller side: 3 lines of code. No Docker. No Supabase. You just wrap your existing Express route and ArcFlow handles the cryptographic verification and on-chain settlement automatically.
[Attach screenshot of `withArcFlow` code snippet]

**Post 4:**
Buyer side: 1 line of code. No clock sync errors. You just swap out `fetch` for `arcflow.fetch`. If it hits a paywall, the SDK negotiates the price, signs the transaction, and gets the data without breaking the agent's workflow.
[Attach screenshot of the client SDK snippet]

**Post 5:**
Live now on Arc testnet. I built a live demo endpoint anyone can test right now. 
SDKs: `npm install @getarcflow/middleware`
Dashboard: https://arcflow-dashboard.vercel.app 
Docs: https://github.com/ooracle100/arcflow

**Post 6:**
Built this from Lagos using only AI tools (Claude & Gemini). The agentic payment layer for Arc is officially open. If you're building in the Arc House Architects program, let's connect.
[Link to GitHub repo]
