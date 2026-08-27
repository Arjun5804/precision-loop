import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApplicationController } from '@precision-loop/application';
import { BrowserEngineLoop } from './BrowserEngineLoop';

interface AppContextValue {
    controller: ApplicationController | null;
    isInitialized: boolean;
}

const ApplicationContext = createContext<AppContextValue>({ controller: null, isInitialized: false });

export const ApplicationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [controller] = useState(() => {
        const engineLoop = new BrowserEngineLoop();
        const appController = new ApplicationController(
            {
                recordingWorkletUrl: new URL('/worklets/recording.js', window.location.href).href,
                foundationWorkletUrl: new URL('/worklets/foundation.js', window.location.href).href,
                sessionLeadTimeSeconds: 0.1
            },
            engineLoop
        );
        for (let i = 0; i < 4; i++) {
            appController.session.createTrack();
        }
        return appController;
    });
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        controller.initialize().then(() => {
            setIsInitialized(true);
        }).catch(err => {
            console.error('Failed to initialize ApplicationController:', err);
        });

        return () => {
            controller.close();
        };
    }, [controller]);

    return (
        <ApplicationContext.Provider value={{ controller, isInitialized }}>
            {children}
        </ApplicationContext.Provider>
    );
};

export const useApplicationController = () => {
    const context = useContext(ApplicationContext);
    if (!context.controller) {
        throw new Error('useApplicationController must be used within an ApplicationProvider');
    }
    return context.controller;
};
