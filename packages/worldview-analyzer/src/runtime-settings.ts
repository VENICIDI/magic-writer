import { config } from "./config";

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 32;

class RuntimeSettings {
  private _maxConcurrentChunks = config.maxConcurrentChunks;

  get maxConcurrentChunks(): number {
    return this._maxConcurrentChunks;
  }

  setMaxConcurrentChunks(value: number): number {
    const n = Math.round(value);
    this._maxConcurrentChunks = Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, n));
    return this._maxConcurrentChunks;
  }

  toJSON(): { maxConcurrentChunks: number; chunkTargetChars: number; limits: { min: number; max: number } } {
    return {
      maxConcurrentChunks: this._maxConcurrentChunks,
      chunkTargetChars: config.chunkTargetChars,
      limits: { min: MIN_CONCURRENCY, max: MAX_CONCURRENCY },
    };
  }
}

export const runtimeSettings = new RuntimeSettings();
