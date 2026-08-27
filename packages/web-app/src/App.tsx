import React from 'react';
import { ApplicationProvider } from './application/ApplicationProvider';
import { AudioInitializer } from './components/initialization/AudioInitializer';
import { SessionDisplay } from './components/session/SessionDisplay';
import './styles/main.css';

const MainApp: React.FC = () => {
    // The AudioInitializer handles the suspended overlay.
    return (
        <>
            <SessionDisplay />
            <AudioInitializer />
        </>
    );
};

export const App: React.FC = () => {
    return (
        <ApplicationProvider>
            <MainApp />
        </ApplicationProvider>
    );
};

export default App;
