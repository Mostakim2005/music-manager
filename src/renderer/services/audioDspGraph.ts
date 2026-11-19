export interface EqBand {
  frequency: number;
  gain: number; // -24 to +24 dB (sliders clamp -12 to +12 dB)
  q: number; // default 1.41
  type: BiquadFilterType;
}

export interface AudioDspState {
  eqEnabled: boolean;
  preampDb: number;
  bands: EqBand[]; // 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz
  mono: boolean;
  preservesPitch: boolean;
  outputDeviceId: string;
}

export interface AudioSignalPathInfo {
  sampleRate: number;
  contextState: string;
  outputDeviceId: string;
  eqEnabled: boolean;
  preampDb: number;
  activeBandsCount: number;
  isParametric: boolean;
  mono: boolean;
  preservesPitch: boolean;
  playbackRate: number;
  replayGainEnabled: boolean;
  gaplessEnabled: boolean;
  sourceKind: string;
  codecLabel: string;
}

export const DEFAULT_EQ_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
] as const;

const DSP_STORAGE_KEY = 'music_manager_dsp_state_v1';

// Guardrail: never call createMediaElementSource twice for the same HTMLAudioElement
const elementSourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
const elementContextCache = new WeakMap<HTMLAudioElement, AudioContext>();

export function createDefaultEqBands(): EqBand[] {
  return DEFAULT_EQ_FREQUENCIES.map((frequency) => ({
    frequency,
    gain: 0,
    q: 1.41,
    type: 'peaking'
  }));
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function dbToLinear(db: number): number {
  return Math.pow(10, clampNumber(db, -24, 24, 0) / 20);
}

/**
 * Parses EqualizerAPO / AutoEQ parametric `.txt` profiles:
 *   Preamp: -6.2 dB
 *   Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 1.25
 *   Filter 2: ON LSC Fc 105 Hz Gain 4.1 dB Q 0.70
 *   Filter 3: ON HSC Fc 10000 Hz Gain -2.0 dB Q 0.71
 */
export function parseAutoEqProfile(text: string): { preampDb: number; bands: EqBand[] } {
  if (!text || typeof text !== 'string') {
    return { preampDb: 0, bands: [] };
  }

  let preampDb = 0;
  const bands: EqBand[] = [];
  const preampRegex = /^\s*Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*dB/i;
  const filterRegex =
    /^\s*Filter\s+\d+:\s+ON\s+(PK|LSC|HSC)\s+Fc\s+([\d.]+)\s+Hz\s+Gain\s+([+-]?[\d.]+)\s+dB\s+Q\s+([\d.]+)/i;

  for (const rawLine of text.split(/\r?\n/)) {
    const preampMatch = rawLine.match(preampRegex);
    if (preampMatch) {
      preampDb = clampNumber(parseFloat(preampMatch[1]), -24, 24, 0);
      continue;
    }

    const filterMatch = rawLine.match(filterRegex);
    if (filterMatch) {
      const code = filterMatch[1].toUpperCase();
      const type: BiquadFilterType =
        code === 'LSC' ? 'lowshelf' : code === 'HSC' ? 'highshelf' : 'peaking';
      const frequency = clampNumber(parseFloat(filterMatch[2]), 10, 22000, 1000);
      const gain = clampNumber(parseFloat(filterMatch[3]), -24, 24, 0);
      const q = clampNumber(parseFloat(filterMatch[4]), 0.1, 20, 1.41);
      bands.push({ frequency, gain, q, type });
    }
  }

  return { preampDb, bands };
}

function safeReadStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore storage errors in restricted contexts
  }
  return null;
}

function safeWriteStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage errors in restricted contexts
  }
}

