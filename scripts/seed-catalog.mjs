/** Refresh a small US App Store corpus from Apple's public feeds. Node 20+. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { coreGenres, enrich, fetchCharts, lookupSoftware } from './catalog-feed.mjs';

const catalogPath = fileURLToPath(new URL('../data/catalog.json', import.meta.url));
const limit = Math.max(18, Math.min(3000, Number(process.env.CATALOG_LIMIT) || 1000));
const demoIds = [570060128, 963034692, 1528595748, 866450515, 493145008, 571800810,
  426826309, 387771637, 341232718, 572688855, 626144601, 1232780281, 1016366447,
  1010865877, 1454778585, 1523682319, 1499198946, 1458862350];

async function save(snapshot) {
  await mkdir(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true });
  const apps = snapshot.apps.slice(0, limit).map(enrich);
  const output = {
    schemaVersion: 1, capturedAt: snapshot.capturedAt, country: 'us',
    source: 'Apple iTunes Lookup API and public US chart RSS feeds',
    featureMethod: 'description-keyword-v1', appCount: apps.length, apps,
    failures: snapshot.failures || [],
  };
  await writeFile(catalogPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Saved ${apps.length} apps and ${apps.reduce((count, app) => count + app.features.length, 0)} evidence-backed feature hints to ${catalogPath}`);
}

const fromIndex = process.argv.indexOf('--from');
if (fromIndex !== -1) {
  if (!process.argv[fromIndex + 1]) throw new Error('--from requires a JSON snapshot path');
  await save(JSON.parse(await readFile(process.argv[fromIndex + 1], 'utf8')));
} else {
  const capturedAt = new Date().toISOString();
  const { rows: charts, failures } = await fetchCharts(coreGenres, capturedAt);
  const ids = [...new Set([...demoIds, ...[...charts].sort((a, b) => a.rank - b.rank).map((row) => row.trackId)])];
  const lookedUp = await lookupSoftware(ids, charts, capturedAt, limit);
  if (lookedUp.apps.length < limit) throw new Error(`Only retrieved ${lookedUp.apps.length}/${limit} apps; existing catalog preserved. Retry when Apple's feeds are available.`);
  await save({ capturedAt, apps: lookedUp.apps, failures: [...failures, ...lookedUp.failures] });
}
