# @arcflow/client

The buyer-side SDK for AI Agents to seamlessly pay for API access.

This package provides a drop-in replacement for the native `fetch` API. It automatically detects `402 Payment Required` challenges from ArcFlow-protected APIs, signs the requested payment using your agent's private key, and fulfills the request without any manual intervention.

## Installation

```bash
npm install @arcflow/client
```

## Usage

Initialize the client with your wallet's private key. Make sure your wallet is funded with USDC tokens on the Arc testnet.

```typescript
import { ArcFlowClient } from '@arcflow/client';

// Initialize the client
const arcflow = new ArcFlowClient({
  privateKey: process.env.AGENT_PRIVATE_KEY
});

async function runAgent() {
  // Use arcflow.fetch exactly like native fetch
  // It will automatically handle the payment negotiation under the hood
  const response = await arcflow.fetch('https://getarcflowbackend-production.up.railway.app/api/demo/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'A futuristic city' })
  });

  const data = await response.json();
  console.log('Result:', data);
}

runAgent();
```

## How it works

When you call `arcflow.fetch()`:
1. It sends the initial request.
2. If the API returns a standard `200 OK`, it returns the response immediately.
3. If the API returns a `402 Payment Required` with an ArcFlow `x402` payload, the SDK generates an EIP-712 cryptographic signature authorizing the payment.
4. It attaches the signature to the `x-arcflow-signature` header and retries the request automatically.