export class AudioDspGraph {
  private state: AudioDspState;
  private audioEl: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampNode: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private channelModeNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private masterVolume = 1;

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): AudioDspState {
    const rawDsp = safeReadStorage(DSP_STORAGE_KEY);
    if (rawDsp) {
      try {
        const parsed = JSON.parse(rawDsp);
        const bands = Array.isArray(parsed.bands) && parsed.bands.length > 0
          ? parsed.bands.map((b: any) => ({
              frequency: clampNumber(Number(b.frequency), 10, 22000, 1000),
              gain: clampNumber(Number(b.gain), -24, 24, 0),
              q: clampNumber(Number(b.q), 0.1, 20, 1.41),
              type: (['peaking', 'lowshelf', 'highshelf'].includes(b.type)
                ? b.type
                : 'peaking') as BiquadFilterType
            }))
          : createDefaultEqBands();
        return {
          eqEnabled: typeof parsed.eqEnabled === 'boolean' ? parsed.eqEnabled : true,
          preampDb: clampNumber(Number(parsed.preampDb), -24, 24, 0),
          bands,
          mono: Boolean(parsed.mono),
          preservesPitch: parsed.preservesPitch !== false,
          outputDeviceId:
            typeof parsed.outputDeviceId === 'string' && parsed.outputDeviceId
              ? parsed.outputDeviceId
              : safeReadStorage('audioOutputDeviceId') || 'default'
        };
      } catch {
        // fall through to legacy migration
      }
    }

    // Hydrate from legacy keys if present
    let eqEnabled = true;
    try {
      const legacyBypass = safeReadStorage('eqBypass');
      if (legacyBypass !== null) {
        eqEnabled = JSON.parse(legacyBypass) !== true;
      }
    } catch {
      eqEnabled = true;
    }

    const bands = createDefaultEqBands();
    try {
      const legacyEq = JSON.parse(safeReadStorage('eqSettings') || '{}');
      for (const band of bands) {
        const val = legacyEq?.[String(band.frequency)];
        if (val !== undefined) {
          band.gain = clampNumber(Number(val), -24, 24, 0);
        }
      }
    } catch {
      // ignore invalid legacy eqSettings
    }

    return {
      eqEnabled,
      preampDb: 0,
      bands,
      mono: false,
      preservesPitch: true,
      outputDeviceId: safeReadStorage('audioOutputDeviceId') || 'default'
    };
  }

  private persistState(): void {
    safeWriteStorage(DSP_STORAGE_KEY, JSON.stringify(this.state));
    safeWriteStorage('eqBypass', JSON.stringify(!this.state.eqEnabled));
    safeWriteStorage('audioOutputDeviceId', this.state.outputDeviceId);

    const legacyMap: Record<string, number> = {};
    for (const freq of DEFAULT_EQ_FREQUENCIES) {
      const exact = this.state.bands.find((b) => Math.round(b.frequency) === freq);
      legacyMap[String(freq)] = exact ? exact.gain : 0;
    }
    safeWriteStorage('eqSettings', JSON.stringify(legacyMap));
  }

  public attach(audio: HTMLAudioElement, isElectronContext: boolean): AudioContext | null {
    this.audioEl = audio;
    this.applyPreservesPitchToElement();

    if (!isElectronContext || typeof AudioContext === 'undefined') {
      return null;
    }

    if (this.context && this.sourceNode && elementSourceCache.get(audio) === this.sourceNode) {
      return this.context;
    }

    try {
      const existingContext = elementContextCache.get(audio);
      const existingSource = elementSourceCache.get(audio);

      if (existingContext && existingSource) {
        this.context = existingContext;
        this.sourceNode = existingSource;
      } else {
        this.context = new AudioContext();
        this.sourceNode = this.context.createMediaElementSource(audio);
        elementContextCache.set(audio, this.context);
        elementSourceCache.set(audio, this.sourceNode);
      }

      this.preampNode = this.context.createGain();
      this.channelModeNode = this.context.createGain();
      this.masterGainNode = this.context.createGain();
      this.analyserNode = this.context.createAnalyser();
      this.analyserNode.fftSize = 128;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.rebuildFiltersAndWireGraph();
      this.applyChannelMode();
      this.applyPreamp();
      this.applyMasterVolume(this.masterVolume);
      return this.context;
    } catch (error) {
      console.error('[AudioDspGraph] Initialization failed:', error);
      return null;
    }
  }

  private rebuildFiltersAndWireGraph(): void {
    if (!this.context || !this.sourceNode || !this.preampNode || !this.channelModeNode || !this.masterGainNode) {
      return;
    }

    try {
      this.sourceNode.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.preampNode.disconnect();
    } catch {
      /* already disconnected */
    }
    for (const f of this.filterNodes) {
      try {
        f.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    try {
      this.channelModeNode.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.masterGainNode.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.analyserNode?.disconnect();
    } catch {
      /* already disconnected */
    }

    this.filterNodes = this.state.bands.map((band) => {
      const filter = this.context!.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q;
      filter.gain.value = band.gain;
      return filter;
    });

    this.sourceNode.connect(this.preampNode);

    if (this.state.eqEnabled && this.filterNodes.length > 0) {
      this.preampNode.connect(this.filterNodes[0]);
      for (let i = 0; i < this.filterNodes.length - 1; i += 1) {
        this.filterNodes[i].connect(this.filterNodes[i + 1]);
      }
      this.filterNodes[this.filterNodes.length - 1].connect(this.channelModeNode);
    } else {
      this.preampNode.connect(this.channelModeNode);
    }

    this.channelModeNode.connect(this.masterGainNode);

    if (this.analyserNode) {
      this.masterGainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.context.destination);
    } else {
      this.masterGainNode.connect(this.context.destination);
    }
  }

  private applyPreamp(): void {
    if (!this.preampNode || !this.context) return;
    const target = this.state.eqEnabled ? dbToLinear(this.state.preampDb) : 1;
    this.preampNode.gain.setValueAtTime(target, this.context.currentTime);
  }

  private applyChannelMode(): void {
    if (!this.channelModeNode) return;
    if (this.state.mono) {
      this.channelModeNode.channelCount = 1;
      this.channelModeNode.channelCountMode = 'explicit';
      this.channelModeNode.channelInterpretation = 'speakers';
    } else {
      this.channelModeNode.channelCount = 2;
      this.channelModeNode.channelCountMode = 'max';
      this.channelModeNode.channelInterpretation = 'speakers';
    }
  }

  private applyPreservesPitchToElement(): void {
    if (!this.audioEl) return;
    const enabled = this.state.preservesPitch;
    try {
      (this.audioEl as any).preservesPitch = enabled;
      (this.audioEl as any).webkitPreservesPitch = enabled;
      (this.audioEl as any).mozPreservesPitch = enabled;
    } catch {
      // ignore if read-only in mock environments
    }
  }

  public applyMasterVolume(linearVolume: number): void {
    this.masterVolume = clampNumber(linearVolume, 0, 1.5, 1);
    if (this.masterGainNode && this.context) {
      this.masterGainNode.gain.cancelScheduledValues(this.context.currentTime);
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.context.currentTime);
    }
  }

  public getState(): AudioDspState {
    return {
      ...this.state,
      bands: this.state.bands.map((b) => ({ ...b }))
    };
  }

  public getContext(): AudioContext | null {
    return this.context;
  }

  public getMasterGainNode(): GainNode | null {
    return this.masterGainNode;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public setEqEnabled(enabled: boolean): AudioDspState {
    this.state.eqEnabled = Boolean(enabled);
    this.rebuildFiltersAndWireGraph();
    this.applyPreamp();
    this.persistState();
    return this.getState();
  }

  public setPreampDb(db: number): AudioDspState {
    this.state.preampDb = clampNumber(db, -24, 24, 0);
    this.applyPreamp();
    this.persistState();
    return this.getState();
  }

  public setBandGain(frequency: number | string, gainDb: number): AudioDspState {
    const freqNum = Number(frequency);
    const clampedGain = clampNumber(gainDb, -24, 24, 0);
    const idx = this.state.bands.findIndex((b) => Math.round(b.frequency) === Math.round(freqNum));
    if (idx !== -1) {
      this.state.bands[idx].gain = clampedGain;
      const node = this.filterNodes[idx];
      if (node && this.context) {
        node.gain.setValueAtTime(clampedGain, this.context.currentTime);
      }
      this.persistState();
    }
    return this.getState();
  }

  public setBands(bands: EqBand[], preampDb?: number): AudioDspState {
    this.state.bands =
      bands.length > 0
        ? bands.map((b) => ({
            frequency: clampNumber(b.frequency, 10, 22000, 1000),
            gain: clampNumber(b.gain, -24, 24, 0),
            q: clampNumber(b.q, 0.1, 20, 1.41),
            type: b.type
          }))
        : createDefaultEqBands();
    if (typeof preampDb === 'number') {
      this.state.preampDb = clampNumber(preampDb, -24, 24, 0);
    }
    this.rebuildFiltersAndWireGraph();
    this.applyPreamp();
    this.persistState();
    return this.getState();
  }

  public resetToFlat(): AudioDspState {
    this.state.preampDb = 0;
    this.state.bands = createDefaultEqBands();
    this.rebuildFiltersAndWireGraph();
    this.applyPreamp();
    this.persistState();
    return this.getState();
  }

  public applyAutoEqText(text: string): {
    applied: boolean;
    preampDb: number;
    bandsCount: number;
    state: AudioDspState;
  } {
    const parsed = parseAutoEqProfile(text);
    if (parsed.bands.length === 0) {
      return {
        applied: false,
        preampDb: this.state.preampDb,
        bandsCount: this.state.bands.length,
        state: this.getState()
      };
    }
    this.state.eqEnabled = true;
    const nextState = this.setBands(parsed.bands, parsed.preampDb);
    return {
      applied: true,
      preampDb: parsed.preampDb,
      bandsCount: parsed.bands.length,
      state: nextState
    };
  }

  public setMono(enabled: boolean): AudioDspState {
    this.state.mono = Boolean(enabled);
    this.applyChannelMode();
    this.persistState();
    return this.getState();
  }

  public setPreservesPitch(enabled: boolean): AudioDspState {
    this.state.preservesPitch = Boolean(enabled);
    this.applyPreservesPitchToElement();
    this.persistState();
    return this.getState();
  }

  public async setOutputDevice(deviceId: string): Promise<boolean> {
    const target = deviceId || 'default';
    try {
      if (this.context && typeof (this.context as any).setSinkId === 'function') {
        await (this.context as any).setSinkId(target);
        this.state.outputDeviceId = target;
        this.persistState();
        return true;
      }
      if (this.audioEl && typeof (this.audioEl as any).setSinkId === 'function') {
        await (this.audioEl as any).setSinkId(target);
        this.state.outputDeviceId = target;
        this.persistState();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AudioDspGraph] Failed to set audio output device:', error);
      return false;
    }
  }

  public getLegacyEqMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const freq of DEFAULT_EQ_FREQUENCIES) {
      const match = this.state.bands.find((b) => Math.round(b.frequency) === freq);
      map[String(freq)] = match ? match.gain : 0;
    }
    return map;
  }

  public getSignalPathInfo(extra: {
    playbackRate: number;
    replayGainEnabled: boolean;
    gaplessEnabled: boolean;
    sourceKind: string;
    codecLabel: string;
  }): AudioSignalPathInfo {
    const isParametric =
      this.state.bands.length !== DEFAULT_EQ_FREQUENCIES.length ||
      this.state.bands.some((b) => b.type !== 'peaking');

    return {
      sampleRate: this.context?.sampleRate || 48000,
      contextState: this.context?.state || 'direct-element',
      outputDeviceId: this.state.outputDeviceId,
      eqEnabled: this.state.eqEnabled,
      preampDb: this.state.preampDb,
      activeBandsCount: this.state.bands.filter((b) => Math.abs(b.gain) >= 0.05).length,
      isParametric,
      mono: this.state.mono,
      preservesPitch: this.state.preservesPitch,
      playbackRate: extra.playbackRate,
      replayGainEnabled: extra.replayGainEnabled,
      gaplessEnabled: extra.gaplessEnabled,
      sourceKind: extra.sourceKind,
      codecLabel: extra.codecLabel
    };
  }
}

export const audioDspGraph = new AudioDspGraph();
