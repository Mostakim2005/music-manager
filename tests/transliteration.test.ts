import { describe, expect, it } from 'vitest';

import {
  detectScriptAndRomanize,
  generateRomanizedLyricLrc,
  romanizeBangla,
  romanizeJapaneseKana
} from '../src/renderer/utils/transliteration';

describe('transliteration utilities', () => {
  it('romanizes Japanese Kana into clean Hepburn Romaji', () => {
    expect(romanizeJapaneseKana('サクラキミヲアイシテル')).toBe('sakurakimiwoaishiteru');
    expect(romanizeJapaneseKana('きっと、ずっと。')).toBe('kitto, zutto.');
    expect(romanizeJapaneseKana('しゃしん')).toBe('shashin');
    expect(romanizeJapaneseKana('きんえん')).toBe("kin'en");
    expect(romanizeJapaneseKana('コーヒー')).toBe('koohii');
    expect(romanizeJapaneseKana('スニーカー')).toBe('suniikaa');
  });

  it('romanizes Bangla script into natural phonetic Latin text', () => {
    expect(romanizeBangla('আমার সোনার বাংলা')).toBe('amar shonar bangla');
    expect(romanizeBangla('আমি তোমায় ভালোবাসি')).toBe('ami tomay bhalobashi');
    expect(romanizeBangla('তুমি রবে নীরবে')).toBe('tumi robe nirobe');
    expect(romanizeBangla('গান')).toBe('gan');
    expect(romanizeBangla('কর্ম')).toBe('kormo');
  });

  it('detects scripts and romanizes appropriately', () => {
    expect(detectScriptAndRomanize('サクラ')).toBe('sakura');
    expect(detectScriptAndRomanize('বাংলা')).toBe('bangla');
    expect(detectScriptAndRomanize('English Lyrics')).toBe('English Lyrics');
  });

  it('generates timestamp-aligned romanized LRC', () => {
    const rawLrc = `[00:10.00]Hello world
[00:15.50]サクラキミヲアイシテル
[00:20.00]আমার সোনার বাংলা
`;
    const romanized = generateRomanizedLyricLrc(rawLrc);
    expect(romanized).toContain('[00:10.00]Hello world');
    expect(romanized).toContain('[00:15.50]sakurakimiwoaishiteru');
    expect(romanized).toContain('[00:20.00]amar shonar bangla');

    // If pure Latin, returns empty string so we don't duplicate
    const latinLrc = `[00:10.00]Hello world\n[00:12.00]Just pure English\n`;
    expect(generateRomanizedLyricLrc(latinLrc)).toBe('');
  });
});
