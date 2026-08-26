import { describe, it, expect, beforeEach } from 'vitest';
import { Track } from '../src/Track';
import { InvalidParameterError } from '../src/errors';
import { Session } from '../src/Session';

describe('Track', () => {
  let track: Track;
  let session: Session;
  let sessionB: Session;

  beforeEach(() => {
    session = new Session('session_1', 120, { numerator: 4, denominator: 4 });
    sessionB = new Session('session_2', 120, { numerator: 4, denominator: 4 });
    track = session.createTrack();
  });

  it('validates volume range', () => {
    expect(track.getVolume()).toBe(1.0);
    track.setVolume(0.5);
    expect(track.getVolume()).toBe(0.5);
    expect(() => track.setVolume(-0.1)).toThrow(InvalidParameterError);
    expect(() => track.setVolume(1.1)).toThrow(InvalidParameterError);
  });

  it('validates pan range', () => {
    expect(track.getPan()).toBe(0.0);
    track.setPan(-1.0);
    expect(track.getPan()).toBe(-1.0);
    track.setPan(1.0);
    expect(track.getPan()).toBe(1.0);
    expect(() => track.setPan(-1.1)).toThrow(InvalidParameterError);
    expect(() => track.setPan(1.1)).toThrow(InvalidParameterError);
  });

  it('handles mute and solo', () => {
    expect(track.getMuted()).toBe(false);
    track.setMuted(true);
    expect(track.getMuted()).toBe(true);

    expect(track.getSoloed()).toBe(false);
    track.setSoloed(true);
    expect(track.getSoloed()).toBe(true);
  });

  it('holds at most one Loop in v0.1', () => {
    const take1 = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels: [new Float32Array(10)] });
    const take2 = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels: [new Float32Array(10)] });
    const loop1 = session.createLoop({ take: take1, musicalLength: { bars: 4 } });
    const loop2 = session.createLoop({ take: take2, musicalLength: { bars: 4 } });

    expect(track.getLoop()).toBeNull();
    track.setLoop(loop1);
    expect(track.getLoop()).toBe(loop1);
    
    // Replaces the existing loop
    track.setLoop(loop2);
    expect(track.getLoop()).toBe(loop2);

    track.removeLoop();
    expect(track.getLoop()).toBeNull();
  });

  it('rejects a Loop assigned from a different Session', () => {
    const takeB = sessionB.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels: [new Float32Array(10)] });
    const loopB = sessionB.createLoop({ take: takeB, musicalLength: { bars: 4 } });

    expect(() => track.setLoop(loopB)).toThrow(InvalidParameterError);
  });
});
