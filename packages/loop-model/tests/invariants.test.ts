import { describe, it, expect, beforeEach } from 'vitest';
import { Session } from '../src/Session';
import { InvalidParameterError } from '../src/errors';

describe('Take Invariants', () => {
  let session: Session;

  beforeEach(() => {
    session = new Session('session_1', 120, { numerator: 4, denominator: 4 });
  });

  it('rejects invalid sampleRate', () => {
    const channels = [new Float32Array(10)];
    expect(() => session.createTake({ sampleRate: 0, channelCount: 1, frameCount: 10, channels })).toThrow(InvalidParameterError);
    expect(() => session.createTake({ sampleRate: -48000, channelCount: 1, frameCount: 10, channels })).toThrow(InvalidParameterError);
  });

  it('rejects invalid channelCount', () => {
    const channels = [new Float32Array(10)];
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 0, frameCount: 10, channels })).toThrow(InvalidParameterError);
    expect(() => session.createTake({ sampleRate: 48000, channelCount: -1, frameCount: 10, channels })).toThrow(InvalidParameterError);
  });

  it('rejects invalid frameCount', () => {
    const channels = [new Float32Array(10)];
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 0, channels })).toThrow(InvalidParameterError);
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: -10, channels })).toThrow(InvalidParameterError);
  });

  it('rejects mismatched channels length and channelCount', () => {
    const channels = [new Float32Array(10), new Float32Array(10)]; // length 2
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels })).toThrow(InvalidParameterError);
  });

  it('rejects mismatched Float32Array length and frameCount', () => {
    const channels = [new Float32Array(9)];
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels })).toThrow(InvalidParameterError);
  });

  it('rejects invalid source timestamps', () => {
    const channels = [new Float32Array(10)];
    // start >= end
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels, sourceStartTime: 5.0, sourceEndTime: 5.0 })).toThrow(InvalidParameterError);
    expect(() => session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels, sourceStartTime: 6.0, sourceEndTime: 5.0 })).toThrow(InvalidParameterError);
  });

  it('accepts optional source timestamps', () => {
    const channels = [new Float32Array(10)];
    const take = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels, sourceStartTime: 2.0, sourceEndTime: 4.0 });
    expect(take.sourceStartTime).toBe(2.0);
    expect(take.sourceEndTime).toBe(4.0);

    const take2 = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels });
    expect(take2.sourceStartTime).toBeUndefined();
    expect(take2.sourceEndTime).toBeUndefined();
  });
});

describe('Loop Invariants', () => {
  let session: Session;

  beforeEach(() => {
    session = new Session('session_1', 120, { numerator: 4, denominator: 4 });
  });

  it('rejects invalid musical length', () => {
    const channels = [new Float32Array(10)];
    const take = session.createTake({ sampleRate: 48000, channelCount: 1, frameCount: 10, channels });
    
    expect(() => session.createLoop({ take, musicalLength: { bars: 0 } })).toThrow(InvalidParameterError);
    expect(() => session.createLoop({ take, musicalLength: { bars: -1 } })).toThrow(InvalidParameterError);
  });
});
