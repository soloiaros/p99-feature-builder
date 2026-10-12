/** Refresh a small US App Store corpus from Apple's public feeds. Node 20+. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const catalogPath = fileURLToPath(new URL('../data/catalog.json', import.meta.url));
const limit = Math.max(18, Math.min(3000, Number(process.env.CATALOG_LIMIT) || 1000));
const demoIds = [570060128, 963034692, 1528595748, 866450515, 493145008, 571800810,
  426826309, 387771637, 341232718, 572688855, 626144601, 1232780281, 1016366447,
  1010865877, 1454778585, 1523682319, 1499198946, 1458862350];
const genres = [
  [6013, 'Health & Fitness'], [6007, 'Productivity'], [6017, 'Education'],
  [6012, 'Lifestyle'], [6015, 'Finance'], [6011, 'Music'], [6008, 'Photo & Video'],
  [6005, 'Social Networking'], [6003, 'Travel'], [6023, 'Food & Drink'],
];
const featurePatterns = [
  ['streaks', /\bstreaks?\b/i],
  ['widgets', /\bwidgets?\b/i],
  ['onboarding', /\bonboarding\b|\b(personality|assessment|personalization|personalisation|initial|short|quick) (quiz|questionnaire|assessment)\b|\bpersonalized (plan|program)\b/i],
  ['reminders', /\breminders?\b|\breminds? you\b|\b(push|custom|smart|scheduled|rich) notifications?\b/i],
  ['progress', /\b(progress tracking|track your progress|track your exercise progress|visualize progress|progress charts?|progress graphs?|progress reports?|goal tracking|goal tracker)\b/i],
  ['social', /\b(leaderboards?|community challenges|follow your friends?|share your tasks|shared focus|share.*with friends|co-plant|social feed|group challenges)\b/i],
  ['gamification', /\b(gamif\w*|achievements?|earn rewards|playful rewards|unlock.*rewards|earn.*badges|collect.*characters)\b/i],
  ['insights', /\b(analytics|insights|statistics|detailed stats|monthly recaps|muscle group graphs|activity.*charts)\b/i],
  ['focus', /\b(focus timer|pomodoro|focus sessions?|block distracting|app blocker|distraction blocker|screen time limits?)\b/i],
  ['logging', /\b(log your|log workouts?|food logging|food diary|journaling|mood tracker|water log|logs calendar|record daily|habit tracker|workout tracker|track calories)\b/i],
  ['personalization', /\b(personalized|personalised|customizable|customisable|personalize your|personalise your|custom themes?|color themes?|customize.*appearance)\b/i],
  ['offline', /\b(offline|without (an? )?internet|no internet required)\b/i],
  ['search', /\b(search your|search for text|full.text search|powerful search|search notes|search filters|search.*library)\b/i],
  ['sync', /\b(syncs?|synchroni[sz]\w*|real.time updates between devices)\b/i],
  ['subscriptions', /\b(subscriptions?|monthly.*annual|premium.*plan)\b/i],
];

// A match is an auditable retrieval hint, never independent proof of product quality.
function enrich(app) {
  const text = app.description || '';
  const features = [];
  for (const [id, pattern] of featurePatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const matchAt = match.index;
    const previousBreak = Math.max(text.lastIndexOf('\n', matchAt), text.lastIndexOf('. ', matchAt));
    const start = Math.max(previousBreak < 0 ? 0 : previousBreak + 1, matchAt - 150);
    const nextBreaks = [text.indexOf('\n', matchAt + match[0].length), text.indexOf('. ', matchAt + match[0].length)].filter(x => x >= 0);
    const end = Math.min(nextBreaks.length ? Math.min(...nextBreaks) + 1 : text.length, matchAt + match[0].length + 250);
    features.push({ id, evidence: text.slice(start, end).trim(), confidence: 'medium',
      sourceUrl: app.metadataSource, method: 'description-keyword-v1', tier: 'estimated' });
  }
  return { ...app, features };
}

async function save(snapshot) {
  await mkdir(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true });
  const apps = snapshot.apps.slice(0, limit).map(enrich);
  const output = { schemaVersion: 1, capturedAt: snapshot.capturedAt, country: 'us',
    source: 'Apple iTunes Lookup API and public US chart RSS feeds',
    featureMethod: 'description-keyword-v1', appCount: apps.length, apps,
    failures: snapshot.failures || [] };
  await writeFile(catalogPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`Saved ${apps.length} apps and ${apps.reduce((n, app) => n + app.features.length, 0)} evidence-backed feature hints to ${catalogPath}`);
}

// Reapply enrichment without any network calls: node scripts/seed-catalog.mjs --from data/catalog.json
const fromIndex = process.argv.indexOf('--from');
if (fromIndex !== -1) {
  if (!process.argv[fromIndex + 1]) throw new Error('--from requires a JSON snapshot path');
  await save(JSON.parse(await readFile(process.argv[fromIndex + 1], 'utf8')));
} else {
  const capturedAt = new Date().toISOString();
  const charts = [];
  const failures = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function json(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'FeatureEngineCatalog/1.0' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (attempt === 2) throw error;
        await wait(1500 * 2 ** attempt);
      }
    }
  }
  for (const [genreId, category] of genres) {
    for (const [chart, legacy] of [['top-free', 'topfreeapplications'], ['top-paid', 'toppaidapplications'], ['top-grossing', 'topgrossingapplications']]) {
      const sourceUrl = `https://itunes.apple.com/us/rss/${legacy}/limit=100/genre=${genreId}/json`;
      try {
        const payload = await json(sourceUrl);
        const entries = Array.isArray(payload?.feed?.entry) ? payload.feed.entry : [];
        charts.push(...entries.map((entry, index) => ({ trackId: Number(entry.id?.attributes?.['im:id']), rank: index + 1,
          chart, genreId, category, country: 'us', sourceUrl, capturedAt })).filter(row => row.trackId > 0));
        console.log(`${category} ${chart}: ${entries.length}`);
      } catch (error) {
        failures.push({ sourceUrl, error: String(error) });
        console.warn(`${category} ${chart}: unavailable`);
      }
      await wait(300);
    }
  }
  // Interleave chart leaders across categories; keep known demonstration apps first.
  const ids = [...new Set([...demoIds, ...charts.sort((a, b) => a.rank - b.rank).map(row => row.trackId)])];
  const apps = [];
  for (let index = 0; index < ids.length && apps.length < limit; index += 200) {
    const batch = ids.slice(index, index + 200);
    const sourceUrl = `https://itunes.apple.com/lookup?id=${batch.join(',')}&country=us&entity=software`;
    try {
      const payload = await json(sourceUrl);
      for (const app of payload.results || []) {
        if (app.wrapperType !== 'software' || !app.trackId) continue;
        apps.push({ trackId: app.trackId, name: app.trackName, bundleId: app.bundleId, description: app.description,
          iconUrl: app.artworkUrl512 || app.artworkUrl100, storeUrl: app.trackViewUrl, sellerName: app.sellerName,
          primaryGenre: app.primaryGenreName, primaryGenreId: app.primaryGenreId, genres: app.genres,
          price: app.price, currency: app.currency, formattedPrice: app.formattedPrice,
          rating: app.averageUserRating ?? null, ratingCount: app.userRatingCount ?? null,
          releaseDate: app.releaseDate, version: app.version, currentVersionReleaseDate: app.currentVersionReleaseDate,
          minimumOsVersion: app.minimumOsVersion, releaseNotes: app.releaseNotes || '',
          metadataFetchedAt: capturedAt,
          metadataSource: `https://itunes.apple.com/lookup?id=${app.trackId}&country=us&entity=software`,
          charts: charts.filter(row => row.trackId === app.trackId) });
      }
      console.log(`Lookup: ${apps.length} apps`);
    } catch (error) {
      failures.push({ sourceUrl, error: String(error) });
      console.warn(`Lookup batch failed: ${String(error)}`);
    }
    await wait(800);
  }
  if (apps.length < limit) throw new Error(`Only retrieved ${apps.length}/${limit} apps; existing catalog preserved. Retry when Apple's feeds are available.`);
  await save({ capturedAt, apps, failures });
}
