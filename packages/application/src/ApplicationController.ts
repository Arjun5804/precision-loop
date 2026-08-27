import { Session } from '@precision-loop/loop-model';
import { AudioEngine, AudioEngineState } from '@precision-loop/audio-engine';
import { AudioScheduler, AudioTimeSource } from '@precision-loop/audio-scheduler';
import { RecordingEngine, RecordingState } from '@precision-loop/recording-engine';
import { PlaybackEngine, WebResourceAdapter } from '@precision-loop/playback-engine';
import { Transport } from '@precision-loop/transport';
import { MusicalClock } from '@precision-loop/musical-clock';

import { AppState, ApplicationConfig } from './types';
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
        this.audioScheduler = new AudioScheduler(this.timeSource, this.eventRouter);
        const context = this.audioEngine.context;
        this.recordingEngine = new RecordingEngine(context);
        this.recordingEngine.onStateChange((state: RecordingState) => {
            // The recording engine is the authoritative source for the exact
            // point at which PCM capture actually begins. This keeps the UI's
            // COUNT-IN/RECORDING state tied to audio runtime, not wall-clock UI timers.
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

    /** Record a new loop without interrupting already-playing tracks. */
    public async startRecording(trackId: string, countInBars: number, recordingBars: number): Promise<void> {
        if (this._state !== 'IDLE' && this._state !== 'PLAYING') {
            throw new ApplicationStateError(`Cannot start recording from state: ${this._state}`);
        }
        const track = this.session.getTracks().find(t => t.id === trackId);
        if (!track) throw new ApplicationStateError(`Track ${trackId} not found`);
        if (track.getLoop()) throw new ApplicationStateError(`Track ${trackId} already contains a loop`);
        if (this.activeTransport) throw new ApplicationStateError('A recording is already active');

        this.activeRecordingTrackId = trackId;
        this.setState('PREPARING');
        const currentGen = ++this.generation;

        try {
            const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });
            this.activeTransport = new Transport(clock, this.audioScheduler, this.recordingEngine);
            this.activeTransport.configure({ tempo: this.session.getTempo(), timeSignature: this.session.getTimeSignature(), countInBars, recordingBars });

            const sessionStartTime = this.timeSource.currentTime() + this.config.sessionLeadTimeSeconds;
            await this.activeTransport.start(sessionStartTime, this.config.recordingWorkletUrl);
            if (this.generation !== currentGen) return;

            const recordedTake = this.activeTransport.getTake();
            if (!recordedTake) throw new Error('Transport completed but returned no take');
            const take = adaptRecordedTake(this.session, recordedTake);
            const loop = this.session.createLoop({ take, musicalLength: { bars: recordingBars } });
            track.setLoop(loop);

            // A loop station convention is to enter playback immediately when
            // a loop is closed. Clear recording ownership first so the normal
            // independent-track playback path can start cleanly.
            this.activeTransport = null;
            this.activeRecordingTrackId = null;
            this.startTrackPlayback(track.id);
        } catch (err: any) {
            if (this.generation !== currentGen) return;
            this.activeTransport = null;
            this.activeRecordingTrackId = null;
            this.setState(this.hasActivePlayback() ? 'PLAYING' : 'ERROR');
            throw new ApplicationDependencyError('Recording failed', err);
        }
    }

    public stopRecording(): void {
        if (!this.activeTransport) return;
        this.generation++;
        this.activeTransport.stop();
        this.activeTransport = null;
        this.activeRecordingTrackId = null;
        this.setState(this.hasActivePlayback() ? 'PLAYING' : 'IDLE');
    }

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
            this.playbackEngine.startTrack(trackId);
        }

        // Keep PREPARING/RECORDING authoritative while another recording is active.
        if (this._state === 'IDLE' || this._state === 'PLAYING') this.setState('PLAYING');
        else this.setState(this._state);
    }

    public stopTrack(trackId: string): void {
        this.playbackEngine?.stopTrack(trackId);
        if (!this.hasActivePlayback() && !this.activeTransport) this.setState('IDLE');
        else this.setState(this._state);
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
