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
        <>
            <button 
                className="pedal" 
                onClick={handleAllStart}
                disabled={appState !== 'IDLE'}
                style={{ 
                    borderTopColor: appState === 'PLAYING' ? 'var(--led-play)' : 'var(--pedal-border-top)',
                    boxShadow: appState === 'PLAYING' ? '0 1px 2px rgba(0,0,0,0.8), inset 0 5px 10px rgba(0,0,0,0.9)' : undefined,
                    transform: appState === 'PLAYING' ? 'translateY(4px)' : undefined,
                    borderBottomWidth: appState === 'PLAYING' ? '0px' : undefined
                }}
            >
                ALL START
            </button>
            <button 
                className="pedal" 
                onClick={handleAllStop}
                disabled={appState === 'IDLE'}
                style={{ 
                    borderTopColor: appState !== 'IDLE' ? 'var(--led-rec)' : 'var(--pedal-border-top)'
                }}
            >
                STOP
            </button>
        </>
    );
};
