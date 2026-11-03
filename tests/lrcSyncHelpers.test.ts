import { describe, expect, it } from 'vitest';

import {
  formatLrcTimestamp,
  nudgeTimestamp,
  parseLrcTimestamp,
  shiftAllLrcTimestamps,
  shiftLinesTimestamps,
  stampLyricLine,
  stripLrcTimestamps
} from '../src/renderer/utils/lyrics';

describe('LRC Sync Helpers', () => {
  describe('formatLrcTimestamp', () => {
    it('formats 0 seconds into [00:00.00]', () => {
      expect(formatLrcTimestamp(0)).toBe('[00:00.00]');
    });

    it('formats 65.34 into [01:05.34]', () => {
      expect(formatLrcTimestamp(65.34)).toBe('[01:05.34]');
    });

    it('formats boundary seconds properly', () => {
      expect(formatLrcTimestamp(59.99)).toBe('[00:59.99]');
      expect(formatLrcTimestamp(60.0)).toBe('[01:00.00]');
    });

    it('clamps negative and invalid values to 0', () => {
      expect(formatLrcTimestamp(-5)).toBe('[00:00.00]');
      expect(formatLrcTimestamp(NaN)).toBe('[00:00.00]');
    });
  });

  describe('parseLrcTimestamp', () => {
    it('parses [mm:ss.xx] correctly', () => {
      expect(parseLrcTimestamp('[01:05.34]')).toBeCloseTo(65.34, 2);
      expect(parseLrcTimestamp('[00:00.00]')).toBe(0);
      expect(parseLrcTimestamp('[02:30.50]')).toBeCloseTo(150.5, 2);
    });

    it('parses timestamps without brackets', () => {
      expect(parseLrcTimestamp('01:10.00')).toBeCloseTo(70, 2);
    });

    it('parses 3-digit millisecond timestamps', () => {
      expect(parseLrcTimestamp('[01:05.500]')).toBeCloseTo(65.5, 2);
    });

    it('returns NaN for invalid strings', () => {
      expect(isNaN(parseLrcTimestamp('invalid'))).toBe(true);
      expect(isNaN(parseLrcTimestamp(''))).toBe(true);
    });
  });

  describe('nudgeTimestamp', () => {
    it('nudges positively by given delta seconds', () => {
      expect(nudgeTimestamp('[01:00.00]', 0.5)).toBe('[01:00.50]');
      expect(nudgeTimestamp('[01:00.00]', 1.0)).toBe('[01:01.00]');
      expect(nudgeTimestamp('[01:00.00]', 0.1)).toBe('[01:00.10]');
    });

    it('nudges negatively by given delta seconds', () => {
      expect(nudgeTimestamp('[01:00.50]', -0.5)).toBe('[01:00.00]');
    });

    it('clamps result at 0 on negative overflow', () => {
      expect(nudgeTimestamp('[00:00.20]', -0.5)).toBe('[00:00.00]');
      expect(nudgeTimestamp('[00:00.00]', -10)).toBe('[00:00.00]');
    });
  });

  describe('shiftAllLrcTimestamps', () => {
    it('shifts all timestamps in a multiline LRC text', () => {
      const input = [
        '[00:01.00] First line',
        '[00:05.50] Second line',
        'Plain text without timestamp',
        '[01:00.00] Third line'
      ].join('\n');

      const shifted = shiftAllLrcTimestamps(input, 1.5);
      expect(shifted).toBe(
        [
          '[00:02.50] First line',
          '[00:07.00] Second line',
          'Plain text without timestamp',
          '[01:01.50] Third line'
        ].join('\n')
      );
    });

    it('clamps shifted timestamps at 0', () => {
      const input = '[00:01.00] Line one\n[00:03.00] Line two';
      const shifted = shiftAllLrcTimestamps(input, -2.0);
      expect(shifted).toBe('[00:00.00] Line one\n[00:01.00] Line two');
    });
  });

  describe('shiftLinesTimestamps', () => {
    it('shifts line states while preserving text and empty timestamps', () => {
      const lines = [
        { timestamp: '[00:01.00]', text: 'Line 1' },
        { timestamp: '', text: 'Line 2' },
        { timestamp: '[00:10.00]', text: 'Line 3' }
      ];

      const res = shiftLinesTimestamps(lines, 0.5);
      expect(res).toEqual([
        { timestamp: '[00:01.50]', text: 'Line 1' },
        { timestamp: '', text: 'Line 2' },
        { timestamp: '[00:10.50]', text: 'Line 3' }
      ]);
    });
  });

  describe('stampLyricLine and stripLrcTimestamps', () => {
    it('stamps timestamp on a line, replacing existing', () => {
      expect(stampLyricLine('[00:01.00] Hello', '[00:02.00]')).toBe('[00:02.00]Hello');
      expect(stampLyricLine('Plain line', 3.5)).toBe('[00:03.50]Plain line');
    });

    it('strips all timestamps from multiline text', () => {
      const text = '[00:01.00] Line 1\n[00:02.50] Line 2';
      expect(stripLrcTimestamps(text)).toBe('Line 1\nLine 2');
    });
  });
});
