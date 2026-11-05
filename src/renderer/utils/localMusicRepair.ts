/**
 * Heuristics that decide which local files are worth sending to the online
 * metadata lookup. Only files that clearly lack usable tags are selected, so an
 * automatic pass never overwrites a carefully curated library by default.
 */

export interface RepairableEntry {
  filePath: string;
  title?: string;
  artist?: string;
  album?: string;
}

const UNKNOWN_ARTIST = /^(unknown(\s*artist)?|various artists|<unknown>|artist)$/i;

export function fileBaseName(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).pop() || '';
  return fileName.replace(/\.[^.]+$/, '');
}

/** True when the entry's title or artist is missing/placeholder-like. */
export function needsMetadataRepair(entry: RepairableEntry): boolean {
  const title = (entry.title || '').trim();
  const artist = (entry.artist || '').trim();
  const base = fileBaseName(entry.filePath).trim();

  if (!title) return true;
  if (base && title.toLowerCase() === base.toLowerCase()) return true;
  if (!artist || UNKNOWN_ARTIST.test(artist)) return true;

  return false;
}

/**
 * Turns a file-name-like title into a search query: drops leading track numbers,
 * underscores and common separators ("01 - Artist - Title" -> "Artist - Title").
 */
export function toMetadataSearchTitle(title: string, filePath: string): string {
  const value = (title || fileBaseName(filePath)).trim();
  return value
    .replace(/^\d{1,3}[\s._-]+/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Applies the heuristics to a whole list. */
export function selectEntriesNeedingRepair<T extends RepairableEntry>(entries: T[]): T[] {
  return entries.filter(needsMetadataRepair);
}
