import { Tempo, TimeSignature } from '@precision-loop/musical-clock';
import { Track } from './Track';
import { Take } from './Take';
import { Loop } from './Loop';
import { MusicalLength } from './types';
import { InvalidStateError } from './errors';

export class Session {
  public readonly id: string;
  private tempo: Tempo;
  private timeSignature: TimeSignature;
  private tracks: Track[] = [];

  private trackCounter: number = 0;
  private takeCounter: number = 0;
  private loopCounter: number = 0;

  public constructor(id: string, initialTempo: Tempo, initialTimeSignature: TimeSignature) {
    this.id = id;
    this.tempo = initialTempo;
    this.timeSignature = initialTimeSignature;
  }

  public getTempo(): Tempo {
    return this.tempo;
  }

  public setTempo(tempo: Tempo): void {
    if (this.hasAnyLoops()) {
      throw new InvalidStateError('Cannot change tempo while any track contains a loop');
    }
    this.tempo = tempo;
  }

  public getTimeSignature(): TimeSignature {
    return this.timeSignature;
  }

  public setTimeSignature(ts: TimeSignature): void {
    if (this.hasAnyLoops()) {
      throw new InvalidStateError('Cannot change time signature while any track contains a loop');
    }
    this.timeSignature = ts;
  }

  public getTracks(): readonly Track[] {
    return Object.freeze([...this.tracks]);
  }

  public removeTrack(trackId: string): void {
    this.tracks = this.tracks.filter(t => t.id !== trackId);
  }

  // --- Factory Methods ---

  public createTrack(): Track {
    const trackId = `track_${++this.trackCounter}`;
    const track = new Track(trackId, this.id);
    this.tracks.push(track);
    return track;
  }

  public createTake(params: {
    sampleRate: number;
    channelCount: number;
    frameCount: number;
    channels: Float32Array[];
    sourceStartTime?: number;
    sourceEndTime?: number;
  }): Take {
    const takeId = `take_${++this.takeCounter}`;
    return new Take({
      id: takeId,
      sessionId: this.id,
      ...params,
    });
  }

  public createLoop(params: {
    take: Take;
    musicalLength: MusicalLength;
  }): Loop {
    const loopId = `loop_${++this.loopCounter}`;
    return new Loop({
      id: loopId,
      sessionId: this.id,
      ...params,
    });
  }

  // --- Helpers ---

  private hasAnyLoops(): boolean {
    return this.tracks.some(track => track.getLoop() !== null);
  }
}
