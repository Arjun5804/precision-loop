import { describe, it, expect } from 'vitest';
import { adaptRecordedTake } from '../src/adapters/recording-adapter';
import { Session, Take } from '@precision-loop/loop-model';
import { RecordedTake } from '@precision-loop/recording-engine';

describe('recording-adapter', () => {
    it('should correctly convert a RecordedTake into a Take', () => {
        const session = new Session('session-1', 120, { numerator: 4, denominator: 4 });
        const recordedTake: RecordedTake = {
            id: 'take-123',
            sampleRate: 48000,
            channelCount: 1,
            frameCount: 48000,
            channels: [new Float32Array(48000)],
            startTime: 10,
            endTime: 11
        };

        const domainTake = adaptRecordedTake(session, recordedTake);

        expect(domainTake).toBeInstanceOf(Take);
        expect(domainTake.sessionId).toBe(session.id);
        expect(domainTake.sampleRate).toBe(48000);
        expect(domainTake.channelCount).toBe(1);
        expect(domainTake.frameCount).toBe(48000);
        expect(domainTake.sourceStartTime).toBe(10);
        expect(domainTake.sourceEndTime).toBe(11);
        expect(domainTake.channels).toBe(recordedTake.channels);
    });
});
