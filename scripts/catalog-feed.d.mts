export interface ChartRow {
  trackId: number;
  rank: number;
}

export interface CatalogIdentity {
  trackId?: number;
  bundleId?: string;
}

export function selectNewTrackIds(existingIds: Iterable<number>, chartRows: ChartRow[], limit: number): number[];
export function withoutDuplicates<T extends CatalogIdentity>(existing: T[], incoming: T[]): T[];
export function chartEntries(payload: unknown): unknown[];
