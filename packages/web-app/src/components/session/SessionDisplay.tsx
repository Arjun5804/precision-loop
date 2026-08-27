import React from 'react';
import { TransportControls } from '../transport/TransportControls';
import { TrackList } from '../tracks/TrackList';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';

export const SessionDisplay: React.FC = () => {
    const controller = useApplicationController();
    const appState = useApplicationState();
    const tempo = controller.session.getTempo();
    const ts = controller.session.getTimeSignature();

    return (
        <div className="app-container">
            {/* Global LCD Panel */}
            <div className="lcd-panel-container">
                <div className="lcd-panel">
                    <h1 className="lcd-title">PRECISION LOOP</h1>
                    <div className="lcd-stats">
                        <span>BPM: {tempo}</span>
                        <span>SIG: {ts.numerator}/{ts.denominator}</span>
                        <span data-testid="app-state-label">STS: {appState}</span>
                    </div>
                </div>
            </div>
            
            {/* Tracks Bay */}
            <div className="tracks-bay">
                <TrackList />
            </div>

            {/* Global Transport */}
            <div className="global-transport">
                <TransportControls />
            </div>
        </div>
    );
};
