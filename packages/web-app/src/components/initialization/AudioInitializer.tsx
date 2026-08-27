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
                <h2>Audio Engine Suspended</h2>
                <p>Click below to initialize the audio engine and enable transport controls.</p>
                <button className="btn-rect" onClick={handleInitialize}>
                    Initialize Audio
                </button>
            </div>
        </div>
    );
};
