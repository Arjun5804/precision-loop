import { Session } from '@precision-loop/loop-model';
import { AudioEngine, AudioEngineState } from '@precision-loop/audio-engine';
import { AudioScheduler, AudioTimeSource } from '@precision-loop/audio-scheduler';
import { RecordingEngine, RecordingState } from '@precision-loop/recording-engine';
import { PlaybackEngine, WebResourceAdapter } from '@precision-loop/playback-engine';
import { Transport } from '@precision-loop/transport';
import { MusicalClock, Tempo, TimeSignature } from '@precision-loop/musical-clock';

import { AppState, ApplicationConfig, TrackRecordingSettings, DEFAULT_TRACK_SETTINGS } from './types';
import { EngineLoop } from './EngineLoop';
import { ApplicationEventRouter } from './ApplicationEventRouter';
import { adaptRecordedTake } from './adapters/recording-adapter';
import { buildPlaybackPlan } from './adapters/playback-plan-builder';
import { ApplicationStateError, ApplicationDependencyError } from './errors';

export class ApplicationController {
    public readonly session: Session;
    private _state: AppState = 'IDLE';
    private stateListeners: Set<(state: AppState) => void> = new Set();
    private generation = 0;
    private audioEngine: AudioEngine;
    private audioScheduler: AudioScheduler;
    private recordingEngine: RecordingEngine;
    private playbackEngine: PlaybackEngine;
    private timeSource: AudioTimeSource;
    private eventRouter: ApplicationEventRouter;
    private playbackSessionCounter = 0;
    private activeTransport: Transport | null = null;
    private activeRecordingTrackId: string | null = null;
    private trackSettings: Map<string, TrackRecordingSettings> = new Map();

    constructor(private config: ApplicationConfig, private engineLoop: EngineLoop) {
        this.session = new Session('session_1', 120, { numerator: 4, denominator: 4 });
        this.audioEngine = new AudioEngine();
        this.eventRouter = new ApplicationEventRouter();
        this.audioScheduler = null as any;
        this.recordingEngine = null as any;
        this.playbackEngine = null as any;
        this.timeSource = null as any;
    }

    public async initialize(): Promise<void> {
        await this.audioEngine.initialize();
        await this.audioEngine.initializeWorklets(this.config.foundationWorkletUrl);
        this.timeSource = this.audioEngine.createAudioTimeSource();
        const context = this.audioEngine.context;
        this.eventRouter.setAudioContext(context);
        this.audioScheduler = new AudioScheduler(this.timeSource, this.eventRouter);
        this.recordingEngine = new RecordingEngine(context);
        this.recordingEngine.onStateChange((state: RecordingState) => {
            if (!this.activeRecordingTrackId) return;
            if (state === 'RECORDING') this.setState('RECORDING');
        });

        const resourceAdapter = new WebResourceAdapter(context, this.audioEngine);
        this.playbackEngine = new PlaybackEngine(resourceAdapter, this.audioScheduler, this.timeSource);
        this.eventRouter.playbackEngine = this.playbackEngine;
        this.audioScheduler.start();
        this.engineLoop.start(() => {
            this.audioScheduler.tick();
            this.playbackEngine.replenish();
        });
    }

    // ─── State ────────────────────────────────────────────────────

    public getState(): AppState { return this._state; }
    public onStateChange(listener: (state: AppState) => void): () => void {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }
    private setState(state: AppState): void {
        this._state = state;
        for (const listener of this.stateListeners) listener(state);
    }
    public getAudioState(): AudioEngineState { return this.audioEngine.state; }
    public onAudioStateChange(listener: (state: AudioEngineState) => void): () => void { return this.audioEngine.onStateChange(listener); }
    public getActiveRecordingTrackId(): string | null { return this.activeRecordingTrackId; }
    public isTrackPlaying(trackId: string): boolean { return !!this.playbackEngine?.isTrackPlaying(trackId); }
    public hasActivePlayback(): boolean { return !!this.playbackEngine?.hasActivePlayback(); }
    public async resumeAudio(): Promise<void> { await this.audioEngine.resume(); }

    // ─── Per-Track Recording Settings ─────────────────────────────

    public getTrackSettings(trackId: string): TrackRecordingSettings {
        return this.trackSettings.get(trackId) ?? { ...DEFAULT_TRACK_SETTINGS };
    }

    public setTrackSettings(trackId: string, settings: Partial<TrackRecordingSettings>): void {
        const current = this.getTrackSettings(trackId);
        this.trackSettings.set(trackId, { ...current, ...settings });
        // Emit a state change so UI re-renders
        this.setState(this._state);
    }

