import { useState, useEffect } from 'react';
import { AppState } from '@precision-loop/application';
import { useApplicationController } from '../application/ApplicationProvider';

export const useApplicationState = () => {
    const controller = useApplicationController();
    const [state, setState] = useState<AppState>(controller.getState());
    const [, setRevision] = useState(0);

    useEffect(() => {
        setState(controller.getState());

        // ApplicationController emits state notifications for both global
        // state transitions and track-level playback changes. A revision is
        // used so React also re-renders when the state string itself is
        // unchanged (for example PLAYING -> PLAYING after stopping one track).
        const unsubscribe = controller.onStateChange((newState) => {
            setState(newState);
            setRevision(value => value + 1);
        });

        return unsubscribe;
    }, [controller]);

    return state;
};
