# ArcFlow Environment Variables

This document details all environment variables required to run ArcFlow in production.

## Backend Service

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_PATH` | No | `../../data/arcflow.db` | Absolute path to the SQLite database. Railway requires this to be `/data/arcflow.db`. |
| `PORT` | No | `3000` | Port for the backend server to listen on. |
| `ARC_ENV` | No | `TESTNET` | Network to connect to. `TESTNET` or `MAINNET`. |
| `SELLER_ADDRESS` | Yes | - | The wallet address where funds will settle. |
| `SELLER_PRIVATE_KEY` | Yes | - | The private key for the backend agent. NEVER EXPOSE THIS. |
| `DASHBOARD_URL` | Yes | - | The URL of the deployed dashboard to allow CORS. |
| `WEBHOOK_URL` | No | - | Optional webhook endpoint for settlement notifications. |

## Dashboard SPA

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_BACKEND_URL` | Yes | `http://localhost:3000` | The URL of the backend API. Must be set in Vercel to point to Railway. |
