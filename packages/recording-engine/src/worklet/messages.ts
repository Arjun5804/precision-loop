export type WorkletMessage =
  | { type: 'ARM'; startFrame: number; endFrame: number }
  | { type: 'CANCEL' };

export type MainMessage =
  | { type: 'CHUNK'; buffer: ArrayBuffer }
  | { type: 'COMPLETED' }
  | { type: 'ERROR'; message: string };
