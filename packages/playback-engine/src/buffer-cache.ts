import { Take } from '@precision-loop/loop-model';
import { IAudioBufferWrapper, PlaybackResourceAdapter } from './resource-adapter';

export class BufferCache {
  private cache = new Map<string, IAudioBufferWrapper>();

  constructor(private adapter: PlaybackResourceAdapter) {}

  /**
   * Generates a globally unique cache key scoped to the session.
   */
  private getCacheKey(sessionId: string, takeId: string): string {
    return `${sessionId}:${takeId}`;
  }

  /**
   * Retrieves an existing buffer or creates a new one from the Take.
   */
  public getOrCreate(take: Take): IAudioBufferWrapper {
    const key = this.getCacheKey(take.sessionId, take.id);
    const existing = this.cache.get(key);
    if (existing) {
      return existing;
    }
    
    const buffer = this.adapter.createBufferFromTake(take);
    this.cache.set(key, buffer);
    return buffer;
  }

  /**
   * Explicitly evicts a buffer from the cache to free memory.
   */
  public evict(sessionId: string, takeId: string): void {
    const key = this.getCacheKey(sessionId, takeId);
    this.cache.delete(key);
  }

  public evictAll(): void {
    this.cache.clear();
  }
}
