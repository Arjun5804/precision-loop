import React from 'react';
import { Track } from '@precision-loop/loop-model';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';

interface TrackControlProps {
    track: Track;
    index: number;
}

export const TrackControl: React.FC<TrackControlProps> = ({ track, index }) => {
    const controller = useApplicationController();
    const appState = useApplicationState();
    const hasLoop = track.getLoop() !== null;
    const isThisTrackRecording = controller.getActiveRecordingTrackId() === track.id;

    const isRecLedOn = isThisTrackRecording && appState === 'RECORDING';
    const isReadyLedOn = isThisTrackRecording && appState === 'PREPARING';
    const isPlayLedOn = appState === 'PLAYING' && hasLoop;

    const handleAction = () => {
        if (appState === 'IDLE' && !hasLoop) {
            // Start recording on this track with v0.1 defaults (1 bar count-in, 4 bars record)
            controller.startRecording(track.id, 1, 4).catch(err => {
                console.error('Failed to start recording', err);
            });
        } else if (appState === 'IDLE' && hasLoop) {
            // Start playback globally (v0.1 simplified)
            controller.startPlayback();
        } else if (isThisTrackRecording || isPlayLedOn) {
            // Stop if we are actively playing or recording this track
            controller.stop();
        }
    };

    return (
        <div className="track-column">
            <div className="track-number-plate">
                TRACK {index + 1}
            </div>
            
            <div className="led-array">
                <div className={`led ${isRecLedOn ? 'rec' : ''}`} title="Recording" />
                <div className={`led ${isPlayLedOn ? 'play' : ''}`} title="Playing" />
                <div className={`led ${isReadyLedOn ? 'ready' : ''}`} title="Armed/Preparing" />
            </div>

            <div className="fader-slot">
                <input 
                    type="range" 
                    style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }} 
                    min="0" max="100" defaultValue="80" disabled 
                />
            </div>

            <div className="pedal-container">
                <button 
                    className="pedal"
                    onClick={handleAction}
                >
                    {hasLoop ? '▶/■' : '●'}
                </button>
                <div className="pedal-label">
                    {hasLoop ? 'PLAY/STOP' : 'REC/DUB'}
                </div>
            </div>
        </div>
    );
};
