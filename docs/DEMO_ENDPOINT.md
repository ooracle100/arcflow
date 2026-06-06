# ArcFlow Demo Endpoint

This endpoint exists purely to demonstrate a successful end-to-end integration of ArcFlow on the live testnet.

## Request
```bash
curl -X GET https://[YOUR_RAILWAY_URL]/api/demo/summary
```

## Behavior
- **Without Payment/Headers**: Returns `402 Payment Required` along with an EIP-712 payment challenge.
- **With Valid Signature**: Returns the payload below and records the `0.01 USDC` settlement in the backend SQLite database.

## Protected Payload
```json
{
  "success": true,
  "message": "Payment verified! This is a protected resource on ArcFlow.",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "data": {
    "report": "Confidential Market Analysis - Q3",
    "insight": "DePIN volume is projected to grow 400% on Arc Testnet."
  }
}
```
