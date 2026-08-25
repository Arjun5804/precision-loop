import { Loop } from './Loop';
import { InvalidParameterError } from './errors';

export class Track {
  public readonly id: string;
  private volume: number = 1.0;
  private pan: number = 0.0;
  private muted: boolean = false;
  private soloed: boolean = false;
  private loop: Loop | null = null;

  /**
   * Internal constructor. Use Session.createTrack() to instantiate.
   */
  public constructor(id: string) {
    this.id = id;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number): void {
    if (volume < 0.0 || volume > 1.0) {
      throw new InvalidParameterError('Volume must be between 0.0 and 1.0');
    }
    this.volume = volume;
  }

  public getPan(): number {
    return this.pan;
  }

  public setPan(pan: number): void {
    if (pan < -1.0 || pan > 1.0) {
      throw new InvalidParameterError('Pan must be between -1.0 and 1.0');
    }
    this.pan = pan;
  }

  public getMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public getSoloed(): boolean {
    return this.soloed;
  }

  public setSoloed(soloed: boolean): void {
    this.soloed = soloed;
  }

  public getLoop(): Loop | null {
    return this.loop;
  }

  public setLoop(loop: Loop): void {
    this.loop = loop;
  }

  public removeLoop(): void {
    this.loop = null;
  }
}
