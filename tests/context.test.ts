import { expect, it } from 'vitest';
import { manifestDependencies } from '../src/lib/manifest';
import { detectTechnologies, parseProject } from '../worker/security';
import { generateBrief } from '../worker/brief';
import { analyze, matchFeatures } from '../worker/engine';

it('extracts packages without scripts, credentials or private dependency URLs', () => {
  expect(manifestDependencies(JSON.stringify({ scripts: { build: 'secret' }, dependencies: { react: '^19.0.0', private: 'https://token@host/repo', evil: 'bad\nvalue' }, devDependencies: { typescript: '~5.9.0' } }))).toEqual(['react@^19.0.0', 'typescript@~5.9.0']);
  expect(() => manifestDependencies('{')).toThrow('valid');
});
it('reports passive signals without confusing ordinary prose with technology', () => {
  expect(detectTechnologies('<p>We migrated away from Next.js</p>')).toEqual([]);
  expect(detectTechnologies('<script src="/_next/static/main.js"></script>')).toEqual(['Next.js']);
});
it('carries owner constraints and typed requirements into the complete kit', async () => {
  const analysis = await analyze({ input: 'A private daily journal with reminders and a searchable timeline.', profile: { platform: 'Web', stack: 'Vue', integrationNotes: 'Use existing entries table and /journal route.', dependencies: ['vue@^3.5.0'] } }, {});
  const matches = await matchFeatures(analysis.project, analysis.features, {});
  const project = parseProject(analysis.project);
  const brief = generateBrief(project, matches.matches[0]);
  expect(brief.markdown).toContain('Use existing entries table');
  expect(brief.markdown).toContain('vue@^3.5.0');
  expect(brief.markdown).not.toContain('For React/Web:');
  expect(generateBrief({ ...project, platform: 'iOS', stack: 'Use existing stack' }, matches.matches[0]).markdown).not.toContain('For SwiftUI:');
  const contract = JSON.parse(brief.files.find(file => file.name === 'implementation-contract.json')!.content);
  expect(contract.acceptanceCriteria.length).toBeGreaterThan(0);
  expect(contract.project.constraints).toContain('/journal');
});
