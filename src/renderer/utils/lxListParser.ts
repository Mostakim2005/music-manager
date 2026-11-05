/**
 */

export type LxImportSong = {
  name: string;
  artist: string;
  album: string;
};

export type LxParseResult = {
  songs: LxImportSong[];
  skipped: number;
};

export const LX_LIST_MAX_FILE_SIZE = 5 * 1024 * 1024;

const BOM = '﻿';

export function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) return content.slice(1);
  if (content.startsWith(BOM)) return content.slice(1);
  return content;
}

function splitTxtLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (/ {2,}/.test(line)) return line.split(/ {2,}/);
  if (/\s[-–—|]\s/.test(line)) return line.split(/\s[-–—|]\s/);
  return [line];
}

export function parseLxTxt(content: string): LxParseResult {
  const songs: LxImportSong[] = [];
  let skipped = 0;
  const lines = stripBom(content).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = splitTxtLine(line)
      .map((p) => p.trim())
      .filter((p) => p !== '');
    const [name = '', artist = '', album = ''] = parts;
    if (!name) {
      skipped += 1;
      continue;
    }
    songs.push({ name, artist, album });
  }
  return { songs, skipped };
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = stripBom(content);
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // Ignore the carriage return; the paired \n closes the row
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADER_KEYWORD_RE =
  /歌曲|歌名|曲名|艺术家|歌手|演唱|album|music|song|name|singer|artist|title|track|perform|곡|제목|아티스트|앨범|楽曲|アーティスト|アルバム/i;

function isHeaderRow(cells: string[]): boolean {
  const matched = cells.filter((cell) => HEADER_KEYWORD_RE.test(cell.trim())).length;
  return matched >= 2;
}

export function parseLxCsv(content: string): LxParseResult {
  const songs: LxImportSong[] = [];
  let skipped = 0;
  const rows = parseCsvRows(content).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) return { songs, skipped };
  const dataRows = isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  for (const row of dataRows) {
    const [name = '', artist = '', album = ''] = row.map((cell) => cell.trim());
    if (!name) {
      skipped += 1;
      continue;
    }
    songs.push({ name, artist, album });
  }
  return { songs, skipped };
}

export function parseLxListFile(fileName: string, content: string): LxParseResult {
  if (/\.csv$/i.test(fileName.trim())) return parseLxCsv(content);
  return parseLxTxt(content);
}

export function isSupportedListFile(fileName: string): boolean {
  return /\.(txt|csv)$/i.test(fileName.trim());
}
