# p99 account and Premium activation

## Provisioned on 15 October 2026

- Supabase project: **p99**, organization **Recoveree**, Frankfurt (`eu-central-1`).
- Project reference: `byykgulviqoumyedwnmn`.
- [Project dashboard](https://supabase.com/dashboard/project/byykgulviqoumyedwnmn).
- All three migrations in `supabase/migrations/` are applied. RLS and service-role-only grants are active.
- Site URL: `https://p99.aauburn.com`. Allowed app callbacks: `https://p99.aauburn.com/api/auth/callback` and `http://localhost:5187/api/auth/callback`.
- Local `.dev.vars` has the Supabase connection secrets and is ignored by Git. The database password is stored in a restricted local file outside this repository.
- Three Supabase Worker secrets are staged on Cloudflare version `b66edbc0-2d7b-44ac-b9c0-ba69b50cbcaa` of `borrow-feature-engine` in account `fd75e45889c3e4480b8ccee44f51156a`. This version is **not deployed**. It stages secrets against the previously uploaded code; it is not the new application build.

The application changes are committed locally. Production has not been updated, and no real payment has been taken.

## Sign-in activation

The current Supabase settings report both requested providers disabled. The p99 UI reflects this instead of sending users into a broken OAuth flow.

1. Create a Google OAuth **Web application** and a GitHub OAuth app owned by the p99 operator. Use `https://p99.aauburn.com` as the homepage/origin.
2. In both provider consoles, set the provider callback to `https://byykgulviqoumyedwnmn.supabase.co/auth/v1/callback`.
3. Save each client ID and secret in this project's Supabase Authentication → Providers page, then enable the provider. Do not put provider secrets in frontend code or chat.
4. Verify both providers from localhost, including callback, reload, session refresh, sign-out, and switching accounts. Verify the first guest search succeeds and the second requests sign-in.

The provider callback above differs from the app callback: Supabase receives the provider response, then redirects to p99's `/api/auth/callback` to exchange the PKCE code. Official instructions: [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github).

`supabase/config.toml` captures the initial/local configuration. Reconcile dashboard provider changes before any future `supabase config push`; do not overwrite enabled providers with local defaults.

## Premium activation

Proposed launch pricing: **$9 USD, one payment for 30 days, no automatic renewal**. Guests receive one search, free accounts five per UTC calendar month, Premium 100 per pass. Full tailored Markdown stays free; Premium includes original wireframes, Mermaid flows, source provenance and a structured implementation checklist.

In the operator's Stripe account, start in test mode:

1. Create a one-time $9 Price. Supply `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` through local `.dev.vars` and protected Worker-secret input.
2. Register `https://p99.aauburn.com/api/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`.
3. Test checkout, restore, duplicate webhooks, payment failure/delay, refunds, owner mismatch, and expired access. Database behavior and signature/ownership checks have automated coverage; actual Stripe Checkout is not verified yet.
4. Configure the operator's support, terms and refund policy in Checkout before replacing test configuration with live configuration. Keep the displayed price and Stripe Price aligned.

No Stripe account, product or live payment was created during this task.

## Build and release

Use the project's installed Wrangler. Supabase keys are already staged, but verify that the uploaded application version contains all required secret bindings. Local `.dev.vars` alone does not configure production. Use [versioned secrets](https://developers.cloudflare.com/workers/configuration/secrets/) when staging changes; ordinary `wrangler secret put` immediately deploys a version.

```sh
npm test
npm run build
npm exec wrangler -- deploy --dry-run
# After provider activation and test-mode checkout verification:
npm exec wrangler -- deploy
```

The committed production configuration enforces account setup. Releasing before provider activation would leave guests with no way to sign in after their trial, so complete that activation before deploying. Stripe can remain unavailable while free accounts operate.

For the dedicated p99 database verification (creates then deletes disposable test identities and payment records):

```sh
node scripts/verify-accounts.mjs
```
