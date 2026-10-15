/** Append US App Store top-chart apps that are not already in data/catalog.json. */
import { appendFile, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { coreGenres, enrich, extraGenres, fetchCharts, lookupSoftware, selectNewTrackIds, setOutput, withoutDuplicates } from './catalog-feed.mjs';

const catalogPath = fileURLToPath(new URL('../data/catalog.json', import.meta.url));
const addLimit = Math.max(1, Math.min(200, Number(process.env.CATALOG_ADD) || 80));
const maxApps = Math.max(18, Math.min(3000, Number(process.env.CATALOG_MAX) || 3000));
const dryRun = process.argv.includes('--dry-run');

const snapshot = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(snapshot.apps) || !snapshot.apps.length) throw new Error('Existing catalog missing or empty; refusing to overwrite it.');
const existing = snapshot.apps;
const room = maxApps - existing.length;
if (room <= 0) {
  console.log(`Catalog already has ${existing.length} apps, which meets the ${maxApps} cap.`);
  await setOutput('added', '0');
  process.exit(0);
}

const capturedAt = new Date().toISOString();
const { rows, failures } = await fetchCharts([...coreGenres, ...extraGenres], capturedAt, { includeOverall: true });
const wanted = Math.min(addLimit, room);
const ids = selectNewTrackIds(existing.map((app) => app.trackId), rows, wanted);
console.log(`${ids.length} chart apps are not in the catalog (${existing.length} already stored).`);
if (!ids.length) {
  await setOutput('added', '0');
  process.exit(0);
}
if (dryRun) {
  console.log(`Dry run. Would look up ${ids.length} new track ids.`);
  await setOutput('added', '0');
  process.exit(0);
}

const lookedUp = await lookupSoftware(ids, rows, capturedAt);
if (lookedUp.failures.length) throw new Error('App Store lookup failed. Catalog unchanged; retry later.');
const byId = new Map(lookedUp.apps.map((app) => [app.trackId, app]));
const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
const additions = withoutDuplicates(existing, ordered).slice(0, wanted).map(enrich);
if (!additions.length) {
  console.log('Lookup returned no new apps.');
  await setOutput('added', '0');
  process.exit(0);
}

const apps = [...existing, ...additions];
const output = {
  ...snapshot,
  capturedAt,
  appCount: apps.length,
  apps,
  failures: [...(snapshot.failures || []), ...failures].slice(-100),
};
// Keep the previous snapshot intact if the write is interrupted.
const temporaryPath = `${catalogPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryPath, catalogPath);
console.log(`Added ${additions.length} apps. Catalog now has ${apps.length}.`);
await setOutput('added', String(additions.length));
await setOutput('sample', additions.slice(0, 12).map((app) => app.name).join(', '));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `Added ${additions.length} apps; catalog now contains ${apps.length}. Skipped existing track IDs before lookup and existing bundle IDs before saving. ${failures.length} chart feeds unavailable. No AI calls.\n`);
