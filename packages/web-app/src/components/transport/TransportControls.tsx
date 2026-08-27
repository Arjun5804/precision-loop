import React from 'react';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';

export const TransportControls: React.FC = () => {
    const controller = useApplicationController();
    const appState = useApplicationState();

    const handleAllStart = () => {
        if (appState === 'IDLE') {
            try {
                controller.startPlayback();
            } catch (err) {
                console.error('Playback failed', err);
            }
        }
    };

    const handleAllStop = () => {
        if (appState !== 'IDLE') {
            controller.stop();
        }
    };

    return (
        <div className="transport-section">
            <button 
                className="btn-rect" 
                onClick={handleAllStart}
                disabled={appState !== 'IDLE'}
                style={{ backgroundColor: appState === 'PLAYING' ? 'var(--accent-play)' : 'var(--bg-control)' }}
            >
                All Start
            </button>
            <button 
                className="btn-rect" 
                onClick={handleAllStop}
                disabled={appState === 'IDLE'}
                style={{ backgroundColor: appState !== 'IDLE' ? 'var(--accent-stopped)' : 'var(--bg-control)' }}
            >
                Stop
            </button>
            <div style={{ marginLeft: 'var(--spacing-lg)', fontFamily: 'monospace', fontSize: '18px', color: 'var(--accent-ready)' }}>
                {appState}
            </div>
        </div>
    );
};
