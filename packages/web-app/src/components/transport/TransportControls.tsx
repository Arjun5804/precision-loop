import React from 'react';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';

export const TransportControls: React.FC = () => {
    const controller = useApplicationController();
    const appState = useApplicationState();
    const hasAnyLoop = controller.session.getTracks().some(t => t.getLoop() !== null);

    const handleAllStart = () => {
        if (appState === 'IDLE' && hasAnyLoop) {
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
            <div className="pedal-container global-pedal">
                <button 
                    className="pedal" 
                    onClick={handleAllStart}
                    disabled={appState !== 'IDLE' || !hasAnyLoop}
                    aria-label="All Start"
                    title="All Start"
                >
                    <div className="pedal-switch"></div>
                </button>
                <div className="pedal-label">ALL START</div>
            </div>
            
            <div className="pedal-container global-pedal">
                <button 
                    className="pedal" 
                    onClick={handleAllStop}
                    disabled={appState === 'IDLE'}
                    aria-label="All Stop"
                    title="All Stop"
                >
                    <div className="pedal-switch"></div>
                </button>
                <div className="pedal-label">STOP</div>
            </div>
        </>
    );
};
