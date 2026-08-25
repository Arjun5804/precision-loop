import { AudioEngineCapabilities } from './types';

export function detectCapabilities(
  audioContextClass: typeof AudioContext = globalThis.AudioContext
): AudioEngineCapabilities {
  return {
    supportsOutputSelection:
      typeof audioContextClass !== 'undefined' &&
      'setSinkId' in audioContextClass.prototype,
  };
}
