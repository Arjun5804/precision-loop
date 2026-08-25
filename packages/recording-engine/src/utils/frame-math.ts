import { AudioTime } from '../types';

export function timeToFrame(time: AudioTime, sampleRate: number): number {
    return Math.round(time * sampleRate);
}
