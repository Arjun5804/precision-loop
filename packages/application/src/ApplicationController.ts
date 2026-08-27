import { Session } from '@precision-loop/loop-model';
import { AudioEngine, AudioEngineState } from '@precision-loop/audio-engine';
import { AudioScheduler, AudioTimeSource } from '@precision-loop/audio-scheduler';
import { RecordingEngine } from '@precision-loop/recording-engine';
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
    
    private generation: number = 0;
    
    private audioEngine: AudioEngine;
    private audioScheduler: AudioScheduler;
    private recordingEngine: RecordingEngine;
    private playbackEngine: PlaybackEngine;
    private timeSource: AudioTimeSource;
    private eventRouter: ApplicationEventRouter;
    
    private playbackSessionCounter: number = 0;
    
    // Transport is re-instantiated per recording session to ensure it uses the latest Session tempo/timeSignature
    private activeTransport: Transport | null = null;
    private activeRecordingTrackId: string | null = null;
    
    constructor(
        private config: ApplicationConfig,
        private engineLoop: EngineLoop
    ) {
        // Initialize Session (defaulting to 120 BPM, 4/4)
        this.session = new Session('session_1', 120, { numerator: 4, denominator: 4 });
        
        this.audioEngine = new AudioEngine();
        this.eventRouter = new ApplicationEventRouter();
        
        // Circular dependency resolution: Create time source placeholder first, or instantiate after AudioEngine init
        // We will initialize them in `initialize()` method.
        // We just assign placeholders or use definite assignment assertions if we were using strictPropertyInitialization,
        // but here we just leave them uninitialized until `initialize()` is called.
        // To satisfy TypeScript without strictPropertyInitialization errors, we can use `!` or cast.
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
        
        const resourceAdapter = new WebResourceAdapter(context, this.audioEngine);
        this.playbackEngine = new PlaybackEngine(resourceAdapter, this.audioScheduler, this.timeSource);
        
        // Resolve circular router dependency
        this.eventRouter.playbackEngine = this.playbackEngine;
        
        // Start scheduler loop
        this.audioScheduler.start();
        
        this.engineLoop.start(() => {
            this.audioScheduler.tick();
            this.playbackEngine.replenish();
        });
    }
    
    public getState(): AppState {
        return this._state;
    }
    
    public onStateChange(listener: (state: AppState) => void): () => void {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }
    
    private setState(state: AppState): void {
        this._state = state;
        for (const listener of this.stateListeners) {
            listener(state);
        }
    }
    
    public getAudioState(): AudioEngineState {
        return this.audioEngine.state;
    }
    
    public onAudioStateChange(listener: (state: AudioEngineState) => void): () => void {
        return this.audioEngine.onStateChange(listener);
    }
    
    public getActiveRecordingTrackId(): string | null {
        return this.activeRecordingTrackId;
    }
    
    public async resumeAudio(): Promise<void> {
        await this.audioEngine.resume();
    }
    
    public async startRecording(trackId: string, countInBars: number, recordingBars: number): Promise<void> {
        if (this._state !== 'IDLE') {
            throw new ApplicationStateError(`Cannot start recording from state: ${this._state}`);
        }
        
        const track = this.session.getTracks().find(t => t.id === trackId);
        if (!track) {
            throw new ApplicationStateError(`Track ${trackId} not found`);
        }
        
        this.setState('PREPARING');
        this.activeRecordingTrackId = trackId;
        const currentGen = ++this.generation;
        
        try {
            // 1. Sync Clock to Session
            const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });
            
            // 2. Setup Transport
            this.activeTransport = new Transport(clock, this.audioScheduler, this.recordingEngine);
            this.activeTransport.configure({
                tempo: this.session.getTempo(),
                timeSignature: this.session.getTimeSignature(),
                countInBars,
                recordingBars
            });
            
            const sessionStartTime = this.timeSource.currentTime() + this.config.sessionLeadTimeSeconds;
            
            // 3. Start Transport and await completion
            this.setState('RECORDING');
            await this.activeTransport.start(sessionStartTime, this.config.recordingWorkletUrl);
            
            if (this.generation !== currentGen) return; // Stale, cancelled
            
            // 4. Adapt and mutate domain
            const recordedTake = this.activeTransport.getTake();
            if (!recordedTake) {
                this.activeRecordingTrackId = null;
                throw new Error("Transport completed but returned no take");
            }
            
            const take = adaptRecordedTake(this.session, recordedTake);
            const loop = this.session.createLoop({
                take,
                musicalLength: { bars: recordingBars }
            });
            
            track.setLoop(loop);
            
            this.activeTransport = null;
            this.activeRecordingTrackId = null;
            this.setState('IDLE');
            
        } catch (err: any) {
            if (this.generation !== currentGen) return; // Stale, ignore
            
            this.activeTransport = null;
            this.activeRecordingTrackId = null;
            this.setState('ERROR');
            throw new ApplicationDependencyError('Recording failed', err);
        }
    }
    
    public startPlayback(): void {
        if (this._state !== 'IDLE') {
            throw new ApplicationStateError(`Cannot start playback from state: ${this._state}`);
        }
        
        const currentGen = ++this.generation;
        
        try {
            const clock = new MusicalClock(this.session.getTempo(), this.session.getTimeSignature(), { subdivisionsPerBeat: 4 });
            const playbackSessionId = `playback_${++this.playbackSessionCounter}`;
            const originTime = this.timeSource.currentTime() + this.config.sessionLeadTimeSeconds;
            
            const plan = buildPlaybackPlan(this.session, clock, playbackSessionId, originTime);
            
            this.playbackEngine.start(plan);
            
            this.setState('PLAYING');
        } catch (err: any) {
            if (this.generation !== currentGen) return;
            this.setState('ERROR');
            throw new ApplicationDependencyError('Playback failed to start', err);
        }
    }
    
    public stop(): void {
        this.generation++; // Cancel pending async operations
        
        if (this.activeTransport) {
            this.activeTransport.stop();
            this.activeTransport = null;
        }
        
        this.activeRecordingTrackId = null;
        
        if (this.playbackEngine) {
            this.playbackEngine.cancel();
        }
        
        this.setState('IDLE');
    }
    
    public async close(): Promise<void> {
        this.stop();
        this.engineLoop.stop();
        if (this.audioScheduler) {
            this.audioScheduler.stop();
        }
        if (this.audioEngine) {
            await this.audioEngine.close();
        }
    }
}
