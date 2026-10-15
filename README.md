# p99

Find the thinking behind useful app features, then download an original build brief for your own project. Inspired by the [10K App Store research engine](https://github.com/soloiaros/archies-appstore-lookup) and the clean shelves of [Icon Museum](https://icon.museum/).

Production hostname: [p99.aauburn.com](https://p99.aauburn.com). The app runs entirely on Cloudflare Workers with a server-side Jev secret. The fallback hostname is `borrow-feature-engine.soloiaros.workers.dev`.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
cp .dev.vars.example .dev.vars
# Add your Jev credential to .dev.vars (never commit it).
npm run dev
```

Open http://localhost:5187. React/Vite and the API run together in Cloudflare's actual Worker runtime. The unrelated `openai-relay-for-cursor` directory is not part of this application.

## Deploy to Cloudflare

```sh
npx wrangler login
npm run build
npx wrangler secret put JEV_API_KEY
npx wrangler deploy
```

This deploys one Worker plus static assets. **The deployed app needs no local server, relay, container, or running laptop.** The 1,000-app metadata catalog is bundled into the Worker. Source configuration is `wrangler.jsonc`; Vite writes the deployable Worker configuration to `dist/borrow_feature_engine/wrangler.json` and Wrangler discovers it through `.wrangler/deploy/config.json`.

The configured Jev route is OpenRouter (`https://openrouter.ai/api/v1/systemone`), matching the original 10K project's credential. Direct TypeSafe keys are supported with `JEV_BASE_URL=https://api.typesafe.ai/v1`. All provider calls stay server-side. `JEV_API_KEY` must be uploaded separately; local `.dev.vars` files never configure deployed secrets. Do not publish the entire `dist/` folder as static assets: `dist/client/` is the only public asset directory.

## Demo flow

1. Paste a public HTTPS landing page, or describe your app. This provides app context; choose the features separately.
2. Select 1–7 feature tags, including custom tags, and choose **Find the best apps**. Set platform, stack and project name in the same input block. Expand optional app details to include integration constraints and package.json dependency evidence. Your selected feature names and order are preserved.
3. The surrounding page fades away and the query lifts into a persistent box. A Three.js icon swarm surrounds the pink robot while Jev evaluates references for your selections. Each supported feature receives one independently chosen app; the same app may win multiple features. Unsupported selections remain visible with an honest unmatched message. Use **Edit search** or click the robot to change the context or tags.
4. Inspect dated statistics, feature evidence and confidence. Open the literal Markdown source, copy it, or download the `.md`. Premium adds a ZIP with `feature-brief.md`, `wireframe.svg`, `flow.mmd`, `sources.json`, and `implementation-contract.json`.

Generated briefs include an [Oil UI](https://github.com/oil-oil/oil-ui) handoff tailored to the feature, target platform and recovery cases. A receiving agent uses its installed `oil-ui-pro` or `oil-ui` skill when available; otherwise the brief provides a complete visual integration checklist. No skill installation, paid service or runtime dependency is required. The structured contract includes the same design-review requirements. This is a prompt integration, not a claim that Oil UI has already reviewed the generated feature or the user's repository.
5. Save the project to reopen it in the same browser.

The animation follows actual requests with no artificial delays and no route changes. **Less motion** and reduced-motion settings disable decorative movement. Matching results render immediately; decorative flights finish independently in under 650 ms. Candidate icons preload while matching, and image/network/WebGL failures leave results readable. Cancelling a search aborts its requests.

## Architecture and costs

- React 19 + TypeScript + Vite for the UI; Motion for continuous query and robot transitions, Three.js for the dimensional icon swarm, and [robot-heads](https://github.com/fayazara/robot-heads) for the square pink companion with white LEDs.
- Cloudflare Worker with static assets; native rate-limit binding; Cache API for generated briefs.
- 1,000 actual US Apple App Store records and precomputed, excerpt-backed feature annotations. Snapshot date and source URLs travel with every result.
- Explicit feature selections skip inference. Jev evaluates a small shortlist for each feature using app context, with independent winners and no forced app diversity. Custom tags require feature-specific publisher evidence before context can influence ranking. Automatic feature inference remains available to API clients that omit selections. No live Apple request is needed during matching.
- Long briefs use detailed feature-specific implementation templates, tailored to the project context and stack. Jev is a decision model, not a prose generator. This keeps build kits instant, predictable and inexpensive; the UI discloses template generation.
- Supabase handles Google/GitHub accounts and durable search allowances. Saved projects remain browser-local, separated by account; multi-device project sync is not implemented.

## Data honesty and limitations

Revenue is **unavailable**: Apple does not supply it and no revenue-intelligence provider is connected. We do not convert rank into a fabricated estimate. Ratings counts are ratings, not written reviews. Chart ranks are dated category snapshots, not a current global rank. Pricing models inferred from publisher text are labeled estimated. Publisher claims and model judgments are not independent tests of feature quality or proof of causation.

The catalog covers a useful subset, not the entire App Store. A missing or failed Jev credential produces explicitly labeled local keyword results; a demo should only be called Jev-powered when its results say **Matched with Jev**. Landing-page latency also depends on the external website; pages that block fetching, require JavaScript, or redirect may require the final HTTPS URL or a pasted description.

Original wireframes are structural starting points, not screenshots. Reference app icons appear only for identification in the UI and are not redistributed in build bundles. Original UI, assets, branding and copy are required in every brief.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run smoke -- https://p99.aauburn.com
npm audit
```

The smoke command performs actual paid-provider calls using the server's configured Jev key (three small demo cases). It sends explicit selections, checks a custom mood-tracking tag and an intentionally unsupported tag, requires Jev matching, and verifies that every selection becomes exactly one reference or an unmatched result. Each scenario uses a disposable guest identity, preserves its cookies and signed search grant, and verifies full free Markdown, locked paid files and unavailable revenue. Offline tests cover independent winners, feature-specific excerpts, input validation, private-address rejection, redirect handling and evidence-sensitive bundle caching.

Refresh the catalog explicitly with `npm run seed` (Apple public endpoints; no AI expense). A Monday GitHub Action appends top-chart apps that are not already stored and opens a pull request. See [data provenance](docs/DATA.md), [API contracts](docs/API.md), [reference decisions](docs/REFERENCE-NOTES.md), [design notes](docs/DESIGN.md) and [verification record](docs/VERIFICATION.md).

## Accounts and search allowances

Apply all files in `supabase/migrations/` in order, or run `supabase db push` against the intended linked project. Configure Google and GitHub under Authentication → Providers and allow `https://p99.aauburn.com/api/auth/callback` (plus `http://localhost:5187/api/auth/callback` for local testing). The provider dashboards use the callback URL shown by Supabase, not the p99 callback.

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as Worker secrets, and in `.dev.vars` for development. Never put the service role key in a `VITE_` variable. OAuth uses PKCE and server-managed, Secure/HttpOnly cookies. Sessions refresh through the server. Saved projects remain browser-local and are separated by account; they are not cloud synced.

The shipped production config requires account setup before searches can run. Localhost may run without accounts for development. Guests get one search per signed browser identity, free accounts get five searches per UTC calendar month, and Premium accounts get 100 per pass. Database reservations make allowance checks atomic across Workers; failed analysis releases its reservation. Matching requires a signed grant bound to the exact project, features and visitor. Clearing cookies creates a new guest identity; the existing edge rate limiter remains the abuse backstop, not a claim of one trial per human.

`FREE_SEARCH_LIMIT` and `PREMIUM_SEARCH_LIMIT` configure account allowances. Usage rows contain only opaque identity, period and timestamp, never prompts. Delete account usage through the auth-user deletion trigger. Schedule maintenance to delete guest rows older than 366 days and account rows older than 90 days; current-period usage must be retained. Supabase user deletion also removes entitlements. Configure Supabase's own session expiration/revocation policies for your launch.

## Premium

The proposed launch offer is **$9 for 30 days, no automatic renewal**. The complete tailored Markdown is free; Premium unlocks 100 searches per pass and the downloadable wireframe, Mermaid flow, provenance and structured implementation contract. `PREMIUM_PRICE_LABEL` is presentation only; Stripe's configured Price determines the actual charge. Keep these values in sync.

Apply the Premium and immediate-revocation migrations in `supabase/migrations/`. In Stripe, create a **one-time** $9 USD Price and configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` as Worker secrets. Start with test-mode keys. Register `https://p99.aauburn.com/api/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Test duplicate delivery, delayed payments, refunds, ownership, and expired passes before switching to live keys. Add your business's support, terms and refund policy in Stripe Checkout settings before taking payments.

Signed webhooks and the authenticated return/restore path both retrieve the Checkout Session from Stripe, verify its owner, product, Price and paid status, then call an idempotent database function. A checkout query parameter never grants access by itself. Refunds (including partial refunds) and disputes revoke the affected purchase; out-of-order notifications use payment tombstones. Resolve won disputes manually after reviewing them. Repeated purchase delivery does not extend access. An accidental second distinct payment extends the pass by 30 days; the UI prevents buying while access is already active.

Paid files are removed server-side for non-Premium accounts. Existing downloaded kits remain theirs. Account and payment secrets, provider configuration, database migrations and real checkout verification are required before launch; the code does not charge money automatically. See [launch setup](docs/LAUNCH.md) for the provisioned p99 project and remaining activation steps.
