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
    const isRecording = controller.getActiveRecordingTrackId() === track.id;
    const isPlaying = hasLoop && controller.isTrackPlaying(track.id);
    const anotherTrackRecording = controller.getActiveRecordingTrackId() !== null && !isRecording;

    const handleAction = () => {
        try {
            if (isRecording) {
                controller.stopRecording();
            } else if (!hasLoop) {
                if (appState === 'IDLE' || appState === 'PLAYING') {
                    void controller.startRecording(track.id, 1, 4).catch(err => console.error('Recording failed', err));
                }
            } else if (isPlaying) {
                controller.stopTrack(track.id);
            } else if (!anotherTrackRecording) {
                controller.startTrackPlayback(track.id);
            }
        } catch (err) {
            console.error('Track action failed', err);
        }
    };

    const ledState = isRecording ? 'rec' : isPlaying ? 'play' : '';
    const label = isRecording ? 'STOP REC' : isPlaying ? 'STOP' : hasLoop ? 'PLAY' : 'REC';

    return (
        <div className={`track-column ${isRecording ? 'is-recording' : ''} ${isPlaying ? 'is-playing' : ''}`}>
            <div className="track-number-plate">TRACK {index + 1}</div>

            <div className="track-status-line">
                <span className={`status-dot ${ledState}`} />
                <span>{isRecording ? 'RECORDING' : isPlaying ? 'PLAYING' : hasLoop ? 'READY' : 'EMPTY'}</span>
            </div>

            <div className="fader-slot">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(track.getVolume() * 100)}
                    disabled
                    aria-label={`Track ${index + 1} volume`}
                />
            </div>

            <div className="pedal-container">
                <button className="pedal" onClick={handleAction} disabled={anotherTrackRecording && !isRecording}>
                    {hasLoop ? '▶/■' : '●'}
                </button>
                <div className="pedal-label">{label}</div>
            </div>
        </div>
    );
};
