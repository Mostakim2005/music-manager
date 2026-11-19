import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AudioDspGraph,
  createDefaultEqBands,
  parseAutoEqProfile
} from '../src/renderer/services/audioDspGraph';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  };
}

function createFakeAudioContextEnv() {
  let createSourceCalls = 0;

  class FakeAudioParam {
    value = 0;
    setValueAtTime = vi.fn((val: number) => {
      this.value = val;
    });
    cancelScheduledValues = vi.fn();
  }

  class FakeNode {
    channelCount = 2;
    channelCountMode = 'max';
    channelInterpretation = 'speakers';
    fftSize = 128;
    smoothingTimeConstant = 0.8;
    type = 'peaking';
    frequency = new FakeAudioParam();
    Q = new FakeAudioParam();
    gain = new FakeAudioParam();
    connect = vi.fn();
    disconnect = vi.fn();
  }

  class FakeAudioContext {
    sampleRate = 48000;
    state = 'running';
    currentTime = 0;
    destination = new FakeNode();
    sinkId = 'default';

    createMediaElementSource = vi.fn(() => {
      createSourceCalls += 1;
      return new FakeNode();
    });
    createGain = vi.fn(() => new FakeNode());
    createBiquadFilter = vi.fn(() => new FakeNode());
    createAnalyser = vi.fn(() => new FakeNode());
    setSinkId = vi.fn(async (id: string) => {
      this.sinkId = id;
    });
  }

  return {
    FakeAudioContext,
    getCreateSourceCalls: () => createSourceCalls
  };
}

describe('Milestone C: Web Audio DSP Graph, Parametric AutoEQ & Guardrails', () => {
  const origLocalStorage = globalThis.localStorage;
  const origAudioContext = (globalThis as any).AudioContext;

  beforeEach(() => {
    (globalThis as any).localStorage = createMemoryStorage();
  });

  afterEach(() => {
    (globalThis as any).localStorage = origLocalStorage;
    (globalThis as any).AudioContext = origAudioContext;
    vi.restoreAllMocks();
  });

  it('parses EqualizerAPO / AutoEQ profiles with Preamp, PK, LSC, HSC and skips invalid lines', () => {
    const sample = `
# AutoEQ Sennheiser HD 600
Preamp: -6.2 dB
Filter 1: ON LSC Fc 105 Hz Gain 4.1 dB Q 0.70
Filter 2: ON PK Fc 1000.5 Hz Gain -2.3 dB Q 1.85
Filter 3: OFF PK Fc 500 Hz Gain 5 dB Q 1.0
Invalid noise line
Filter 4: ON HSC Fc 10000 Hz Gain 3.0 dB Q 0.71
Preamp: -100 dB
`;
    const parsed = parseAutoEqProfile(sample);
    // Clamped preamp from second Preamp line (-100 -> -24)
    expect(parsed.preampDb).toBe(-24);
    expect(parsed.bands).toHaveLength(3);
    expect(parsed.bands[0]).toEqual({
      frequency: 105,
      gain: 4.1,
      q: 0.7,
      type: 'lowshelf'
    });
    expect(parsed.bands[1]).toEqual({
      frequency: 1000.5,
      gain: -2.3,
      q: 1.85,
      type: 'peaking'
    });
    expect(parsed.bands[2]).toEqual({
      frequency: 10000,
      gain: 3,
      q: 0.71,
      type: 'highshelf'
    });
  });

  it('never calls createMediaElementSource twice for the same HTMLAudioElement and applies preservesPitch + mono', async () => {
    const env = createFakeAudioContextEnv();
    (globalThis as any).AudioContext = env.FakeAudioContext;

    const fakeAudio = {
      preservesPitch: true,
      webkitPreservesPitch: true,
      mozPreservesPitch: true
    } as unknown as HTMLAudioElement;

    const dspA = new AudioDspGraph();
    const ctx1 = dspA.attach(fakeAudio, true);
    expect(ctx1).not.toBeNull();
    expect(env.getCreateSourceCalls()).toBe(1);

    // Calling attach again on the same instance or a second graph reuses WeakMap source
    dspA.attach(fakeAudio, true);
    const dspB = new AudioDspGraph();
    dspB.attach(fakeAudio, true);
    expect(env.getCreateSourceCalls()).toBe(1);

    // preservesPitch toggles all browser vendor properties
    dspA.setPreservesPitch(false);
    expect((fakeAudio as any).preservesPitch).toBe(false);
    expect((fakeAudio as any).webkitPreservesPitch).toBe(false);
    expect((fakeAudio as any).mozPreservesPitch).toBe(false);

    // Mono downmix switches channelCountMode to explicit mono
    dspA.setMono(true);
    const channelNode = (dspA as any).channelModeNode;
    expect(channelNode.channelCount).toBe(1);
    expect(channelNode.channelCountMode).toBe('explicit');

    dspA.setMono(false);
    expect(channelNode.channelCount).toBe(2);
    expect(channelNode.channelCountMode).toBe('max');

    // Output device persistence & setSinkId delegation
    const ok = await dspA.setOutputDevice('dac-usb-1');
    expect(ok).toBe(true);
    expect(dspA.getState().outputDeviceId).toBe('dac-usb-1');
  });

  it('persists DSP state, supports AutoEQ import, resetToFlat, and accurate Signal Path reporting', () => {
    const env = createFakeAudioContextEnv();
    (globalThis as any).AudioContext = env.FakeAudioContext;
    const fakeAudio = {} as HTMLAudioElement;

    const graph = new AudioDspGraph();
    graph.attach(fakeAudio, true);

    const profile = [
      'Preamp: -4.5 dB',
      'Filter 1: ON LSC Fc 80 Hz Gain 4.5 dB Q 0.71',
      'Filter 2: ON PK Fc 3200 Hz Gain -2.0 dB Q 2.1'
    ].join('\n');

    const res = graph.applyAutoEqText(profile);
    expect(res.applied).toBe(true);
    expect(res.bandsCount).toBe(2);
    expect(res.preampDb).toBe(-4.5);

    const info = graph.getSignalPathInfo({
      playbackRate: 1.25,
      replayGainEnabled: true,
      gaplessEnabled: true,
      sourceKind: 'Local File',
      codecLabel: 'FLAC | 940 kbps'
    });

    expect(info.isParametric).toBe(true);
    expect(info.eqEnabled).toBe(true);
    expect(info.preampDb).toBe(-4.5);
    expect(info.activeBandsCount).toBe(2);
    expect(info.sampleRate).toBe(48000);
    expect(info.playbackRate).toBe(1.25);
    expect(info.gaplessEnabled).toBe(true);
    expect(info.codecLabel).toBe('FLAC | 940 kbps');

    // Rehydrates from localStorage cleanly
    const rehydrated = new AudioDspGraph();
    expect(rehydrated.getState().preampDb).toBe(-4.5);
    expect(rehydrated.getState().bands).toHaveLength(2);

    // Reset returns to default 10-band flat graphic EQ
    const reset = graph.resetToFlat();
    expect(reset.preampDb).toBe(0);
    expect(reset.bands).toEqual(createDefaultEqBands());
  });
});
