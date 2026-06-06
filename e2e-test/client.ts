import { ArcFlowClient } from '@getarcflow/client';

async function run() {
  console.log('[Buyer] Initializing ArcFlow Client...');
  
  // We use the buyer private key generated in Session 4.
  // Address: 0xc1E2C96979A08B48FBB1F072e50587299D630560
  const arcflow = new ArcFlowClient({
    privateKey: process.env.TEST_PRIVATE_KEY as `0x${string}`,
    network: 'arcTestnet'
  });

  console.log('[Buyer] Calling protected endpoint: POST http://localhost:5005/api/generate');
  
  try {
    const response = await arcflow.fetch('http://localhost:5005/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'cyberpunk city' })
    });

    const text = await response.text();
    console.log('[Buyer] Response status:', response.status);
    console.log('[Buyer] Response body:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[Buyer] ❌ FAILURE: JSON parse error');
      process.exit(1);
    }

    if (data.success && data.url) {
      console.log('[Buyer] ✅ SUCCESS: Agent paid for and received the payload seamlessly.');
      process.exit(0);
    } else {
      console.error('[Buyer] ❌ FAILURE: Invalid response payload.');
      process.exit(1);
    }
  } catch (err) {
    console.error('[Buyer] ❌ FAILURE: Request failed.', err);
    process.exit(1);
  }
}

run();
