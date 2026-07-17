# InvoiceMemory — Supabase, Stripe & Security Setup (FINAL CANONICAL)

> Read by the Deploy Mind. Validation pass 5 re-assert: the landing step's
> copy of this file dropped the ENTIRE Stripe section (webhook endpoint,
> events, prices), which would leave billing unconfigured in production.
> Product domain: **https://invoicememory.zeroorigine.com**

## 1. Database (FIRST — before any deploy)
Run the v1 schema migration, then validation patches 1–5 (indexes + function
hardening; pass 5 is a no-op verification). Verify:
```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('invoicememory_profiles','invoicememory_clients','invoicememory_invoices','invoicememory_subscriptions','invoicememory_payments');
```
All five must exist or HALT. RLS is on everywhere; billing tables are written
ONLY by the service role via webhooks — by design.

## 2. Supabase Auth
- Site URL: `https://invoicememory.zeroorigine.com`
- Redirect URLs: `https://invoicememory.zeroorigine.com/**` and `http://localhost:3000/**`
- Sender name: **InvoiceMemory** (never "Supabase").
- Default `{{ .ConfirmationURL }}` templates work (they route through
  `/api/auth/callback`). Token-hash style optionally supported at `/auth/confirm`.
- Enable Google + GitHub providers (Supabase callback: `https://<ref>.supabase.co/auth/v1/callback`).

## 3. Environment variables (Netlify, ALL non-secret — see .env.local.example)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY,
STRIPE_PRICE_BUSINESS_MONTHLY, STRIPE_PRICE_BUSINESS_YEARLY.
If ANY is missing → HALT the deploy.

## 4. Stripe (TEST MODE FIRST — live keys only after explicit approval)
1. Account: public business name **ZeroOrigine**, statement descriptor `ZEROORIGINE`.
2. Products/prices: **InvoiceMemory Pro** $29/mo + $290/yr; **InvoiceMemory Business**
   $99/mo + $990/yr. **No trial_period_days** — UI copy must match ("Upgrade — $29/mo").
3. Webhook endpoint: `https://invoicememory.zeroorigine.com/api/webhooks/stripe` with events:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`, `payment_intent.succeeded`,
   `payment_intent.processing`, `payment_intent.payment_failed`, `charge.refunded`.
   Save signing secret as `STRIPE_WEBHOOK_SECRET`.
4. Enable the Billing Portal (plan switching + cancellation allowed).
5. Test end-to-end with `4242 4242 4242 4242`.

## 5. Security posture (implemented in code)
- Webhook signatures verified against the raw body — unsigned payloads 400.
- CSRF/CORS: SameSite=Lax + Secure cookies; middleware rejects state-changing
  /api requests from foreign origins (webhooks exempt — signature-authed).
- Secrets only in `server-only` modules; client import = build error.
- Cards never touch our servers (Stripe Checkout + Portal own PCI scope).
- Open redirects: all `next` params validated to same-site paths.
- Free-plan cap (15 invoices/month) enforced server-side in POST /api/invoices.

## 6. Rate limiting
Supabase Auth built-ins active. Before scale: edge/IP limits on
/api/billing/checkout, /api/checkout, /api/billing/portal (~10/min/user) and
/api/export (~5/hour/user). Webhook: none — signature is the gate.

## 7. Post-deploy verification (Gate 3 — PRODUCTION URL)
1. /signup → account → branded confirmation email → lands on production /dashboard.
2. Sign out / sign in — no redirect loops.
3. /invoices/new is pre-filled instantly; create invoice → auto-numbered INV-0001.
4. /billing shows Pro $29/mo → "Upgrade to Pro — $29/mo" opens TEST checkout →
   pay → redirected to /dashboard?checkout=success (banner renders) → plan flips
   to Pro via webhook.
5. "Manage billing" opens the Stripe portal (envelope response: data.url).
6. /api/export downloads JSON (linked from the Privacy Policy).
7. Free account can create 15 invoices; the 16th returns the friendly upgrade 403.
If ANY step fails, the deploy is NOT complete.
