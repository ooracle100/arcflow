# @arcflow/middleware

Turn any Express API endpoint into a nanopayment-powered paywall in 3 lines of code.

This package provides the seller-side (merchant) middleware for the ArcFlow network. It enforces that incoming requests carry a cryptographically valid EIP-712 payment signature settling on the Arc network before allowing the request to proceed.

## Installation

```bash
npm install @arcflow/middleware
```

## Usage

Simply wrap any existing Express route handler with `withArcFlow(costInARC)`.

```typescript
import express from 'express';
import { withArcFlow } from '@arcflow/middleware';

const app = express();
app.use(express.json());

// Require 0.5 ARC to generate an image
app.post('/api/generate-image', withArcFlow(async (req, res) => {
  // If this code runs, the payment has been verified mathematically.
  // The ArcFlow backend will automatically sweep the funds on-chain.
  
  res.json({
    success: true,
    url: 'https://example.com/generated-image.png'
  });
}, {
  price: '0.5',
  wallet: '0x2420F3440508DFAb40369F8da3EE20eBfcCdB707',
  apiKey: 'af_test_123',
  backendUrl: 'http://localhost:3000'
}));

app.listen(3000, () => console.log('API running!'));
```

## How it works

1. When a client calls `/api/generate-image` without a payment, the middleware intercepts it and returns an HTTP `402 Payment Required` challenge.
2. The client SDK (`@arcflow/client`) intercepts the 402, automatically signs a microtransaction for 0.5 ARC, and resends the request with the signature.
3. The middleware verifies the signature, nonce, and amount, then forwards the payment payload to your local ArcFlow backend for settlement.
4. Your route handler executes normally.
