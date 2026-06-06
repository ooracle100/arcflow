import express from 'express';
import { withArcFlow } from '@getarcflow/middleware';

const app = express();
app.use(express.json());

// A mocked endpoint that costs 0.05 ARC to call
app.post('/api/generate', withArcFlow((req, res) => {
  // If execution reaches here, the middleware has verified the payment!
  console.log('[Merchant] Request authorized! Generating image...');
  
  res.json({
    success: true,
    message: 'Payment received and verified successfully. Here is your image payload.',
    url: 'https://example.com/generated-arc-image.png'
  });
}, {
  price: '0.05',
  wallet: '0x2420F3440508DFAb40369F8da3EE20eBfcCdB707',
  apiKey: 'af_test_123',
  backendUrl: 'http://localhost:3000'
}));

app.listen(5005, () => {
  console.log('[Merchant] Test API running on port 5005');
});
