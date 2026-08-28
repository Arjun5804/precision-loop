export type WorkletMessage =
  | { type: 'ARM'; startFrame: number; endFrame: number }
  | { type: 'FINALIZE'; endFrame: number }
  | { type: 'CANCEL' };

export type MainMessage =
  | { type: 'CHUNK'; buffer: ArrayBuffer; frameCount: number }
  | { type: 'COMPLETED' }
  | { type: 'ERROR'; code: string; message: string };
