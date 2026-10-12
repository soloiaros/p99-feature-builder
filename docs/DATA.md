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

Run `node scripts/seed-catalog.mjs` with Node 20 or newer. It fetches 30 category chart feeds and then batches Lookup requests at 200 IDs or fewer. It spaces requests, retries transient errors, and preserves the existing catalog if a refresh cannot meet the requested size. Set `CATALOG_LIMIT` to change the sample size (18–3,000; availability depends on deduplication across the selected charts).

Run `node scripts/seed-catalog.mjs --from data/catalog.json` to reapply the feature rules to an existing snapshot with no network calls. The site reads the bundled snapshot at runtime: this script is a maintenance command, and no laptop process, scraper server, or local database is required to serve the deployed application.

Public API shapes:

- Lookup: `https://itunes.apple.com/lookup?id=570060128&country=us&entity=software`
- Category chart: `https://itunes.apple.com/us/rss/topfreeapplications/limit=100/genre=6013/json`
- Chart kinds: `topfreeapplications`, `toppaidapplications`, `topgrossingapplications`.

## Asset and source boundaries

Icons are referenced using the original Apple-hosted URLs and linked to the corresponding App Store listing. No app screenshots or other developers' UI assets are bundled into downloadable implementation briefs. All wireframes and flow diagrams produced by the feature engine must be original. App names, descriptions, icons, and Apple metadata are third-party material, not covered by this project's source-code license.

The ingestion approach was informed by [archies-appstore-lookup](https://github.com/soloiaros/archies-appstore-lookup), whose source is MIT licensed (copyright 2026 soloiaros, with upstream notices for Aayan Ali). This implementation uses independently written feed parsing and feature rules. Its reference database was not copied. We intentionally do not adopt the reference's `us-grossing-power-v1` revenue curve: a fixed rank-based curve does not establish revenue for an individual app.

Apple's [Search API documentation](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html) describes the public API. App Store content and artwork remain subject to their owners' terms.
