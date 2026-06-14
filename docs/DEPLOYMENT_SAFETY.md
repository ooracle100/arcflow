# ArcFlow Deployment Safety Rules

**MANDATORY READING for any AI agent (Gemini, Claude, or any other model) before modifying backend code, database schema, or any file that triggers a Railway deployment.**

This document was created after a production incident on 2026-06-14 where an untested schema change crashed the live backend.

---

## The Golden Rule

**Never push code changes to `main` that affect the backend without following ALL of the steps below.** Railway auto-deploys from `main`. A push to `main` IS a production deployment.

---

## Pre-Push Checklist (ALL items mandatory)

### 1. Log Before You Code
Before writing a single line, add an entry to `docs/DECISION_LOG.md` explaining:
- What you are changing and why
- What alternatives you considered
- What the risk is if it fails

### 2. Log the Change
After writing the code, add an entry to `docs/CHANGE_LOG.md` with:
- The exact file(s) modified
- What the original code was
- What you changed it to
- Why

### 3. Never Modify Database Schema Without Migration Safety
The production SQLite database on Railway has **existing data**. Schema changes that work on an empty database may crash on a populated one.

**For any `schema.ts` change:**
- Adding a column: Use `ALTER TABLE ... ADD COLUMN` wrapped in a try/catch, not inside `CREATE TABLE IF NOT EXISTS` (the table already exists, so `IF NOT EXISTS` skips it and the column never gets added)
- Adding an index: Verify there are no existing rows that violate the constraint. If you can't verify, make the migration graceful (catch constraint errors)
- Dropping/renaming anything: Never do this without explicit Product Owner approval

### 4. Never Push Without Telling the Product Owner
Tell the Product Owner (Oracle) what you are about to push and wait for approval. A simple message like:
> "I'm about to push a schema change to add a unique index on e2e_id. This will auto-deploy to Railway. Approve?"

If the Product Owner is not available, **do not push**. Document what needs to be done and save it for the next session.

### 5. Separate Docs-Only Commits from Code Commits
- Docs changes (FAQ, CHANGE_LOG, README) can go to `main` freely — they don't affect the running backend
- Code changes (anything in `backend/`, `packages/`) must follow this full checklist

---

## What Triggers a Railway Deployment

Any push to the `main` branch that modifies files within Railway's watched path triggers a new deployment. Currently this includes:
- `backend/` — The ArcFlow SaaS backend
- Any root config files that Railway might reference (`package.json`, `tsconfig.json`)

**Files that do NOT trigger deployments:** `docs/`, `dashboard/`, `packages/client/`, `packages/middleware/`, `arcflow-examples/`

---

## Incident Response

If a deployment crashes:
1. **Revert immediately:** `git revert <commit> && git push origin main`
2. **Log the incident** in `docs/CHANGE_LOG.md` with full details
3. **Investigate after the revert** — never debug on a crashed production system

---

## Why This Matters

ArcFlow's live demo endpoint (`getarcflowbackend-production.up.railway.app`) has been shared publicly on X and in direct messages to potential partners (Dispatch/Wyck). A crashed backend makes the product look broken. Credibility is hard to earn and easy to lose.
