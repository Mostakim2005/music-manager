/**
 */

import type { SongResult } from '@/types/music';

class PlaybackRequestManager {
  private currentRequestId: string | null = null;
  private counter = 0;

  /**
   */
  createRequest(song: SongResult): string {
    const requestId = `req_${Date.now()}_${++this.counter}`;
    this.currentRequestId = requestId;
    console.log(`[RequestManager] New request: ${requestId}, song: ${song.name}`);
    return requestId;
  }

  getGeneration(): number {
    return this.counter;
  }

  cancelCurrentRequest(): void {
    this.counter++;
    this.currentRequestId = null;
  }

  /**
   */
  isRequestValid(requestId: string): boolean {
    return this.currentRequestId === requestId;
  }

  /**
   */
  activateRequest(requestId: string): boolean {
    return this.isRequestValid(requestId);
  }

  /**
   */
  completeRequest(requestId: string): void {
    console.log(`[RequestManager] Done: ${requestId}`);
  }

  /**
   */
  failRequest(requestId: string): void {
    console.log(`[RequestManager] ${requestId}`);
  }

  /**
   */
  getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }
}

export const playbackRequestManager = new PlaybackRequestManager();
