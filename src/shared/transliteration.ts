// Zero-dependency Phonetic Transliteration Utilities
// Provides clean, MIT-licensed phonetic romanization for Japanese Kana (Hepburn Romaji)
// and Bangla (Bengali Unicode block \u0980-\u09FF) scripts for song lyrics subtitles.

const HIRAGANA_MAP: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'wo',
  ん: 'n',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゔ: 'vu'
};

const KANA_DIGRAPHS: Record<string, string> = {
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  きぇ: 'kye',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  しぇ: 'she',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  ちぇ: 'che',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  じぇ: 'je',
  ぢゃ: 'ja',
  ぢゅ: 'ju',
  ぢょ: 'jo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  ふぁ: 'fa',
  ふぃ: 'fi',
  ふぇ: 'fe',
  ふぉ: 'fo',
  ふゅ: 'fyu',
  ゔぁ: 'va',
  ゔぃ: 'vi',
  ゔぇ: 've',
  ゔぉ: 'vo',
  つぁ: 'tsa',
  つぃ: 'tsi',
  つぇ: 'tse',
  つぉ: 'tso',
  てぃ: 'ti',
  でぃ: 'di',
  とぅ: 'tu',
  どぅ: 'du',
  うぃ: 'wi',
  うぇ: 'we',
  うぉ: 'wo',
  くぁ: 'kwa',
  ぐぁ: 'gwa'
};

/**
 * Converts Hiragana and Katakana (including digraphs, sokuon, syllabic n, and long vowels)
 * into clean Hepburn Romaji.
 */
export function romanizeJapaneseKana(text: string): string {
  if (!text) return '';

  // Normalize full/half-width Katakana and NFKC form
  let normalized = text.normalize('NFKC');

  // Convert Katakana range \u30A1-\u30F4 to Hiragana \u3041-\u3094
  normalized = normalized.replace(/[\u30A1-\u30F4]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );

  let result = '';
  let i = 0;
  const len = normalized.length;

  while (i < len) {
    const ch = normalized[i];
    const next = i + 1 < len ? normalized[i + 1] : '';

    // Digraph check (2 kana characters)
    if (next && KANA_DIGRAPHS[ch + next]) {
      result += KANA_DIGRAPHS[ch + next];
      i += 2;
      continue;
    }

    // Sokuon (っ)
    if (ch === 'っ') {
      if (i + 1 < len) {
        const peekNext = normalized[i + 1];
        const peekPair = i + 2 < len ? normalized[i + 1] + normalized[i + 2] : '';
        const nextRomaji = KANA_DIGRAPHS[peekPair] || HIRAGANA_MAP[peekNext] || '';
        if (nextRomaji) {
          const firstChar = nextRomaji[0].toLowerCase();
          if (firstChar === 'c') {
            result += 't'; // Hepburn standard: 'tch' for ch
          } else if (/[a-z]/.test(firstChar)) {
            result += firstChar;
          }
          i++;
          continue;
        }
      }
      i++;
      continue;
    }

    // Syllabic n (ん) followed by vowel or y
    if (ch === 'ん') {
      if (next && (/[あいうえおやゆよ]/.test(next) || /[aeiouy]/i.test(next))) {
        result += "n'";
      } else {
        result += 'n';
      }
      i++;
      continue;
    }

    // Long vowel mark (ー)
    if (ch === 'ー') {
      const lastChar = result.slice(-1).toLowerCase();
      if (/[aeiou]/.test(lastChar)) {
        result += lastChar;
      } else {
        result += '-';
      }
      i++;
      continue;
    }

    // Single kana
    if (HIRAGANA_MAP[ch]) {
      result += HIRAGANA_MAP[ch];
      i++;
      continue;
    }

    // Common Japanese punctuation
    if (ch === '、') {
      result += ', ';
      i++;
      continue;
    }
    if (ch === '。') {
      result += '. ';
      i++;
      continue;
    }
    if (ch === '・') {
      result += ' ';
      i++;
      continue;
    }
    if (ch === '「' || ch === '」' || ch === '『' || ch === '』') {
      result += '"';
      i++;
      continue;
    }

    // Fallback passthrough (Kanji, Latin, numbers, spaces, ASCII punctuation)
    result += ch;
    i++;
  }

  return result.replace(/ {2,}/g, ' ').trim();
}

