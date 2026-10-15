# Catalog data and provenance

`data/catalog.json` is a point-in-time US App Store snapshot collected on 12 October 2026. It contains 1,000 unique apps, including 18 selected demonstration apps, fetched from Apple's public iTunes Lookup API. The other apps are selected by interleaving high positions across the free, paid, and grossing charts for ten categories: Health & Fitness, Productivity, Education, Lifestyle, Finance, Music, Photo & Video, Social Networking, Travel, and Food & Drink. A category's chart can include apps whose primary category is different.

This is a deliberately bounded sample, not the entire App Store. Every app records `metadataFetchedAt` and a reproducible `metadataSource`. Every chart appearance includes its country, category, chart kind, rank, source URL, and collection timestamp. Positions are observations at collection time, not claims about today's rank after the snapshot ages. Absence from the collected charts means unavailable, not zero.

## What each field means

- Name, description, icon URL, seller, category, public download price, version, release date, average rating, and rating count come directly from Apple's Lookup response. They are verified against that source at the collection time. Description text is written by the publisher; its marketing claims are not independently verified.
- `ratingCount` is the count of user ratings, not a count of written reviews. `price` is the price to download the app; zero does not mean there are no subscriptions or in-app purchases.
- Age can be computed from the publisher's `releaseDate`. A chart rank is only meaningful alongside its category, chart type, US storefront, and snapshot date.
- Revenue, downloads, monthly active users, retention, and conversion are unavailable. Apple does not supply them through these feeds. We do not convert ranks or rating counts into unsupported money estimates.
- Every `features` entry is an **estimated** retrieval hint inferred from an explicit phrase in the publisher's description, using the transparent `description-keyword-v1` method. `evidence` is an exact excerpt, linked to its source. `confidence: "medium"` is a qualitative rule label, not an AI probability or independent assurance of feature quality. An absent feature means unknown, not that the app lacks it.
- The feature vocabulary is: `streaks`, `widgets`, `onboarding`, `reminders`, `progress`, `social`, `gamification`, `insights`, `focus`, `logging`, `personalization`, `offline`, `search`, `sync`, and `subscriptions`. The method is conservative but can produce false positives; matching should examine the attached excerpt. In particular, a quiz or a personalized plan does not prove that it appears during onboarding.

Strong demo references include Streaks (streaks, widgets, reminders), Waterllama (hydration logs, reminders, widgets), Forest (focus timer, achievements, shared sessions), Finch (journaling, mood insights, rewards), Duolingo (progress, achievements, leaderboards), Structured (widgets, focus timer, synchronization), and Hevy (workout logging, graphs, social activity). Ratings and adoption signals describe the app as a whole; they do not demonstrate that any one feature caused its success.

## Refreshing

Run `node scripts/seed-catalog.mjs` with Node 20 or newer. It fetches 30 category chart feeds and then batches Lookup requests at 200 IDs or fewer. It spaces requests, retries transient errors, and preserves the existing catalog if a refresh cannot meet the requested size. Set `CATALOG_LIMIT` to change the sample size (18–3,000; availability depends on deduplication across the selected charts). That command rebuilds the sample. It does not keep apps the weekly job has appended past the limit.

`.github/workflows/catalog-charts.yml` runs every Monday, and can be started by hand. It reads the free, paid, and grossing charts for the original ten categories plus Business, Utilities, Sports, Reference, News, Navigation, Games, Entertainment, Books, Medical, Shopping, Developer Tools, Graphics & Design, and the store-wide charts. It looks up only track ids that are absent from `data/catalog.json`, and it also skips a listing whose bundle id is already stored. Each run adds at most 80 apps (`CATALOG_ADD`) and stops at 3,000 (`CATALOG_MAX`). When it finds any, it opens a pull request. Merging that pull request updates the repo. The deployed site still serves the catalog from the last deploy.

Run `node scripts/seed-catalog.mjs --from data/catalog.json` to reapply the feature rules to an existing snapshot with no network calls. The site reads the bundled snapshot at runtime: this script is a maintenance command, and no laptop process, scraper server, or local database is required to serve the deployed application.

### Cheap incremental growth

The schedule is Monday at 06:17 UTC (09:17 Istanbul), with manual runs available in GitHub Actions. It polls charts weekly rather than refreshing every stored app. A normal run makes 72 chart-feed requests and at most one batched Lookup request for 80 new IDs, before retries: about 292 requests per four runs. It uses no model tokens, paid scraping service, screenshots, or review scraping. GitHub runner usage depends on the repository's Actions allowance. Apple's feeds may change or be unavailable; this is a best-effort weekly observation, not a chart-update webhook or an exhaustive archive.

Existing track IDs are excluded before metadata lookup. Existing bundle IDs are excluded again before saving. Records already stored are kept unchanged, even when they leave the charts. If a prior `catalog/charts-*` PR is still open, the entire run skips without contacting Apple, avoiding repeated lookups and duplicate review batches. Merge or close that PR to resume discovery. Chart or lookup outages must not be mistaken for zero new apps: no usable charts or a failed lookup fails the job and leaves the snapshot intact. Partial chart availability is recorded. Writes replace the catalog atomically.

To preview discovery without changing the catalog, run `npm run catalog:append -- --dry-run`. To append a batch now, run `npm run catalog:append`. The 80-per-run and 3,000-total limits bound growth of the bundled Worker data; reaching the cap requires revisiting storage and bundle size, not silently dropping older apps.

The workflow must be on the repository's default branch to run on schedule. In GitHub **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create pull requests. GitHub schedules can be delayed and can be disabled after 60 days of inactivity in a public repository; inspect the Actions page if updates stop. Review, merge, and deploy each catalog batch to make it searchable on p99.

Public API shapes:

- Lookup: `https://itunes.apple.com/lookup?id=570060128&country=us&entity=software`
- Category chart: `https://itunes.apple.com/us/rss/topfreeapplications/limit=100/genre=6013/json`
- Chart kinds: `topfreeapplications`, `toppaidapplications`, `topgrossingapplications`.

## Asset and source boundaries

Icons are referenced using the original Apple-hosted URLs and linked to the corresponding App Store listing. No app screenshots or other developers' UI assets are bundled into downloadable implementation briefs. All wireframes and flow diagrams produced by the feature engine must be original. App names, descriptions, icons, and Apple metadata are third-party material, not covered by this project's source-code license.

The ingestion approach was informed by [archies-appstore-lookup](https://github.com/soloiaros/archies-appstore-lookup), whose source is MIT licensed (copyright 2026 soloiaros, with upstream notices for Aayan Ali). This implementation uses independently written feed parsing and feature rules. Its reference database was not copied. We intentionally do not adopt the reference's `us-grossing-power-v1` revenue curve: a fixed rank-based curve does not establish revenue for an individual app.

Apple's [Search API documentation](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html) describes the public API. App Store content and artwork remain subject to their owners' terms.
