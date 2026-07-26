# Edge functions

Supabase Edge Functions (Deno). Deploy via Supabase Dashboard or `supabase functions deploy`.

| Function | Purpose |
|----------|--------|
| **`sms-otp-send`** | Sends SMS one-time codes for phone sign-in. Registered in `supabase/config.toml`. |

QuickBooks Online is push-only — invoices are pushed to QBO by the
`/api/cron/qbo-sync` worker draining `finance.sync_jobs`. There is no inbound QBO
webhook. (A `qbo-webhook` function previously lived here but targeted tables that
no longer exist after the 2026-04-12 finance rebuild — `qbo_configs` /
`qbo_sync_logs`, since replaced by `finance.qbo_connections` / `finance.qbo_sync_log`
— and was never registered or invoked. Removed 2026-07-26.)

See each function’s `index.ts` for env vars (e.g. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
