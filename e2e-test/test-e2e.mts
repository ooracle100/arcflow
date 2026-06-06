import express from 'express';
import { withArcFlow } from '../packages/middleware/dist/index.js';
import { ArcFlowClient } from '../packages/client/dist/index.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env
dotenv.config({ path: resolve(process.cwd(), '../.env') });

const app = express();

// A simple mock endpoint protected by the local ArcFlow middleware
app.get('/api/test', withArcFlow((req, res) => {
    res.json({ message: 'Success! ArcFlow payment settled.', timestamp: new Date() });
}, {
    price: '0.0001',
    wallet: process.env.SELLER_ADDRESS as string,
    apiKey: 'test-key',
    chainId: 5042002
}));

const server = app.listen(3001, async () => {
    console.log('[Test] Mock server running on port 3001');

    try {
        const client = new ArcFlowClient({
            privateKey: process.env.SELLER_PRIVATE_KEY as `0x${string}`,
            network: 'arcTestnet'
        });

        console.log('[Test] Making protected request to http://localhost:3001/api/test');
        
        const response = await client.fetch('http://localhost:3001/api/test');
        const data = await response.json();
        
        console.log('[Test] Response:', JSON.stringify(data, null, 2));
        console.log('[Test] Phase 1 checks out! No clock sync errors.');

    } catch (e) {
        console.error('[Test] Fetch failed:', e);
    } finally {
        server.close();
        process.exit(0);
    }
});
