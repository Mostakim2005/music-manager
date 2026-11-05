import { Howl, Howler } from 'howler';
import Tuna from 'tunajs';

interface HowlSound {
  _sounds: Array<{
    _node: HTMLMediaElement & {
      destination?: MediaElementAudioSourceNode;
    };
  }>;
}

export interface EQSettings {
  [key: string]: number;
}

export class EQService {
  private context: AudioContext | null = null;

  private tuna: any = null;

  private equalizer: any = null;

  private source: MediaElementAudioSourceNode | null = null;

  private gainNode: GainNode | null = null;

  private bypass = false;

  private readonly frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  private defaultEQSettings: EQSettings = Object.fromEntries(
    this.frequencies.map((f) => [f.toString(), 0])
  );

  constructor() {
    this.loadSavedSettings();
    this.bypass = localStorage.getItem('eqBypass') === 'true';
    this.initializeUserGestureHandler();
  }

  private initializeUserGestureHandler() {
    const handler = async () => {
      if (this.context?.state === 'suspended') {
        await this.context.resume();
      }
      document.removeEventListener('click', handler);
    };
    document.addEventListener('click', handler);
  }

  public async setupAudioContext(howl: Howl) {
    try {
      this.context = (Howler.ctx as AudioContext) || new AudioContext();

      if (!Howler.ctx) {
        Howler.ctx = this.context;
        Howler.masterGain = this.context.createGain();
        Howler.masterGain.connect(this.context.destination);
      }

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      const sound = (howl as unknown as HowlSound)._sounds[0];
      if (!sound?._node) throw new Error('Unable to access the audio node');

      await this.dispose();

      this.tuna = new Tuna(this.context);

      if (!sound._node.destination) {
        this.source = this.context.createMediaElementSource(sound._node);
        sound._node.destination = this.source;
      } else {
        this.source = sound._node.destination;
      }

      this.gainNode = this.context.createGain();
      this.equalizer = new this.tuna.Equalizer({
        frequencies: this.frequencies,
        gains: this.frequencies.map((f) => this.getSavedGain(f.toString())),
        bypass: this.bypass
      });

      this.source!.connect(this.equalizer.input).connect(this.gainNode).connect(Howler.masterGain);

      const volume = localStorage.getItem('volume');
      this.gainNode.gain.value = volume ? parseFloat(volume) : 1;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      await this.dispose();
      throw error;
    }
  }

  public setEnabled(enabled: boolean) {
    this.bypass = !enabled;
    localStorage.setItem('eqBypass', JSON.stringify(this.bypass));
    if (this.equalizer) this.equalizer.bypass = this.bypass;
  }

  public isEnabled(): boolean {
    return !this.bypass;
  }

  public setFrequencyGain(frequency: string, gain: number) {
    const index = this.frequencies.findIndex((f) => f.toString() === frequency);
    if (index !== -1 && this.equalizer) {
      this.equalizer.setGain(index, gain);
      this.saveSettings(frequency, gain);
    }
  }

  public resetEQ() {
    this.frequencies.forEach((f) => {
      this.setFrequencyGain(f.toString(), 0);
    });
    localStorage.removeItem('eqSettings');
  }

  public getAllSettings(): EQSettings {
    return this.loadSavedSettings();
  }

  private saveSettings(frequency: string, gain: number) {
    const settings = this.loadSavedSettings();
    settings[frequency] = gain;
    localStorage.setItem('eqSettings', JSON.stringify(settings));
  }

  private loadSavedSettings(): EQSettings {
    const saved = localStorage.getItem('eqSettings');
    return saved ? JSON.parse(saved) : { ...this.defaultEQSettings };
  }

  private getSavedGain(frequency: string): number {
    return this.loadSavedSettings()[frequency] || 0;
  }

  public async dispose() {
    try {
      [this.source, this.equalizer, this.gainNode].forEach((node) => {
        if (node) {
          node.disconnect();
          if (node === this.equalizer && typeof (node as any).destroy === 'function') {
            (node as any).destroy();
          }
        }
      });

      if (this.context && this.context !== Howler.ctx) {
        await this.context.close();
      }

      this.context = null;
      this.tuna = null;
      this.source = null;
      this.equalizer = null;
      this.gainNode = null;
    } catch (error) {
      console.error('Failed to clean up resources:', error);
    }
  }
}

export const eqService = new EQService();
