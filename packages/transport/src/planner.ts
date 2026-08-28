import { MusicalClock } from '@precision-loop/musical-clock';
import { InvalidConfigurationError } from './errors';
import type { TransportConfig, TransportPlan, ClickEvent } from './types';
import type { AudioTime } from '@precision-loop/recording-engine';

/**
 * Validates the transport configuration.
 * @throws InvalidConfigurationError if the configuration is invalid.
 */
export function validateConfig(config: TransportConfig): void {
  if (config.tempo <= 0 || !Number.isFinite(config.tempo)) {
    throw new InvalidConfigurationError('Tempo must be a positive finite number');
  }
  if (!config.timeSignature || config.timeSignature.numerator <= 0 || config.timeSignature.denominator <= 0) {
    throw new InvalidConfigurationError('Time signature must have positive numerator and denominator');
  }
  if (config.countInBars < 0 || !Number.isInteger(config.countInBars)) {
    throw new InvalidConfigurationError('countInBars must be a non-negative integer');
  }
  if (config.recordingBars !== undefined && (config.recordingBars <= 0 || !Number.isInteger(config.recordingBars))) {
    throw new InvalidConfigurationError('recordingBars must be a positive integer or undefined');
  }
}

/**
 * A pure function that calculates a deterministic session plan.
 */
export function planSession(
  config: TransportConfig,
  clock: MusicalClock,
  sessionStartTime: AudioTime
): TransportPlan {
  validateConfig(config);

  const countInDuration = clock.barsToSeconds(config.countInBars);
  const recordingStartTime = sessionStartTime + countInDuration;
  
  let recordingEndTime = Infinity;
  if (config.recordingBars !== undefined) {
    const recordingDuration = clock.barsToSeconds(config.recordingBars);
    recordingEndTime = recordingStartTime + recordingDuration;
  }

  const countInEvents: ClickEvent[] = [];

  for (let b = -config.countInBars; b < 0; b++) {
    for (let beat = 0; beat < config.timeSignature.numerator; beat++) {
      // Calculate offset using the canonical position conversion API.
      // We offset the bar index by countInBars to make it a positive value for MusicalClock.
      const timeOffset = clock.positionToSeconds({ 
        bar: b + config.countInBars, 
        beat, 
        subdivision: 0 
      });
      
      countInEvents.push({
        audioTime: sessionStartTime + timeOffset,
        barIndex: b,
        beatIndex: beat,
        accent: beat === 0,
      });
    }
  }

  return {
    sessionStartTime,
    recordingStartTime,
    recordingEndTime,
    recordingWindow: {
      startTime: recordingStartTime,
      endTime: recordingEndTime,
    },
    countInEvents,
  };
}
