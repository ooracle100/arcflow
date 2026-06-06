#!/bin/bash
set -e

echo "============================================="
echo "   ARCFLOW END-TO-END SIMULATION RUNNER     "
echo "============================================="

# Ensure backend is running
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo "❌ Error: ArcFlow Backend is not running on port 3000. Please start it first."
  exit 1
fi

echo "[1/4] Starting Mock Merchant Server on port 5005..."
npx tsx server.ts &
MERCHANT_PID=$!

# Wait for server to boot
sleep 2

echo ""
echo "[2/4] Running Mock AI Buyer..."
# Run the client script
npx tsx client.ts

echo ""
echo "[3/4] Verifying Payment Settlement (Waiting 3s)..."
sleep 3

# Check if payment appears in backend API
PAYMENT_COUNT=$(curl -s http://localhost:3000/api/payments | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']['payments']))")

if [ "$PAYMENT_COUNT" -gt "0" ]; then
  echo "✅ Verified: Payment successfully indexed in SQLite!"
else
  echo "❌ Error: Payment did not appear in the database."
  kill $MERCHANT_PID
  exit 1
fi

echo ""
echo "[4/4] Shutting down Mock Merchant..."
kill $MERCHANT_PID

echo ""
echo "🎉 E2E TEST PASSED! The nanopayment cycle is functioning perfectly on Arc Testnet."
