import React from 'react';
import { TransportControls } from '../transport/TransportControls';
import { TrackList } from '../tracks/TrackList';
import { useApplicationController } from '../../application/ApplicationProvider';

export const SessionDisplay: React.FC = () => {
    const controller = useApplicationController();
    const tempo = controller.session.getTempo();
    const ts = controller.session.getTimeSignature();

    return (
        <div className="app-container">
            <header className="header-panel">
                <div>
                    <h1 style={{ letterSpacing: '2px', textTransform: 'uppercase' }}>Precision Loop</h1>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--spacing-xs)' }}>
                        {tempo} BPM | {ts.numerator}/{ts.denominator}
                    </div>
                </div>
                <TransportControls />
            </header>
            
            <TrackList />
        </div>
    );
};
