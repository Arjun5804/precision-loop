import { useState, useEffect } from 'react';
import { AudioEngineState } from '@precision-loop/audio-engine';
import { useApplicationController } from '../application/ApplicationProvider';

export const useAudioState = () => {
    const controller = useApplicationController();
    const [audioState, setAudioState] = useState<AudioEngineState>(controller.getAudioState());

    useEffect(() => {
        setAudioState(controller.getAudioState());
        
        const unsubscribe = controller.onAudioStateChange((newState) => {
            setAudioState(newState);
        });

        return unsubscribe;
    }, [controller]);

    return audioState;
};