    // ─── Session-Level Controls ───────────────────────────────────

    public setTempo(tempo: Tempo): void {
        this.session.setTempo(tempo); // Session validates no-loops-exist
        this.setState(this._state);   // re-render
    }

    public setTimeSignature(ts: TimeSignature): void {
        this.session.setTimeSignature(ts); // Session validates no-loops-exist
        this.setState(this._state);         // re-render
    }

    // ─── Dynamic Track Management ─────────────────────────────────

    public addTrack(): string {
        const track = this.session.createTrack();
        this.trackSettings.set(track.id, { ...DEFAULT_TRACK_SETTINGS });
        this.setState(this._state); // re-render
        return track.id;
    }

    public removeTrack(trackId: string): void {
        const tracks = this.session.getTracks();
        if (tracks.length <= 1) {
            throw new ApplicationStateError('Cannot remove the last track');
        }
        if (this.activeRecordingTrackId === trackId) {
            throw new ApplicationStateError('Cannot remove a track that is currently recording');
        }
        // Stop playback on the track if it's playing
        if (this.isTrackPlaying(trackId)) {
            this.playbackEngine.stopTrack(trackId);
        }
        this.session.removeTrack(trackId);
        this.trackSettings.delete(trackId);

        // Update global state
        if (!this.hasActivePlayback() && !this.activeTransport) {
            this.setState('IDLE');
        } else {
            this.setState(this._state);
        }
    }

    // ─── Recording ────────────────────────────────────────────────

    /** Record a new loop without interrupting already-playing tracks. */
    public async startRecording(trackId: string): Promise<void> {
        if (this._state !== 'IDLE' && this._state !== 'PLAYING') {
            throw new ApplicationStateError(`Cannot start recording from state: ${this._state}`);
        }
        const track = this.session.getTracks().find(t => t.id === trackId);
        if (!track) throw new ApplicationStateError(`Track ${trackId} not found`);
        if (track.getLoop()) throw new ApplicationStateError(`Track ${trackId} already contains a loop`);
        if (this.activeTransport) throw new ApplicationStateError('A recording is already active');

        const settings = this.getTrackSettings(trackId);
        const countInBars = settings.countInBars;
        const recordingBars = settings.mode === 'BAR' ? settings.recordingBars : undefined;

        this.activeRecordingTrackId = trackId;
        this.setState('PREPARING');
        const currentGen = ++this.generation;

        try {
            const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });
            this.activeTransport = new Transport(clock, this.audioScheduler, this.recordingEngine);
            this.activeTransport.configure({ tempo: this.session.getTempo(), timeSignature: this.session.getTimeSignature(), countInBars, recordingBars });

            const sessionStartTime = this.timeSource.currentTime() + this.config.sessionLeadTimeSeconds;
            console.log('DEBUG [AppController]: currentTime', this.timeSource.currentTime(), 'sessionStartTime', sessionStartTime, 'recordingEngine state', this.recordingEngine.state);
            await this.activeTransport.start(sessionStartTime, this.config.recordingWorkletUrl);
            console.log('DEBUG [AppController]: Transport start resolved, currentTime', this.timeSource.currentTime());
            if (this.generation !== currentGen) return;

            const recordedTake = this.activeTransport.getTake();
            if (!recordedTake) throw new Error('Transport completed but returned no take');
            const take = adaptRecordedTake(this.session, recordedTake);
            
            let actualBars = recordingBars ?? 4;
            if (recordingBars === undefined && take.sourceStartTime !== undefined && take.sourceEndTime !== undefined) {
                const takeDurationSeconds = take.sourceEndTime - take.sourceStartTime;
                actualBars = clock.secondsToBars(takeDurationSeconds);
            }
            const loop = this.session.createLoop({ take, musicalLength: { bars: recordingBars ?? Math.max(1, Math.round(actualBars)) } });
            track.setLoop(loop);

