import { describe, it, expect, beforeEach } from 'vitest';
import { TrackMixer } from '../src/track-mixer';
import { FakeGainNodeWrapper, FakePannerNodeWrapper, FakeResourceAdapter } from '../src/fake-resource-adapter';
import { TrackPlaybackConfig } from '../src/playback-plan';
import { Take } from '@precision-loop/loop-model';

describe('TrackMixer', () => {
  let adapter: FakeResourceAdapter;
  let mixer: TrackMixer;
  let dummyTake: Take;

  beforeEach(() => {
    adapter = new FakeResourceAdapter();
    mixer = new TrackMixer(adapter);
    dummyTake = new Take({
      id: 'take-1',
      sessionId: 'sess-1',
      sampleRate: 48000,
      channelCount: 1,
      frameCount: 48000,
      channels: [new Float32Array(48000)]
    });
  });

  const createConfig = (trackId: string, volume: number, pan: number, muted: boolean, soloed: boolean): TrackPlaybackConfig => ({
    trackId,
    take: dummyTake,
    iterationDuration: 1.0,
    volume,
    pan,
    muted,
    soloed
  });

  it('configures graph correctly and connects to master', () => {
    const track = createConfig('t1', 0.8, -0.5, false, false);
    mixer.configureTracks([track]);

    const dest = mixer.getTrackDestination('t1') as FakePannerNodeWrapper;
    expect(dest.panValue).toBe(-0.5);
    expect(dest.connectedTo).toBeInstanceOf(FakeGainNodeWrapper);

    const gain = dest.connectedTo as FakeGainNodeWrapper;
    expect(gain.gainValue).toBe(0.8);
    expect(gain.connectedTo).toBe('master');
  });

  it('respects mute state', () => {
    const track = createConfig('t1', 0.8, 0, true, false);
    mixer.configureTracks([track]);

    const dest = mixer.getTrackDestination('t1') as FakePannerNodeWrapper;
    const gain = dest.connectedTo as FakeGainNodeWrapper;
    expect(gain.gainValue).toBe(0.0); // Muted overrides volume
  });

  it('solo overrides mute and mutes other tracks', () => {
    const t1 = createConfig('t1', 0.8, 0, false, false);
    const t2 = createConfig('t2', 0.9, 0, false, true); // t2 is soloed
    
    mixer.configureTracks([t1, t2]);

    const gain1 = (mixer.getTrackDestination('t1') as FakePannerNodeWrapper).connectedTo as FakeGainNodeWrapper;
    const gain2 = (mixer.getTrackDestination('t2') as FakePannerNodeWrapper).connectedTo as FakeGainNodeWrapper;
    
    expect(gain1.gainValue).toBe(0.0); // Muted by solo
    expect(gain2.gainValue).toBe(0.9); // Keeps volume
  });
});
