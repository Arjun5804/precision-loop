import { Take } from './Take';
import { MusicalLength } from './types';
import { InvalidParameterError } from './errors';

export interface LoopParams {
  id: string;
  take: Take;
  musicalLength: MusicalLength;
}

export class Loop {
  public readonly id: string;
  public readonly take: Take;
  public readonly musicalLength: MusicalLength;

  /**
   * Internal constructor. Use Session.createLoop() to instantiate.
   */
  public constructor(params: LoopParams) {
    if (params.musicalLength.bars <= 0) {
      throw new InvalidParameterError('musicalLength.bars must be > 0');
    }
    this.id = params.id;
    this.take = params.take;
    this.musicalLength = params.musicalLength;
  }
}
