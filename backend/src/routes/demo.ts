// demo.ts — Public endpoint to demonstrate successful testnet settlement

import { Router } from 'express';
import { withArcFlow } from '@getarcflow/middleware';

export const demoRouter = Router();

demoRouter.get(
    '/api/demo/summary',
    withArcFlow((req, res) => {
        res.json({
            success: true,
            message: 'Payment verified! This is a protected resource on ArcFlow.',
            timestamp: new Date().toISOString(),
            data: {
                report: 'Confidential Market Analysis - Q3',
                insight: 'DePIN volume is projected to grow 400% on Arc Testnet.'
            }
        });
    }, {
        price: '0.01',
        wallet: process.env.SELLER_ADDRESS as string,
        apiKey: 'demo-api-key'
    })
);
