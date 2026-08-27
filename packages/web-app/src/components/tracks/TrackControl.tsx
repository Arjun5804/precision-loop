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
    const isRecordingTrack = controller.getActiveRecordingTrackId() === track.id;
    const isPlaying = hasLoop && controller.isTrackPlaying(track.id);

    const isCountIn = isRecordingTrack && appState === 'PREPARING';
    const isRecording = isRecordingTrack && appState === 'RECORDING';
    const isReadyOrStopped = hasLoop && !isPlaying && !isRecordingTrack;
    const isEmpty = !hasLoop && !isRecordingTrack;

    const handleAction = () => {
        try {
            if (isEmpty) {
                if (appState === 'IDLE' || appState === 'PLAYING') {
                    void controller.startRecording(track.id, 1, 4).catch(err => console.error('Recording failed', err));
                }
            } else if (isCountIn || isRecording) {
                controller.stopRecording();
            } else if (isPlaying) {
                controller.stopTrack(track.id);
            } else if (isReadyOrStopped) {
                controller.startTrackPlayback(track.id);
            }
        } catch (err) {
            console.error('Track action failed', err);
        }
    };

    let statusText = 'EMPTY';
    let ledClass = '';
    let actionLabel = 'REC';

    if (isCountIn) {
        statusText = 'COUNT-IN';
        ledClass = 'count-in';
        actionLabel = 'STOP';
    } else if (isRecording) {
        statusText = 'RECORDING';
        ledClass = 'rec';
        actionLabel = 'STOP';
    } else if (isPlaying) {
        statusText = 'PLAYING';
        ledClass = 'play';
        actionLabel = 'STOP';
    } else if (isReadyOrStopped) {
        statusText = 'READY';
        ledClass = 'ready';
        actionLabel = 'PLAY';
    }

    const stateClass = isRecording ? 'is-recording' : isCountIn ? 'is-count-in' : isPlaying ? 'is-playing' : '';

    return (
        <div className={`track-column ${stateClass}`} data-testid={`track-panel-${index + 1}`}>
            <div className="track-number-plate">TRACK {index + 1}</div>

            <div className="track-status-line">
                <span className={`status-dot ${ledClass}`} />
                <span className="status-text">{statusText}</span>
            </div>

            <div className="pedal-container">
                <button 
                    className="pedal" 
                    onClick={handleAction} 
                    aria-label={`Track ${index + 1} ${actionLabel}`}
                    title={`Track ${index + 1} ${actionLabel}`}
                >
                    <div className="pedal-switch"></div>
                </button>
                <div className="pedal-label">{actionLabel}</div>
            </div>
        </div>
    );
};
