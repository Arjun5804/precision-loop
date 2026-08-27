import React from 'react';
import { useAudioState } from '../../hooks/useAudioState';
import { useApplicationController } from '../../application/ApplicationProvider';

export const AudioInitializer: React.FC = () => {
    const audioState = useAudioState();
    const controller = useApplicationController();

    if (audioState === 'running') {
        return null;
    }

    const handleInitialize = async () => {
        try {
            await controller.resumeAudio();
        } catch (err) {
            console.error('Failed to initialize audio', err);
        }
    };

    return (
        <div className="init-overlay">
            <div className="init-dialog">
                <h2>PRECISION LOOP</h2>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: 'var(--spacing-md)' }}>
                    SYSTEM STANDBY
                </div>
                <button className="power-btn" onClick={handleInitialize} title="Power On">
                    ⏻
                </button>
            </div>
        </div>
    );
};
