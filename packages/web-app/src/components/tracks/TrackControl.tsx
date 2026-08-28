import React, { useState } from 'react';
import { Track } from '@precision-loop/loop-model';
import { RecordingMode } from '@precision-loop/application';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';

interface TrackControlProps {
    track: Track;
    index: number;
}

export const TrackControl: React.FC<TrackControlProps> = ({ track, index }) => {
    const controller = useApplicationController();
    const appState = useApplicationState();
    const loop = track.getLoop();
    const hasLoop = loop !== null;
    const isRecordingTrack = controller.getActiveRecordingTrackId() === track.id;
    const isPlaying = hasLoop && controller.isTrackPlaying(track.id);
    const settings = controller.getTrackSettings(track.id);
    const [showSettings, setShowSettings] = useState(false);

    const isCountIn = isRecordingTrack && appState === 'PREPARING';
    const isRecording = isRecordingTrack && appState === 'RECORDING';
    const isReadyOrStopped = hasLoop && !isPlaying && !isRecordingTrack;
    const isEmpty = !hasLoop && !isRecordingTrack;

    const canDelete = controller.session.getTracks().length > 1 && !isRecordingTrack && isEmpty;

    const handleAction = () => {
        console.log('DEBUG [TrackControl]: handleAction', track.id, 'isEmpty', isEmpty, 'isCountIn', isCountIn, 'isRecording', isRecording, 'isPlaying', isPlaying, 'isReadyOrStopped', isReadyOrStopped, 'appState', appState);
        try {
            if (isEmpty) {
                if (appState === 'IDLE' || appState === 'PLAYING') {
                    void controller.startRecording(track.id).catch(err => {
                        console.error('Recording failed', err);
                        let c = err.cause;
                        while(c) {
                            console.error('Caused by:', c);
                            c = c.cause;
                        }
                    });
                }
            } else if (isCountIn) {
                controller.stopRecording(); // Abort count-in
            } else if (isRecording) {
                controller.finalizeRecording(); // Lock the loop length and play
            } else if (isPlaying) {
                controller.stopTrack(track.id);
            } else if (isReadyOrStopped) {
                controller.startTrackPlayback(track.id);
            }
        } catch (err) {
            console.error('Track action failed', err);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            controller.removeTrack(track.id);
        } catch (err) {
            console.error('Cannot remove track', err);
        }
    };

    const handleClearLoop = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPlaying) controller.stopTrack(track.id);
        track.removeLoop();
        controller.setTrackSettings(track.id, {}); // trigger re-render
    };

    const handleModeChange = (mode: RecordingMode) => {
        controller.setTrackSettings(track.id, { mode });
    };

    const handleCountInChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0 && val <= 8) {
            controller.setTrackSettings(track.id, { countInBars: val });
        }
    };

    const handleRecBarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1 && val <= 64) {
            controller.setTrackSettings(track.id, { recordingBars: val });
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
        <div
            className={`track-column ${stateClass}`}
            data-testid={`track-panel-${index + 1}`}
            data-track-state={statusText}
        >
            {/* Header row: track label + actions */}
            <div className="track-header">
                <div className="track-number-plate">TRACK {index + 1}</div>
                <div className="track-header-actions">
                    {isEmpty && (
                        <button
                            className="track-settings-btn"
                            onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                            aria-label={`Track ${index + 1} settings`}
                            title="Settings"
                        >⚙</button>
                    )}
                    {hasLoop && (
                        <button
                            className="track-clear-btn"
                            onClick={handleClearLoop}
                            aria-label={`Clear Track ${index + 1}`}
                            title="Clear loop"
                        >✕</button>
                    )}
                    {canDelete && (
                        <button
                            className="track-delete-btn"
                            onClick={handleDelete}
                            aria-label={`Delete Track ${index + 1}`}
                            title="Remove track"
                        >🗑</button>
                    )}
                </div>
            </div>

            {/* Per-track settings panel */}
            {showSettings && isEmpty && (
                <div className="track-settings-panel">
                    {/* Mode toggle */}
                    <div className="setting-row">
                        <span className="setting-label">MODE</span>
                        <div className="mode-toggle">
                            <button
                                className={`mode-btn ${settings.mode === 'FREE' ? 'active' : ''}`}
                                onClick={() => handleModeChange('FREE')}
                            >FREE</button>
                            <button
                                className={`mode-btn ${settings.mode === 'BAR' ? 'active' : ''}`}
                                onClick={() => handleModeChange('BAR')}
                            >BAR</button>
                        </div>
                    </div>
                    {/* Count-in bars */}
                    <div className="setting-row">
                        <span className="setting-label">COUNT-IN</span>
                        <input
                            className="setting-input"
                            type="number"
                            min={0}
                            max={8}
                            value={settings.countInBars}
                            onChange={handleCountInChange}
                            aria-label="Count-in bars"
                            data-testid={`track-${index + 1}-countin`}
                        />
                        <span className="setting-unit">BARS</span>
                    </div>
                    {/* Recording bars (BAR mode only) */}
                    {settings.mode === 'BAR' && (
                        <div className="setting-row">
                            <span className="setting-label">REC LEN</span>
                            <input
                                className="setting-input"
                                type="number"
                                min={1}
                                max={64}
                                value={settings.recordingBars}
                                onChange={handleRecBarsChange}
                                aria-label="Recording bars"
                                data-testid={`track-${index + 1}-recbars`}
                            />
                            <span className="setting-unit">BARS</span>
                        </div>
                    )}
                </div>
            )}

            <div className="track-status-line">
                <span className={`status-dot ${ledClass}`} aria-hidden="true" />
                <span className="status-text">{statusText}</span>
                {hasLoop && <span className="loop-length">{loop!.musicalLength.bars} BAR LOOP</span>}
                {isEmpty && !showSettings && (
                    <span className="track-mode-badge">{settings.mode} · {settings.countInBars}CI{settings.mode === 'BAR' ? ` · ${settings.recordingBars}R` : ''}</span>
                )}
            </div>

            <div className="pedal-container">
                <button
                    className="pedal"
                    onClick={handleAction}
                    aria-label={`Track ${index + 1} ${actionLabel}`}
                    title={`Track ${index + 1} ${actionLabel}`}
                    disabled={isRecordingTrack === false && !isEmpty && !isPlaying && !isReadyOrStopped}
                >
                    <div className="pedal-switch" aria-hidden="true"></div>
                </button>
                <div className="pedal-label">{actionLabel}</div>
            </div>
        </div>
    );
};
