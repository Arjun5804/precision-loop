import { useState, useEffect } from 'react';
import { AppState } from '@precision-loop/application';
import { useApplicationController } from '../application/ApplicationProvider';

export const useApplicationState = () => {
    const controller = useApplicationController();
    const [state, setState] = useState<AppState>(controller.getState());

    useEffect(() => {
        // Initialize state just in case it changed between render and effect
        setState(controller.getState());
        
        // Subscribe to changes
        const unsubscribe = controller.onStateChange((newState) => {
            setState(newState);
        });

        return unsubscribe;
    }, [controller]);

    return state;
};