const BANGLA_INDEPENDENT_VOWELS: Record<string, string> = {
  অ: 'o',
  আ: 'a',
  ই: 'i',
  ঈ: 'i',
  উ: 'u',
  ঊ: 'u',
  ঋ: 'ri',
  এ: 'e',
  ঐ: 'oi',
  ও: 'o',
  ঔ: 'ou'
};

const BANGLA_VOWEL_SIGNS: Record<string, string> = {
  '\u09BE': 'a', // া
  '\u09BF': 'i', // ি
  '\u09C0': 'i', // ী
  '\u09C1': 'u', // ু
  '\u09C2': 'u', // ূ
  '\u09C3': 'ri', // ৃ
  '\u09C7': 'e', // ে
  '\u09C8': 'oi', // ৈ
  '\u09CB': 'o', // ো
  '\u09CC': 'ou' // ৌ
};

const BANGLA_CONSONANTS: Record<string, string> = {
  ক: 'k',
  খ: 'kh',
  গ: 'g',
  ঘ: 'gh',
  ঙ: 'ng',
  চ: 'ch',
  ছ: 'chh',
  জ: 'j',
  ঝ: 'jh',
  ঞ: 'n',
  ট: 't',
  ঠ: 'th',
  ড: 'd',
  ঢ: 'dh',
  ণ: 'n',
  ত: 't',
  থ: 'th',
  দ: 'd',
  ধ: 'dh',
  ন: 'n',
  প: 'p',
  ফ: 'f',
  ব: 'b',
  ভ: 'bh',
  ম: 'm',
  য: 'j',
  র: 'r',
  ল: 'l',
  শ: 'sh',
  ষ: 'sh',
  স: 'sh', // Default 'sh'; contextually 's' before dental/labial conjuncts
  হ: 'h',
  ড়: 'r',
  ঢ়: 'rh',
  য়: 'y',
  ৎ: 't'
};

const BANGLA_DIACRITICS: Record<string, string> = {
  'ং': 'ng', // Anusvara
  'ঃ': 'h', // Visarga
  'ঁ': '' // Chandrabindu (nasal indicator)
};

const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9'
};

/**
 * Converts Bangla (Bengali Unicode block \u0980-\u09FF) into readable Latin phonetic romanization.
 */
