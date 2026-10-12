# p99 verification — 12 October 2026

## Deployment

Live at https://p99.aauburn.com on Cloudflare Workers and static assets. The production Worker keeps its internal identifier `borrow-feature-engine`; the public brand and hostname are p99. Version: `4bc41218-6ea1-49d7-88f1-a622f6b9f697`.

Cloudflare's domain API confirms p99 enabled and the earlier 24feature association removed. Production health reports Jev through OpenRouter and 1,000 catalog apps. The local development process was stopped before the final browser reload, real-URL search, brief generation, copy, download, and saved-project checks. No local server, relay, container, or running laptop is required.

## Build and data checks

- Final TypeScript and production React/Worker builds passed; Wrangler dry-run and deployment passed.
- All 20 tests passed. Coverage includes input validation, address safety, hostile content, provider parsing, credential-safe redirects, Jev decision caching and expiry, malformed cache/rejection/timeout behavior, demo categories, brief data boundaries, and candidate coverage for winning icons.
- Catalog: 1,000 unique US Apple records, 720 enriched apps, 1,456 excerpt-backed feature annotations, 18 named demo references. Seed reported zero upstream failures.
- Dependency audit after robot-heads installation: zero known vulnerabilities.
- Final public asset scan passed across 24 files: no Jev credential and no `.dev.vars` in `dist/client`. The server-side key is a Worker secret.
- Three.js is lazy-loaded and warmed while the user reads; its 190 KB gzip chunk is separate from the initial app bundle. The robot library adds approximately 15 KB gzip and has no runtime dependencies beyond React.

## Hosted Jev checks

Three consecutive `scripts/smoke.mjs https://p99.aauburn.com` runs passed. Each checks health, all three demo categories, at least three references, Jev mode, long briefs, SVG/Mermaid assets, source files, and unavailable revenue labels.

Observed analyze-plus-match elapsed times, including HTTP round trips:

- Run 1: habit tracker 314 ms; daily journal 217 ms; fitness companion 318 ms.
- Run 2: habit tracker 1,183 ms; daily journal 942 ms; fitness companion 1,125 ms. These included fresh provider decisions.
- Run 3: habit tracker 289 ms; daily journal 194 ms; fitness companion 273 ms.

The initial hosted checks before the rename measured 2,038 / 1,179 / 1,394 ms respectively. The final real-URL browser search for https://streaks.app completed in 2.12 seconds, returned four references, and reported Jev mode. These are observed timings, not a latency guarantee. Successful Jev decisions are cached; timeouts remain visible as fallback matching and are never cached as successful provider decisions.

## Browser workflow and motion

- Inspected desktop at 1440px and mobile at 390px. No horizontal page overflow in checked layouts.
- A single persistent square pink robot with white LEDs moves from the header to the search cloud and returns smaller at the top left. Thinking/searching/working/happy/error/listening states follow application state. Pointer and keyboard activation were checked.
- The slow Three.js cloud uses deterministic spherical positions, approximately 45-second rotation, gentle drift, depth-dependent size/opacity, and a protected area around the robot. Query, orbit, and status text stay separated on desktop/mobile.
- The query lifts into its own dimmed box, the rest of the page fades, and results become interactive immediately. Loaded winning app meshes fly into exact result icon rectangles; unused meshes fade. No route or page navigation occurs. No hidden flight icons remain after settling or cancellation.
- Inline feature editing, rematching, and cancellation preserve the committed result set. Results use a compact two-line query with an expandable feature editor.
- Clicking the results robot hides results, preserves the query, and focuses the restored input. The hosted URL remained unchanged.
- Hosted copy produced 12,236 characters. Hosted ZIP was downloaded and verified to contain `feature-brief.md`, `wireframe.svg`, `flow.mmd`, and `sources.json`, including the chosen SwiftUI stack.
- Hosted reference-kit SVG loaded at natural width 1120px. Saving and reopening a project succeeded on the new hostname.
- No production browser errors or warnings were recorded. A historical local Vite import error during parallel component creation was resolved before build/deployment.
- Reduced-motion and skip behavior are implemented; reduced-motion is propagated live to the robot. Device GPU frame-rate was not benchmarked.

## Visual review

Independent static screenshot review of the robot restyle: 8/10. It requested a smaller resting query and stronger reading contrast. The query was reduced to roughly 126px at 390px, repeated result labels were removed, essential text contrast was strengthened, and narrow mobile metadata/footer wrapping was corrected. A follow-up screenshot review confirmed these fixes with no remaining material visual blocker; its minor mobile separator refinement was also applied. The parent separately verified the actual interaction and live workflow.

Current screenshots: `screenshots/home-p99-live.jpg`, `results-p99-live.jpg`, `home-p99-mobile.jpg`, `results-p99-mobile.jpg`, `search-p99-desktop.jpg`, and `search-p99-mobile.jpg`.

## Data boundaries

Revenue is unavailable without a defensible source. Ratings counts are not written reviews; chart/rating data are dated snapshots. Publisher feature claims are not independent feature testing. Long briefs are original, feature-specific implementation templates tailored to project context, not Jev prose generation. Saved projects are browser-local. Public page fetching cannot read bot-blocked or JavaScript-only content; descriptions remain supported.
