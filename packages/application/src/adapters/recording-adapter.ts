import { Session, Take } from '@precision-loop/loop-model';
import { RecordedTake } from '@precision-loop/recording-engine';

/**
 * Pure adapter function to convert infrastructure RecordedTake into domain Take.
 */
export function adaptRecordedTake(
    session: Session, 
    recordedTake: RecordedTake
): Take {
    return session.createTake({
        sampleRate: recordedTake.sampleRate,
        channelCount: recordedTake.channelCount,
        frameCount: recordedTake.frameCount,
        channels: recordedTake.channels,
        sourceStartTime: recordedTake.startTime,
        sourceEndTime: recordedTake.endTime
    });
}
