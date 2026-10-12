# Reference implementation and design decisions

Research checked on 12 October 2026.

## The 10K reference

The technical reference is [soloiaros/archies-appstore-lookup](https://github.com/soloiaros/archies-appstore-lookup), inspected at commit `6a1c3aad40db3fdec2e012685a4af2cc805e91c8`. The deployed example is [10K App Research](https://10k.aauburn.com/).

Its architecture separates inexpensive candidate retrieval from a single Jev evaluation of the shortlist. The catalog is built from Apple's public chart and Lookup APIs; metadata and dated chart/rating snapshots have separate provenance. The cloud deployment uses a Next.js/OpenNext Worker, D1, Workers AI text embeddings, Durable Objects, and an optional SigLIP container for visual icon search. The repository does not include its SQLite catalog.

p99 adopts the useful boundaries: collect source data ahead of time, attach evidence, retrieve a bounded candidate set, ask Jev specific judgments, and keep unavailable metrics visibly unavailable. The current feature engine does not need the reference's image embeddings, OCR, container, presence tracking, authentication, or local SQLite pipeline. The bundled catalog and ordinary Worker HTTP requests are sufficient for the demo and require no local server after deployment.

The reference's [MIT license](https://github.com/soloiaros/archies-appstore-lookup/blob/main/LICENSE) names copyright 2026 soloiaros. Its [NOTICE](https://github.com/soloiaros/archies-appstore-lookup/blob/main/NOTICE) retains attribution for Aayan Ali's MIT-licensed [aayans-yc-indexor](https://github.com/Aayan-DEV/aayans-yc-indexor). Any copied substantial source must retain the applicable copyright and permission notices. The implementation here was written independently; Apple metadata and artwork are third-party material and are not licensed by either repository's MIT grant.

## Jev's role

TypeSafe's [API reference](https://docs.typesafe.ai/api) defines a typed evaluation API, not a text-generation API. Requests contain a model, shared state, and named questions. Noul answers provide a value from zero to one, while Choice and Score expose their corresponding distributions. The same response IDs map back to the questions. Missing or invalid answers must stay unavailable, never become invented default probabilities.

The [fan-out pattern](https://docs.typesafe.ai/patterns/fan-out) supports asking many independent questions against shared state in one request. This makes a bounded feature vocabulary and candidate-by-candidate matching a practical fit. The [re-ranking cookbook](https://docs.typesafe.ai/cookbooks/rerank_typesafe) also makes a critical limitation clear: a re-ranker only sees candidates that retrieval puts on its shortlist. A fast but overly narrow shortlist can exclude the right app before Jev has a chance to judge it.

The [model limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) explicitly distinguish judgments from generation, arithmetic, and adversarial input handling. p99 therefore uses feature templates for long build briefs, performs date and numeric calculations in code, treats fetched pages as untrusted text, and validates returned values. The [model reference](https://docs.typesafe.ai/models) is the source for current model names, context budgets, and pricing; configuration should remain server-side.

## Evidence and matching quality

The exact feature requested by the developer takes priority over broad category resemblance. For example, a searchable journal should favor a text-search reference over a dating app's profile filters; a strength-training logger should favor workout logging over a food diary. Feature templates include general terms such as “goal” and “daily”, but those terms alone must not decide the shortlist or override explicitly requested features.

The offline keyword index is a retrieval aid. Its feature hints are estimated, and its excerpts are publisher statements. Short headings such as “STREAKS” or “PROGRESS TRACKING” are weaker evidence than a sentence describing actual behavior. Phrases such as “personalized plan” do not establish that a product uses an onboarding quiz. Match explanations must preserve this distinction even when a model assigns high textual relevance.

Useful feature references in the collected snapshot include Streaks for a streak ledger and reminders, Finch for reflective logging and mood insights, Bear for note search, Hevy for strength-workout logging and progress graphs, Fitbod for personalized workouts, Forest for focus sessions, and Waterllama for hydration reminders and widgets. These are candidate anchors backed by catalog descriptions, not claims of independently measured feature performance.

See [DATA.md](./DATA.md) for the catalog schema, source boundaries, and refresh method. Ratings are counts of ratings, not written reviews. Ratings and chart position are app-level adoption signals; they do not show that a specific feature caused success. Revenue remains unavailable because this build has no defensible revenue source. It intentionally does not reproduce the reference's fixed grossing-rank revenue curve.

## Visual reference and original output

The requested [Icon Museum](https://icon.museum/) direction informs the quiet background, restrained type, generous spacing, and emphasis on individual icons. It does not license copying the site's code or assets. The latest direction also uses the spacious interfaces.dev header as inspiration. p99's square pink robot is supplied by Fayaz Ahmed's MIT-licensed robot-heads library, with its license retained in public/licenses/robot-heads.txt. The layout implementation, wireframes, flow diagrams, and implementation instructions are original. App icons identify the referenced products through their Apple-hosted URLs; other developers' screenshots and branded UI assets are excluded from downloaded build bundles.
