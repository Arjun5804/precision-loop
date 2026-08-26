import { describe, it, expect } from 'vitest';
import { buildPlaybackPlan } from '../src/adapters/playback-plan-builder';
import { Session } from '@precision-loop/loop-model';
import { MusicalClock } from '@precision-loop/musical-clock';

describe('playback-plan-builder', () => {
    it('should correctly build a PlaybackPlan from a Session', () => {
        const session = new Session('session-1', 120, { numerator: 4, denominator: 4 });
        const track = session.createTrack();
        
        const take = session.createTake({
            sampleRate: 48000,
            channelCount: 1,
            frameCount: 48000,
            channels: [new Float32Array(48000)]
        });
        
        const loop = session.createLoop({
            take,
            musicalLength: { bars: 2 } // 2 bars at 120 BPM 4/4 is exactly 4 seconds
        });
        
        track.setLoop(loop);
        track.setVolume(0.8);
        track.setPan(0.5);

        const clock = new MusicalClock(session.getTempo(), session.getTimeSignature(), { subdivisionsPerBeat: 4 });
        
        const plan = buildPlaybackPlan(session, clock, 'playback-session-1', 10.0);

        expect(plan.sessionId).toBe('session-1');
        expect(plan.playbackSessionId).toBe('playback-session-1');
        expect(plan.originTime).toBe(10.0);
        
        expect(plan.tracks).toHaveLength(1);
        expect(plan.tracks[0]).toEqual({
            trackId: track.id,
            take: take,
            iterationDuration: 4.0, // 2 bars = 8 beats = 4 seconds at 120 BPM
            volume: 0.8,
            pan: 0.5,
            muted: false,
            soloed: false
        });
    });
    
    it('should ignore tracks without loops', () => {
        const session = new Session('session-1', 120, { numerator: 4, denominator: 4 });
        session.createTrack(); // No loop
        const clock = new MusicalClock(session.getTempo(), session.getTimeSignature(), { subdivisionsPerBeat: 4 });
        
        const plan = buildPlaybackPlan(session, clock, 'p1', 0);
        expect(plan.tracks).toHaveLength(0);
    });
});
