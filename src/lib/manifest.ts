/** Extract only package names and versions; never retain scripts, secrets or arbitrary manifest fields. */
export function manifestDependencies(source: string): string[] {
  if (!source.trim()) return [];
  if (source.length > 30_000) throw new Error('Paste just the dependencies and devDependencies from your package.json.');
  let data: unknown;
  try { data = JSON.parse(source); } catch { throw new Error('Paste valid package.json JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Use a package.json object.');
  const manifest = data as Record<string, unknown>;
  const dependencies = [manifest.dependencies, manifest.devDependencies].flatMap(group =>
    group && typeof group === 'object' && !Array.isArray(group) ? Object.entries(group) : []);
  return [...new Set(dependencies.filter(([name, version]) =>
    /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) && typeof version === 'string' && /^[0-9v^~*<>=|. x+-]{1,40}$/.test(version)
  ).map(([name, version]) => `${name}@${version}`))].slice(0, 40);
}
