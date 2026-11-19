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
  type AudioFingerprint,
  FINGERPRINT_MAX_SECONDS,
  FINGERPRINT_WINDOW_SECONDS,
  quantizeLevel
} from '../../shared/acousticFingerprint';
import { getFfmpegPath } from './youtube';

const SAMPLE_RATE = 8000;
const WAVEFORM_MAX_SECONDS = 900;

function decodePcm(filePath: string, maxSeconds = FINGERPRINT_MAX_SECONDS): Promise<Int16Array> {
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
      String(maxSeconds),
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

/**
 * Downsamples a raw Int16 PCM sample array into `buckets` normalized RMS/peak values in `0..1`.
 */
export function computePeaksFromPcm(samples: Int16Array, buckets = 140): number[] {
  const safeBuckets = Math.max(16, Math.min(512, Math.floor(buckets) || 140));
  if (!samples || samples.length === 0) {
    return Array(safeBuckets).fill(0.25);
  }

  const samplesPerBucket = Math.max(1, Math.floor(samples.length / safeBuckets));
  const rawBuckets: number[] = [];

  for (let b = 0; b < safeBuckets; b += 1) {
    const start = b * samplesPerBucket;
    const end = Math.min(samples.length, start + samplesPerBucket);
    if (start >= samples.length || end <= start) {
      rawBuckets.push(0.18);
      continue;
    }
    let sumSq = 0;
    let maxAbs = 0;
    for (let i = start; i < end; i += 1) {
      const val = Math.abs(samples[i]) / 32768;
      sumSq += val * val;
      if (val > maxAbs) maxAbs = val;
    }
    const rms = Math.sqrt(sumSq / (end - start));
    // Blend RMS energy with peak transient so percussion and dynamics remain visible
    rawBuckets.push(rms * 0.65 + maxAbs * 0.35);
  }

  const globalPeak = Math.max(...rawBuckets, 1e-5);
  return rawBuckets.map((val) => {
    const normalized = Math.min(1, Math.max(0.14, val / globalPeak));
    return Math.round(normalized * 1000) / 1000;
  });
}

/**
 * Computes normalized acoustic waveform peaks (`0..1`) for a local media file via bundled FFmpeg.
 */
export async function computeWaveformPeaks(
  filePath: string,
  buckets = 140
): Promise<number[] | null> {
  try {
    const samples = await decodePcm(filePath, WAVEFORM_MAX_SECONDS);
    return computePeaksFromPcm(samples, buckets);
  } catch (error) {
    console.warn('[waveform] failed to decode PCM peaks:', filePath, error);
    return null;
  }
}
