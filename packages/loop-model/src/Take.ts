import { InvalidParameterError } from './errors';

export interface TakeParams {
  id: string;
  sessionId: string;
  sampleRate: number;
  channelCount: number;
  frameCount: number;
  channels: Float32Array[];
  sourceStartTime?: number;
  sourceEndTime?: number;
}

export class Take {
  public readonly id: string;
  public readonly sessionId: string;
  public readonly sampleRate: number;
  public readonly channelCount: number;
  public readonly frameCount: number;
  public readonly channels: readonly Float32Array[];
  public readonly sourceStartTime?: number;
  public readonly sourceEndTime?: number;

  /**
   * Internal constructor. Use Session.createTake() to instantiate.
   * Direct instantiation is unsupported and bypasses session ID allocation invariants.
   */
  public constructor(params: TakeParams) {
    if (params.sampleRate <= 0) {
      throw new InvalidParameterError('sampleRate must be > 0');
    }
    if (params.channelCount <= 0) {
      throw new InvalidParameterError('channelCount must be > 0');
    }
    if (params.frameCount <= 0) {
      throw new InvalidParameterError('frameCount must be > 0');
    }
    if (params.channels.length !== params.channelCount) {
      throw new InvalidParameterError('Number of channels must match channelCount');
    }
    for (const channel of params.channels) {
      if (channel.length !== params.frameCount) {
        throw new InvalidParameterError('Channel length must match frameCount');
      }
    }
    if (
      params.sourceStartTime !== undefined &&
      params.sourceEndTime !== undefined &&
      params.sourceStartTime >= params.sourceEndTime
    ) {
      throw new InvalidParameterError('sourceStartTime must be < sourceEndTime');
    }

    this.id = params.id;
    this.sessionId = params.sessionId;
    this.sampleRate = params.sampleRate;
    this.channelCount = params.channelCount;
    this.frameCount = params.frameCount;
    this.channels = params.channels; // Implicit ownership transfer, immutable-by-contract
    this.sourceStartTime = params.sourceStartTime;
    this.sourceEndTime = params.sourceEndTime;
  }
}
