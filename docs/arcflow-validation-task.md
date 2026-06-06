# ArcFlow Validation — Task Tracker

**Started**: 2026-05-15 18:55 WAT
**Objective**: Test Circle's arc-nanopayments reference impl, paywall a custom endpoint, document gaps → ArcFlow v1 spec

## Progress

- [ ] Step 1: Install Supabase CLI
- [ ] Step 2: Clone arc-nanopayments repo
- [ ] Step 3: Install npm dependencies
- [ ] Step 4: Create .env.local from .env.example
- [ ] Step 5: Generate seller & buyer wallets
- [x] Step 6: Fund buyer wallet with testnet USDC (MANUAL)
- [x] Step 7: Start local Supabase (Docker)
- [x] Step 8: Update .env.local with Supabase values
- [x] Step 9: Run seller app (Next.js)
- [x] Step 10: Run buyer agent (mock mode)
- [x] Step 11: Create custom paywalled endpoint (/api/custom/weather)
- [x] Step 12: Test buyer agent against custom endpoint
- [x] Step 13: Document all findings → VALIDATION_FINDINGS.md
