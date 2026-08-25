import { describe, it, expect, beforeEach } from 'vitest';
import { Session } from '../src/Session';
import { InvalidStateError } from '../src/errors';
import { Tempo, TimeSignature } from '@precision-loop/musical-clock';

describe('Session', () => {
  let session: Session;
  const initialTempo: Tempo = 120;
  const initialTimeSignature: TimeSignature = { numerator: 4, denominator: 4 };

  beforeEach(() => {
    session = new Session('session_1', initialTempo, initialTimeSignature);
  });

  it('creates tracks with unique IDs', () => {
    const track1 = session.createTrack();
    const track2 = session.createTrack();
    expect(track1.id).toBe('track_1');
    expect(track2.id).toBe('track_2');
    expect(session.getTracks()).toHaveLength(2);
  });

  it('creates takes with unique IDs', () => {
    const channels = [new Float32Array(10)];
    const take1 = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels });
    const take2 = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels });
    expect(take1.id).toBe('take_1');
    expect(take2.id).toBe('take_2');
  });

  it('creates loops with unique IDs', () => {
    const channels = [new Float32Array(10)];
    const take = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels });
    const loop1 = session.createLoop({ take, musicalLength: { bars: 4 } });
    const loop2 = session.createLoop({ take, musicalLength: { bars: 2 } });
    expect(loop1.id).toBe('loop_1');
    expect(loop2.id).toBe('loop_2');
  });

  it('allows tempo and time signature changes when no loops exist', () => {
    const newTempo = 90;
    const newTs = { numerator: 3, denominator: 4 };
    session.setTempo(newTempo);
    session.setTimeSignature(newTs);
    expect(session.getTempo()).toEqual(newTempo);
    expect(session.getTimeSignature()).toEqual(newTs);
  });

  it('rejects tempo and time signature changes when a loop exists', () => {
    const track = session.createTrack();
    const take = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels: [new Float32Array(10)] });
    const loop = session.createLoop({ take, musicalLength: { bars: 4 } });
    track.setLoop(loop);

    expect(() => session.setTempo(100)).toThrow(InvalidStateError);
    expect(() => session.setTimeSignature({ numerator: 3, denominator: 4 })).toThrow(InvalidStateError);
  });

  it('removes tracks correctly', () => {
    const track1 = session.createTrack();
    const track2 = session.createTrack();
    expect(session.getTracks()).toHaveLength(2);
    session.removeTrack(track1.id);
    expect(session.getTracks()).toHaveLength(1);
    expect(session.getTracks()[0].id).toBe(track2.id);
  });

  it('getTracks() returns a snapshot that cannot mutate internal collection', () => {
    session.createTrack();
    const tracks = session.getTracks();
    expect(tracks).toHaveLength(1);
    
    // Typecast to any to bypass readonly and test runtime behavior
    expect(() => {
      (tracks as any).push({ id: 'fake_track' });
    }).toThrow();
  });
});
