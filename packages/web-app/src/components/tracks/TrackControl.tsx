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

    // Determine state for the indicator
    // In a real app we'd track per-track state. Since v0.1 has a global transport,
    // if the app is recording and it's on this track, we show red.
    // For now, let's assume if appState is RECORDING, it's active if there's no loop yet or we just assume it's this track if we initiated it.
    // To simplify for v0.1, we'll just check if it has a loop.
    let indicatorState = '';
    if (appState === 'RECORDING') indicatorState = 'state-recording';
    else if (appState === 'PLAYING' && hasLoop) indicatorState = 'state-playing';
    else if (appState === 'PREPARING') indicatorState = 'state-preparing';

    const handleAction = () => {
        if (appState === 'IDLE' && !hasLoop) {
            // Start recording on this track (1 bar count-in, 4 bars record for demo)
            controller.startRecording(track.id, 1, 4).catch(err => {
                console.error('Failed to start recording', err);
            });
        } else if (appState === 'IDLE' && hasLoop) {
            // Start playback globally (v0.1 simplified)
            controller.startPlayback();
        } else {
            // Stop
            controller.stop();
        }
    };

    return (
        <div className="track-panel">
            <div className="track-header">
                <h3>Track {index + 1}</h3>
            </div>
            
            <div className="track-controls">
                {/* FX/Track Buttons */}
                <button className="btn-rect" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>FX</button>
                <button className="btn-rect" style={{ backgroundColor: 'var(--bg-control)', border: '1px solid var(--accent-ready)' }}>TRACK</button>
                
                {/* Stop button (small square) */}
                <button 
                    className="btn-hardware" 
                    style={{ borderRadius: 'var(--border-radius-sm)', padding: 'var(--spacing-sm)', width: '32px', height: '32px' }}
                    onClick={() => controller.stop()}
                >
                    <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--text-primary)' }} />
                </button>

                {/* Volume Fader */}
                <div className="fader-container">
                    <input type="range" style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }} min="0" max="100" defaultValue="80" disabled />
                </div>

                {/* Main Action Button */}
                <button 
                    className={`btn-hardware btn-circular btn-indicator ${indicatorState}`}
                    onClick={handleAction}
                >
                    {hasLoop ? '▶ / ⏹' : 'REC'}
                </button>
            </div>
            
            <div className="track-status">
                {hasLoop ? 'Contains Loop' : 'Empty'}
            </div>
        </div>
    );
};
