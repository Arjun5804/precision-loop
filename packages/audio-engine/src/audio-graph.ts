export class AudioGraph {
  public readonly masterGain: GainNode;

  constructor(context: AudioContext) {
    this.masterGain = context.createGain();
    
    // Default root graph connection
    this.masterGain.connect(context.destination);
  }

  public close(): void {
    try {
      this.masterGain.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
  }
}
