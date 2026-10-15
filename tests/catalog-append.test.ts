import { describe, expect, it } from 'vitest';
import { chartEntries, selectNewTrackIds, withoutDuplicates } from '../scripts/catalog-feed.mjs';

describe('chart catalog append', () => {
  it('rejects broken feed responses instead of reporting no new apps', () => {
    expect(() => chartEntries({ error: 'temporarily unavailable' })).toThrow('missing feed entries');
    expect(chartEntries({ feed: { entry: [] } })).toEqual([]);
  });

  it('ignores invalid IDs and honors an exhausted budget', () => {
    const rows = [NaN, -1, 1.5, Infinity, 2, 3].map(trackId => ({ trackId, rank: 1 }));
    expect(selectNewTrackIds([], rows, 0)).toEqual([]);
    expect(selectNewTrackIds([], rows, 1)).toEqual([2]);
    expect(selectNewTrackIds([2], rows, 10)).toEqual([3]);
  });

  it('keeps higher chart positions and skips ids already stored', () => {
    const rows = [
      { trackId: 2, rank: 4 },
      { trackId: 9, rank: 1 },
      { trackId: 9, rank: 8 },
      { trackId: 4, rank: 2 },
      { trackId: 0, rank: 1 },
    ];
    expect(selectNewTrackIds([2, 4], rows, 10)).toEqual([9]);
  });

  it('does not add a second record for the same track id or bundle id', () => {
    const existing = [{ trackId: 10, bundleId: 'com.example.kept' }, { trackId: 11, bundleId: 'com.example.other' }];
    const incoming = [
      { trackId: 10, bundleId: 'com.example.kept', name: 'Kept' },
      { trackId: 12, bundleId: 'com.example.kept', name: 'Same bundle' },
      { trackId: 13, bundleId: 'com.example.new', name: 'New' },
      { trackId: 13, bundleId: 'com.example.new', name: 'New again' },
    ];
    expect(withoutDuplicates(existing, incoming).map((app) => app.trackId)).toEqual([13]);
  });
});
