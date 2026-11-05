/**
 * Audio fingerprinting via FFmpeg.
 *
 * Decodes up to two minutes of mono PCM and derives a loudness-envelope
 * signature. No external fingerprint service is involved; the signature is
 * stored in the local song database and used to recognise the same recording
 * across formats, bitrates and file names.
 */

import { spawn } from 'child_process';

import {
  FINGERPRINT_MAX_SECONDS,
  FINGERPRINT_WINDOW_SECONDS,
  type AudioFingerprint,
  quantizeLevel
} from '../../shared/acousticFingerprint';
import { getFfmpegPath } from './youtube';

const SAMPLE_RATE = 8000;

function decodePcm(filePath: string): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFfmpegPath();
    if (!ffmpeg) {
      reject(new Error('FFmpeg is unavailable'));
      return;
    }

    const args = [
      '-v',
      'error',
      '-t',
      String(FINGERPRINT_MAX_SECONDS),
      '-i',
      filePath,
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-f',
      's16le',
      '-'
    ];

    const chunks: Buffer[] = [];
    const proc = spawn(ffmpeg, args, { windowsHide: true });

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', () => {
      // FFmpeg diagnostics are irrelevant for a fingerprint.
    });
    proc.on('error', reject);
    proc.on('close', () => {
      const pcm = Buffer.concat(chunks);
      if (pcm.length < SAMPLE_RATE) {
        reject(new Error('Not enough decoded audio'));
        return;
      }
      // Copy so the Int16Array view is correctly aligned.
      const aligned = new Uint8Array(pcm.length);
      aligned.set(pcm);
      resolve(new Int16Array(aligned.buffer));
    });
  });
}

/**
 * Computes the acoustic fingerprint for a media file.
 * Returns null when the file cannot be decoded (video-only, corrupt, unsupported).
 */
export async function computeAudioFingerprint(filePath: string): Promise<AudioFingerprint | null> {
  try {
    const samples = await decodePcm(filePath);
    const windowSize = Math.round(SAMPLE_RATE * FINGERPRINT_WINDOW_SECONDS);
    const windowCount = Math.floor(samples.length / windowSize);
    if (windowCount < 4) return null;

    const energies: number[] = [];
    for (let w = 0; w < windowCount; w += 1) {
      let sum = 0;
      const start = w * windowSize;
      for (let i = start; i < start + windowSize; i += 1) {
        const sample = samples[i] / 32768;
        sum += sample * sample;
      }
      energies.push(Math.sqrt(sum / windowSize));
    }

    const peak = Math.max(...energies, 1e-6);
    const fingerprint = energies
      .map((energy) => quantizeLevel(energy / peak).toString(16))
      .join('');

    return {
      fingerprint,
      durationSec: Math.round((samples.length / SAMPLE_RATE) * 100) / 100,
      windows: windowCount
    };
  } catch (error) {
    console.warn('[fingerprint] failed:', filePath, error);
    return null;
  }
}