            // Recording has finished. Release recording ownership before starting
            // playback so the new loop follows the normal playback state machine.
            this.activeTransport = null;
            this.activeRecordingTrackId = null;
            this.setState(this.hasActivePlayback() ? 'PLAYING' : 'IDLE');
            this.startTrackPlayback(track.id);
        } catch (err) {
            console.error('DEBUG [AppController]: startRecording caught error', err);
            if (this.generation === currentGen) {
                this.activeTransport = null;
                this.activeRecordingTrackId = null;
                this.setState(this.hasActivePlayback() ? 'PLAYING' : 'IDLE');
            }
            throw new ApplicationDependencyError('Recording failed', err as Error);
        }
    }

    /**
     * Dynamically finalizes an open-ended recording session, quantizing the length
     * to the nearest bar boundary based on the current musical clock.
     */
    public finalizeRecording(): void {
        if (this._state !== 'RECORDING') return;
        if (!this.activeTransport) return;
        
        const plan = this.activeTransport.getPlan();
        if (!plan) return;

        const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });
        const now = this.timeSource.currentTime();
        
        // Calculate how many seconds have elapsed since recording started
        const elapsedSinceRecordingStart = now - plan.recordingStartTime;
        
        // Quantize to nearest bar boundary
        const elapsedBars = clock.secondsToBars(elapsedSinceRecordingStart);
        const quantizedBars = Math.max(1, Math.round(elapsedBars));
        
        const quantizedDuration = clock.barsToSeconds(quantizedBars);
        const endTime = plan.recordingStartTime + quantizedDuration;
        
        console.log('DEBUG [AppController]: finalizeRecording', 'now', now, 'plan.recordingStartTime', plan.recordingStartTime, 'elapsedBars', elapsedBars, 'quantizedBars', quantizedBars, 'endTime', endTime);
        
        this.activeTransport.finalize(endTime);
    }


    public stopRecording(): void {
        if (!this.activeTransport) return;
        this.generation++;
        this.activeTransport.stop();
        this.activeTransport = null;
        this.activeRecordingTrackId = null;
        this.setState(this.hasActivePlayback() ? 'PLAYING' : 'IDLE');
    }

    // ─── Playback ─────────────────────────────────────────────────

    /** Start all existing loops on one shared musical origin. */
    public startPlayback(): void {
        if (this._state !== 'IDLE') throw new ApplicationStateError(`Cannot start playback from state: ${this._state}`);
        const loops = this.session.getTracks().filter(t => t.getLoop() !== null);
        if (loops.length === 0) throw new ApplicationStateError('No loops available for playback');
        const currentGen = ++this.generation;
        try {
            const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });
            const playbackSessionId = `playback_${++this.playbackSessionCounter}`;
            const originTime = this.timeSource.currentTime() + this.config.sessionLeadTimeSeconds;
            this.playbackEngine.start(buildPlaybackPlan(this.session, clock, playbackSessionId, originTime));
            this.setState('PLAYING');
        } catch (err: any) {
            if (this.generation !== currentGen) return;
            this.setState('ERROR');
            throw new ApplicationDependencyError('Playback failed to start', err);
        }
    }

    /** Start one existing loop without disturbing other tracks, even during recording. */
    public startTrackPlayback(trackId: string): void {
        const track = this.session.getTracks().find(t => t.id === trackId);
        if (!track?.getLoop()) throw new ApplicationStateError(`Track ${trackId} has no loop`);
        if (this.isTrackPlaying(trackId)) return;

        const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });

        if (!this.hasActivePlayback()) {
            const playbackSessionId = `playback_${++this.playbackSessionCounter}`;
            const originTime = this.timeSource.currentTime() + this.config.sessionLeadTimeSeconds;
            this.playbackEngine.start(
                buildPlaybackPlan(this.session, clock, playbackSessionId, originTime),
                new Set([trackId])
            );
        } else {
            const activePlan = this.playbackEngine.getActivePlan();
            if (activePlan) {
                this.playbackEngine.updatePlan(
                    buildPlaybackPlan(this.session, clock, activePlan.playbackSessionId, activePlan.originTime)
                );
            }
            this.playbackEngine.startTrack(trackId);
        }

        if (this._state === 'IDLE' || this._state === 'PLAYING') this.setState('PLAYING');
    }

    public stopTrack(trackId: string): void {
        this.playbackEngine?.stopTrack(trackId);
        if (!this.hasActivePlayback() && !this.activeTransport) {
            this.setState('IDLE');
        } else {
            this.setState(this._state); // force re-render for TrackControl
        }
    }

    public stop(): void {
        this.generation++;
        if (this.activeTransport) {
            this.activeTransport.stop();
            this.activeTransport = null;
        }
        this.activeRecordingTrackId = null;
        if (this.playbackEngine) this.playbackEngine.cancel();
        this.setState('IDLE');
    }

    public async close(): Promise<void> {
        this.stop();
        this.engineLoop.stop();
        if (this.audioScheduler) this.audioScheduler.stop();
        if (this.audioEngine) await this.audioEngine.close();
    }
}
