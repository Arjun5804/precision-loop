import { TrackPlaybackConfig } from './playback-plan';
import { IGainNodeWrapper, IPannerNodeWrapper, ISourceNodeWrapper, PlaybackResourceAdapter } from './resource-adapter';

export class TrackNodeState {
  constructor(
    public readonly gainNode: IGainNodeWrapper,
    public readonly pannerNode: IPannerNodeWrapper
  ) {}
}

export class TrackMixer {
  private trackNodes = new Map<string, TrackNodeState>();

  constructor(private adapter: PlaybackResourceAdapter) {}

  /**
   * Configures the graph for a set of tracks.
   */
  public configureTracks(tracks: TrackPlaybackConfig[]): void {
    const anySoloed = tracks.some(t => t.soloed);

    for (const track of tracks) {
      let state = this.trackNodes.get(track.trackId);
      
      // Initialize track subgraph if it doesn't exist
      if (!state) {
        const gainNode = this.adapter.createGainNode();
        const pannerNode = this.adapter.createStereoPannerNode();
        
        pannerNode.connect(gainNode);
        this.adapter.connectToMaster(gainNode);
        
        state = new TrackNodeState(gainNode, pannerNode);
        this.trackNodes.set(track.trackId, state);
      }

      // Update parameters
      state.pannerNode.setPan(track.pan);
      
      const effectiveGain = this.calculateEffectiveGain(track, anySoloed);
      state.gainNode.setGain(effectiveGain);
    }
  }

  /**
   * Returns the entry point (PannerNode) for a given track, so source nodes can connect to it.
   */
  public getTrackDestination(trackId: string): IPannerNodeWrapper {
    const state = this.trackNodes.get(trackId);
    if (!state) {
      throw new Error(`Track ${trackId} is not configured in TrackMixer`);
    }
    return state.pannerNode;
  }

  public cleanup(): void {
    this.trackNodes.forEach(state => {
      this.adapter.disconnectFromMaster(state.gainNode);
      state.pannerNode.disconnect();
      state.gainNode.disconnect();
    });
    this.trackNodes.clear();
  }

  private calculateEffectiveGain(track: TrackPlaybackConfig, anySoloed: boolean): number {
    if (anySoloed) {
      return track.soloed ? track.volume : 0.0;
    }
    return track.muted ? 0.0 : track.volume;
  }
}
