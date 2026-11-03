import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockMediaElement extends EventTarget {
  paused = true;
  currentTime = 0;
  src = '';

  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  });

  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
}

describe('Media Coordinator (Single Playback Guarantee A4)', () => {
  let coordinatorModule: typeof import('@/services/mediaCoordinator');
  let audioServiceMock: { pause: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    audioServiceMock = {
      pause: vi.fn()
    };
    vi.mock('@/services/audioService', () => ({
      audioService: audioServiceMock
    }));

    coordinatorModule = await import('@/services/mediaCoordinator');
    coordinatorModule.setAudioServiceInstance(audioServiceMock);
    coordinatorModule.mediaCoordinator.reset();
  });

  afterEach(() => {
    coordinatorModule.mediaCoordinator.reset();
    vi.unstubAllGlobals();
  });

  it('pauses other registered media elements when an element plays', async () => {
    const el1 = new MockMediaElement() as unknown as HTMLMediaElement;
    const el2 = new MockMediaElement() as unknown as HTMLMediaElement;

    const unreg1 = coordinatorModule.mediaCoordinator.registerMediaElement(el1, 'player-1');
    const unreg2 = coordinatorModule.mediaCoordinator.registerMediaElement(el2, 'player-2');

    // Simulate el1 starts playing
    await el1.play();

    expect(coordinatorModule.currentMediaOwner.value).toBe('player-1');
    expect(coordinatorModule.activeMediaElement.value).toBe(el1);
    expect(audioServiceMock.pause).toHaveBeenCalledTimes(1);

    // Now el2 starts playing
    await el2.play();

    expect(coordinatorModule.currentMediaOwner.value).toBe('player-2');
    expect(coordinatorModule.activeMediaElement.value).toBe(el2);
    expect(el1.pause).toHaveBeenCalled();

    unreg1();
    unreg2();
  });

  it('pauses registered elements when audioService claims playback', async () => {
    const videoEl = new MockMediaElement() as unknown as HTMLMediaElement;
    const unreg = coordinatorModule.mediaCoordinator.registerMediaElement(videoEl, 'mv-video');

    await videoEl.play();
    expect(coordinatorModule.currentMediaOwner.value).toBe('mv-video');

    // audioService claims playback
    coordinatorModule.mediaCoordinator.claimPlayback('audioService');

    expect(coordinatorModule.currentMediaOwner.value).toBe('audioService');
    expect(videoEl.pause).toHaveBeenCalled();

    unreg();
  });

  it('supports custom pause callbacks on registered elements', () => {
    const el = new MockMediaElement() as unknown as HTMLMediaElement;
    const customPause = vi.fn();

    const unreg = coordinatorModule.mediaCoordinator.registerMediaElement(
      el,
      'custom-player',
      customPause
    );

    coordinatorModule.mediaCoordinator.claimPlayback('other-player');
    expect(customPause).toHaveBeenCalledTimes(1);

    unreg();
  });

  it('unregisters cleanly and ignores unmounted elements', async () => {
    const el = new MockMediaElement() as unknown as HTMLMediaElement;
    const unreg = coordinatorModule.mediaCoordinator.registerMediaElement(el, 'temp-player');

    unreg();

    coordinatorModule.mediaCoordinator.claimPlayback('other-player');
    expect(el.pause).not.toHaveBeenCalled();
  });

  it('handles pauseAllLocal cleanly without error', () => {
    const el = new MockMediaElement() as unknown as HTMLMediaElement;
    coordinatorModule.mediaCoordinator.registerMediaElement(el, 'el-1');

    coordinatorModule.mediaCoordinator.pauseAllLocal('el-1');
    expect(el.pause).not.toHaveBeenCalled();

    coordinatorModule.mediaCoordinator.pauseAllLocal();
    expect(el.pause).toHaveBeenCalled();
  });
});