export function romanizeBangla(text: string): string {
  if (!text) return '';

  let result = '';
  const len = text.length;
  let i = 0;

  while (i < len) {
    const ch = text[i];

    // Independent Vowels
    if (BANGLA_INDEPENDENT_VOWELS[ch]) {
      result += BANGLA_INDEPENDENT_VOWELS[ch];
      i++;
      continue;
    }

    // Ref (র্) prefix on next consonant: 'র' (\u09B0) + hasanta (\u09CD) + consonant
    if (ch === 'র' && i + 2 < len && text[i + 1] === '\u09CD' && BANGLA_CONSONANTS[text[i + 2]]) {
      i += 2; // skip 'র' and hasanta; now text[i] is the consonant with ref
      const baseC = text[i];
      let consonantStr = 'r' + (baseC === 'স' ? 'sh' : BANGLA_CONSONANTS[baseC]);
      i++;

      // Check subsequent conjuncts or vowel signs
      while (i < len && text[i] === '\u09CD') {
        i++;
        if (i < len && BANGLA_CONSONANTS[text[i]]) {
          consonantStr += BANGLA_CONSONANTS[text[i]];
          i++;
        } else {
          break;
        }
      }

      if (i < len && BANGLA_VOWEL_SIGNS[text[i]]) {
        result += consonantStr + BANGLA_VOWEL_SIGNS[text[i]];
        i++;
      } else {
        // Ref clusters at word end retain inherent 'o' in Bengali (e.g. 'kormo', 'borno')
        result += consonantStr + 'o';
      }
      continue;
    }

    // Consonant
    if (BANGLA_CONSONANTS[ch]) {
      let consonantStr = BANGLA_CONSONANTS[ch];
      let hasConjunct = false;
      i++;

      // Check for conjuncts (Consonant + Hasanta + Consonant)
      while (i < len && text[i] === '\u09CD') {
        i++; // skip hasanta
        if (i < len && BANGLA_CONSONANTS[text[i]]) {
          hasConjunct = true;
          const nextC = text[i];
          if (ch === 'স' && /^[তথটঠপফককনরলবw]$/.test(nextC)) {
            // Pronounced 's' in conjuncts like st, sp, sk, etc.
            consonantStr = 's';
          }

          // Special conjunct phonetic rules
          if (ch === 'ক' && nextC === 'ষ') {
            consonantStr = 'kkh';
          } else if (ch === 'জ' && nextC === 'ঞ') {
            consonantStr = 'gy';
          } else if (nextC === 'য') {
            consonantStr += 'y';
          } else if (nextC === 'র') {
            consonantStr += 'r';
          } else if (nextC === 'ব') {
            consonantStr += 'w';
          } else {
            const nextPart = nextC === 'স' ? 's' : BANGLA_CONSONANTS[nextC];
            consonantStr += nextPart;
          }
          i++;
        } else {
          break;
        }
      }

      // Check if followed by vowel sign (kar)
      if (i < len && BANGLA_VOWEL_SIGNS[text[i]]) {
        result += consonantStr + BANGLA_VOWEL_SIGNS[text[i]];
        i++;
      } else {
        // No vowel sign. Check word boundary for inherent vowel 'o'
        const isWordEnd = i >= len || /[\s.,!?;:'"()—\-\u0964\u0965]/.test(text[i]);
        if (isWordEnd && !hasConjunct) {
          result += consonantStr;
        } else {
          // Word-internal consonants and word-final conjunct clusters retain inherent 'o'
          result += consonantStr + 'o';
        }
      }
      continue;
    }

    // Diacritics
    if (BANGLA_DIACRITICS[ch] !== undefined) {
      result += BANGLA_DIACRITICS[ch];
      i++;
      continue;
    }

    // Bangla punctuation
    if (ch === '।' || ch === '॥') {
      result += '.';
      i++;
      continue;
    }

    // Bangla digits
    if (BANGLA_DIGITS[ch]) {
      result += BANGLA_DIGITS[ch];
      i++;
      continue;
    }

    // Other characters (spaces, punctuation, latin chars)
    result += ch;
    i++;
  }

  return result.replace(/ {2,}/g, ' ').trim();
}

/**
 * Detects if a text string contains Japanese Kana or Bangla script and produces phonetic Romanized text.
 */
export function detectScriptAndRomanize(text: string): string {
  if (!text) return '';
  const hasKana = /[\u3040-\u309F\u30A0-\u30FF\uFF65-\uFF9F]/.test(text);
  const hasBangla = /[\u0980-\u09FF]/.test(text);

  if (hasKana && hasBangla) {
    return romanizeBangla(romanizeJapaneseKana(text));
  }
  if (hasKana) {
    return romanizeJapaneseKana(text);
  }
  if (hasBangla) {
    return romanizeBangla(text);
  }
  return text;
}

/**
 * Takes an LRC string (`[mm:ss.xx]line`), romanizes lines containing Japanese Kana or Bangla characters,
 * and returns a timestamp-aligned LRC string for `romalrc`.
 * If no lines contain non-Latin Kana or Bangla script, returns empty string.
 */
export function generateRomanizedLyricLrc(rawLrc: string): string {
  if (!rawLrc) return '';

  const lines = rawLrc.split(/\r?\n/);
  const resultLines: string[] = [];
  let romanizedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      resultLines.push('');
      continue;
    }

    // Match leading timestamps, e.g. [00:12.34] or multiple timestamps [00:12.34][00:45.67]
    const match = trimmed.match(/^((?:\[\d{2,}:\d{2}(?:\.\d{2,3})?\])+)(.*)$/);
    if (match) {
      const timestamps = match[1];
      const content = match[2].trim();
      const hasKanaOrBangla = /[\u3040-\u309F\u30A0-\u30FF\uFF65-\uFF9F\u0980-\u09FF]/.test(
        content
      );
      if (hasKanaOrBangla) {
        const romanized = detectScriptAndRomanize(content);
        resultLines.push(`${timestamps}${romanized}`);
        romanizedCount++;
      } else {
        resultLines.push(trimmed);
      }
    } else {
      resultLines.push(trimmed);
    }
  }

  // Return empty string if no lines were romanized
  if (romanizedCount === 0) {
    return '';
  }

  return resultLines.join('\n');
}
