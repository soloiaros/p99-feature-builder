# p99 API

The same Cloudflare Worker serves the p99 React build and `/api/*` at [p99.aauburn.com](https://p99.aauburn.com). Production never requires a laptop, local proxy, Python process or persistent Node server. The API contract is `src/shared/types.ts`.

## Endpoints

- `GET /api/health`: catalog and enrichment counts, snapshot timestamp, configured decision provider, and template brief mode. `mode: jev` here means a key is configured, not that the provider has passed a live health check.
- `GET /api/catalog`: 60 lightweight gallery entries, available categories, total count and the 15 editable feature suggestions. The full 1,000-app dataset stays in the Worker bundle.
- `POST /api/analyze`: `{input, profile?: {name,platform,stack}, features?: Feature[]}`. Accepts a description or a public HTTPS HTML landing page. Explicit `features` must contain 1–7 unique tags; each has `{id,name,description}` (description defaults to name). Submitted IDs, names and order are preserved after input validation, while context extraction still runs. This path skips feature inference and returns `suggested:false`, `mode:local` and a notice explaining that Jev evaluates reference apps at the matching stage. Omitting `features` retains automatic inference for existing clients. Returns `{project,features,candidates,mode,notice,source,suggested,durationMs}`. Optional `candidates` contains up to 28 unique app summaries from the same four-per-feature shortlist used by matching, so the browser can preload likely result icons without another provider call.
- `POST /api/match`: `{project,features}`. Supports 1–7 canonical or custom features. Returns exactly one supported reference per matched feature, with feature-fit judgments, dated metrics, evidence and sources. Each feature is ranked independently: the same app can win multiple features. `unmatchedFeatures: Feature[]` preserves any selected tag without a supported reference, including Jev-rejected candidates; it is optional in the shared type for older clients but always returned by this Worker. Custom tags require their distinctive name terms to appear together in a publisher sentence before project context is used to rank candidates. Generic context overlap alone never qualifies a custom feature. Use `match.id`, rather than the app ID, as a result key.
- `POST /api/brief`: `{project,match}`. Revalidates the reference app against the catalog and rebuilds all evidence server-side. Returns a detailed original implementation brief, collapsible sections, original SVG wireframe, Mermaid flow, sources, and an array of downloadable text files. The browser creates the ZIP locally. No other app’s screenshots are included.

Errors are JSON `{error:string}` with appropriate 400/403/413/415/422/429/503 status. Unsupported routes return 404. API responses contain no credentials, stack traces or provider error bodies. Successful mutation responses are `no-store`.

## Jev decisions and latency

Jev is a structured decision model, not a prose generator. The integration uses the official System One request shape, `model: jev-latest`, a common `state`, and independent `noul` questions. It validates every answer as a finite numeric value between 0 and 1. Missing, malformed, rejected and timed-out answers do not get made-up confidence values.

`JEV_API_KEY`, `TYPESAFE_API_KEY`, `TYPE_SAFE_KEY`, and `OPENROUTER_API_KEY` are server-side aliases. The first populated value in that order wins. TypeSafe credentials use `https://api.typesafe.ai/v1/systemone`. OpenRouter credentials use `https://openrouter.ai/api/v1/systemone`; an `sk-or-` prefix or the OpenRouter base URL selects that route. The base URL is an allowlist selector, not an arbitrary outbound request target. `JEV_MODEL` defaults to `jev-latest`.

Automatic feature analysis makes one batched decision request; explicit feature selection does not call Jev until matching. Matching prefilters the local snapshot to four candidates per feature, then sends one batched Jev request when at least one evidence-backed candidate exists. A configured provider always evaluates that shortlist (or uses a valid cached Jev decision). An entirely unsupported selection returns unmatched tags without a pointless provider call. Each provider call has a 2.4-second time budget, with no automatic retries on the interactive path. There are no Apple requests during description-based analysis or matching. API durations are measured on the server; network and user editing time are additional. External landing-page retrieval takes variable time and is not subject to a promise of a subsecond response.

The no-key or unavailable-provider path performs honest lexical matching and returns `mode: local` plus an explicit explanation. It never claims Jev generated those results. The UI must use the actual per-response mode rather than the configured health mode when displaying results.

Briefs are assembled from 15 detailed, feature-specific specifications and adapted to the project’s platform and stack. They are explicitly labeled `mode: template`. Jev does not generate their prose. Each includes domain entities, state transitions, edge cases, architecture guidance, accessibility, acceptance criteria and a handoff sequence. They are generated only when opened and cached for one hour using a SHA-256 key over project/profile, feature, app, template version and catalog timestamp. The Worker uses Cloudflare Cache API when available and a bounded 40-entry in-isolate cache. A cache outage cannot block generation. Private context is not written to telemetry.

## Evidence and data honesty

Ratings, rating counts, release dates, upfront price and collected chart positions come from Apple’s timestamped metadata. Ratings are not written reviews. Chart values are snapshots, not live rankings. App age is calculated from the published release date at snapshot time. Subscription pricing models can be inferred from listing language and are explicitly labeled estimated. Revenue is unavailable because Apple does not publish it and no revenue intelligence provider is connected.

Feature hints are precomputed from publisher listing language. An exact source excerpt is evidence of a publisher claim, not independent proof of implementation or usability. Matching confidence and Jev fit scores are about relevance. Neither ratings nor rank establish that a feature caused revenue, growth or retention. See `docs/DATA.md` for snapshot acquisition and limitations.

## Input and network boundaries

Only JSON mutation bodies are accepted, capped at 100 KB by a streamed reader. Description input is capped at 6,000 characters, extracted text at 10,000, feature count at 7, and all profile fields have small bounds. Mutation requests from a different Origin or `Sec-Fetch-Site: cross-site` are rejected. There is no cross-origin API access. The optional `API_RATE_LIMITER` binding applies a per-client/per-route edge limit before any provider call; it must be configured in deployed Wrangler configuration to enforce quotas.

Landing-page URLs must be HTTPS, standard port, without credentials, literal IPs or local/reserved hostnames. Both A and AAAA records are resolved through Cloudflare DNS over HTTPS; any private/reserved address rejects the request. Redirects are refused, the fetch carries no cookies or authorization, accepted MIME types are HTML/plain text, responses are size bounded, and DNS/page operations have deadlines. Scripts/styles/navigation are removed from extraction; page content is treated as untrusted text and cannot instruct tool use. No browser execution occurs.

DNS checks precede a separate hostname fetch and therefore cannot mathematically eliminate DNS rebinding between resolution and connection. Cloudflare’s outbound network is the runtime boundary; for stricter hostile-URL ingestion, place a filtering/pinning fetch service in front or restrict to an operator-approved hostname allowlist. A redirect is never followed even when it appears to remain public. Users can paste the final HTTPS URL or a description instead. JavaScript-only landing pages may require a description.

Generated SVG interpolations are XML-escaped, Mermaid labels are constrained, and client-supplied metrics/evidence/source URLs are ignored by brief generation. User descriptions are context, not authority to alter the build instructions. The viewer renders literal Markdown as escaped text; copying and downloading preserve the same bytes.

## Sources and validation

- Official Jev quick start: https://docs.typesafe.ai/introduction/quickstart
- Official Jev API: https://docs.typesafe.ai/api
- Cloudflare fetch runtime: https://developers.cloudflare.com/workers/runtime-apis/fetch/
- Cloudflare Cache API: https://developers.cloudflare.com/workers/runtime-apis/cache/
- Reference implementation studied: https://github.com/soloiaros/archies-appstore-lookup (`lib/jev/call.ts`, `lib/jev/score.ts`). This project adapts the shortlist-then-decision architecture; it does not reuse the reference’s silent 0.5 score fallback or infer revenue from chart rank.

Run `npm test` for API flow, template exports/cache, realistic feature extraction, domain relevance, untrusted client evidence rejection, rate binding behavior, Jev schema/provider routing/fallback, and URL/DNS/redirect defenses. Run `npm run build` to typecheck the frontend, Worker and tests and package for Cloudflare. Live-provider validation remains distinct from mocked contract tests.


## Accounts and Premium (15 October)

`GET /api/account` returns provider readiness, the current user, plan and remaining allowance. `/api/auth/start?provider=google|github` starts PKCE; `/api/auth/callback` exchanges the code into HttpOnly cookies. `POST /api/auth/logout` signs out the local session. Google/GitHub buttons are enabled only when Supabase reports that provider configured.

Configured deployments reserve one guest search, five monthly free-account searches, or 100 searches per Premium pass in Postgres. `/api/analyze` returns a `searchToken`; `/api/match` requires that token and the same cookies, project and features. Failed analysis releases its reservation. Guest identities are signed browser cookies, not one-per-person guarantees.

Profiles accept bounded integration notes and dependency name/version strings. Website technology hints are low-confidence evidence about the landing page only. Fetching reads a bounded 1 MB prefix and cancels the rest, so oversized public HTML does not become a request-size error. Incoming API bodies remain capped at 100 KB.

`POST /api/brief` always returns complete Markdown. Non-Premium responses have `premiumRequired: true`, no wireframe/flow payload, and only the Markdown file. Paid kits add a versioned JSON implementation checklist; it is not executable code or a claim that schemas inherently improve every coding agent.

`POST /api/billing/checkout` and `/api/billing/restore` require an authenticated same-origin request. `/api/billing/webhook` requires a valid Stripe signature. Payment ownership, paid status, product, quantity and configured Price are verified server-side. Database fulfillment is idempotent; refunds and disputes revoke access. See LAUNCH.md for activation requirements.
