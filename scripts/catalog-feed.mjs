/** Shared Apple chart fetch, lookup, and dedupe for the catalog scripts. Node 20+. */
import { appendFile } from 'node:fs/promises';

export const coreGenres = [
  [6013, 'Health & Fitness'], [6007, 'Productivity'], [6017, 'Education'],
  [6012, 'Lifestyle'], [6015, 'Finance'], [6011, 'Music'], [6008, 'Photo & Video'],
  [6005, 'Social Networking'], [6003, 'Travel'], [6023, 'Food & Drink'],
];
export const extraGenres = [
  [6000, 'Business'], [6002, 'Utilities'], [6004, 'Sports'], [6006, 'Reference'],
  [6009, 'News'], [6010, 'Navigation'], [6014, 'Games'], [6016, 'Entertainment'],
  [6018, 'Books'], [6020, 'Medical'], [6024, 'Shopping'], [6026, 'Developer Tools'],
  [6027, 'Graphics & Design'],
];
const charts = [['top-free', 'topfreeapplications'], ['top-paid', 'toppaidapplications'], ['top-grossing', 'topgrossingapplications']];
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

export function enrich(app) {
  const text = app.description || '';
  const features = [];
  for (const [id, pattern] of featurePatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const matchAt = match.index;
    const previousBreak = Math.max(text.lastIndexOf('\n', matchAt), text.lastIndexOf('. ', matchAt));
    const start = Math.max(previousBreak < 0 ? 0 : previousBreak + 1, matchAt - 150);
    const nextBreaks = [text.indexOf('\n', matchAt + match[0].length), text.indexOf('. ', matchAt + match[0].length)].filter((index) => index >= 0);
    const end = Math.min(nextBreaks.length ? Math.min(...nextBreaks) + 1 : text.length, matchAt + match[0].length + 250);
    features.push({
      id, evidence: text.slice(start, end).trim(), confidence: 'medium',
      sourceUrl: app.metadataSource, method: 'description-keyword-v1', tier: 'estimated',
    });
  }
  return { ...app, features };
}

export async function fetchCharts(genreList, capturedAt, { includeOverall = false } = {}) {
  const rows = [];
  const failures = [];
  const feeds = genreList.flatMap(([genreId, category]) => charts.map(([chart, legacy]) => ({
    chart, genreId, category, sourceUrl: `https://itunes.apple.com/us/rss/${legacy}/limit=100/genre=${genreId}/json`,
  })));
  if (includeOverall) {
    feeds.push(...charts.map(([chart, legacy]) => ({
      chart, genreId: null, category: 'All Categories', sourceUrl: `https://itunes.apple.com/us/rss/${legacy}/limit=100/json`,
    })));
  }
  for (const feed of feeds) {
    try {
      const payload = await json(feed.sourceUrl);
      const entries = Array.isArray(payload?.feed?.entry) ? payload.feed.entry : [];
      rows.push(...entries.map((entry, index) => ({
        trackId: Number(entry.id?.attributes?.['im:id']), rank: index + 1, chart: feed.chart,
        genreId: feed.genreId, category: feed.category, country: 'us', sourceUrl: feed.sourceUrl, capturedAt,
      })).filter((row) => row.trackId > 0));
      console.log(`${feed.category} ${feed.chart}: ${entries.length}`);
    } catch (error) {
      failures.push({ sourceUrl: feed.sourceUrl, error: String(error) });
      console.warn(`${feed.category} ${feed.chart}: unavailable`);
    }
    await wait(300);
  }
  return { rows, failures };
}

export function selectNewTrackIds(existingIds, chartRows, limit) {
  const known = existingIds instanceof Set ? existingIds : new Set(existingIds);
  const picked = [];
  const seen = new Set();
  const ranked = [...chartRows].sort((a, b) => a.rank - b.rank || a.trackId - b.trackId);
  for (const row of ranked) {
    if (!row.trackId || known.has(row.trackId) || seen.has(row.trackId)) continue;
    seen.add(row.trackId);
    picked.push(row.trackId);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function withoutDuplicates(existing, incoming) {
  const ids = new Set(existing.map((app) => app.trackId));
  const bundles = new Set(existing.map((app) => app.bundleId).filter(Boolean));
  const added = [];
  for (const app of incoming) {
    if (!app?.trackId || ids.has(app.trackId)) continue;
    if (app.bundleId && bundles.has(app.bundleId)) continue;
    ids.add(app.trackId);
    if (app.bundleId) bundles.add(app.bundleId);
    added.push(app);
  }
  return added;
}

export function catalogApp(app, chartRows, capturedAt) {
  return {
    trackId: app.trackId, name: app.trackName, bundleId: app.bundleId, description: app.description,
    iconUrl: app.artworkUrl512 || app.artworkUrl100, storeUrl: app.trackViewUrl, sellerName: app.sellerName,
    primaryGenre: app.primaryGenreName, primaryGenreId: app.primaryGenreId, genres: app.genres,
    price: app.price, currency: app.currency, formattedPrice: app.formattedPrice,
    rating: app.averageUserRating ?? null, ratingCount: app.userRatingCount ?? null,
    releaseDate: app.releaseDate, version: app.version, currentVersionReleaseDate: app.currentVersionReleaseDate,
    minimumOsVersion: app.minimumOsVersion, releaseNotes: app.releaseNotes || '',
    metadataFetchedAt: capturedAt,
    metadataSource: `https://itunes.apple.com/lookup?id=${app.trackId}&country=us&entity=software`,
    charts: chartRows.filter((row) => row.trackId === app.trackId),
  };
}

export async function lookupSoftware(ids, chartRows, capturedAt, maxApps = Infinity) {
  const apps = [];
  const failures = [];
  for (let index = 0; index < ids.length && apps.length < maxApps; index += 200) {
    const batch = ids.slice(index, index + 200);
    const sourceUrl = `https://itunes.apple.com/lookup?id=${batch.join(',')}&country=us&entity=software`;
    try {
      const payload = await json(sourceUrl);
      for (const app of payload.results || []) {
        if (app.wrapperType !== 'software' || !app.trackId) continue;
        apps.push(catalogApp(app, chartRows, capturedAt));
      }
      console.log(`Lookup: ${apps.length} apps`);
    } catch (error) {
      failures.push({ sourceUrl, error: String(error) });
      console.warn(`Lookup batch failed: ${String(error)}`);
    }
    await wait(800);
  }
  return { apps, failures };
}

export async function setOutput(key, value) {
  const line = `${key}=${String(value).replace(/\r?\n/g, ' ')}\n`;
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, line);
  else console.log(`output ${line.trim()}`);
}
