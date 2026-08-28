import React, { useState } from 'react';
import { TransportControls } from '../transport/TransportControls';
import { TrackList } from '../tracks/TrackList';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';

const COMMON_TIME_SIGNATURES = [
    { numerator: 4, denominator: 4, label: '4/4' },
    { numerator: 3, denominator: 4, label: '3/4' },
    { numerator: 6, denominator: 8, label: '6/8' },
    { numerator: 5, denominator: 4, label: '5/4' },
    { numerator: 7, denominator: 8, label: '7/8' },
    { numerator: 2, denominator: 4, label: '2/4' },
];

export const SessionDisplay: React.FC = () => {
    const controller = useApplicationController();
    const appState = useApplicationState();
    const tempo = controller.session.getTempo();
    const ts = controller.session.getTimeSignature();
    const hasLoops = controller.session.getTracks().some(t => t.getLoop() !== null);
    const [tempoInput, setTempoInput] = useState(String(tempo));

    const handleTempoChange = (delta: number) => {
        const newTempo = Math.min(300, Math.max(40, tempo + delta));
        try {
            controller.setTempo(newTempo);
            setTempoInput(String(newTempo));
        } catch { /* loops exist */ }
    };

    const handleTempoInputBlur = () => {
        const val = parseInt(tempoInput, 10);
        if (!isNaN(val) && val >= 40 && val <= 300) {
            try {
                controller.setTempo(val);
                setTempoInput(String(val));
            } catch { setTempoInput(String(tempo)); }
        } else {
            setTempoInput(String(tempo));
        }
    };

    const handleTempoInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    };

    const handleTsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const idx = parseInt(e.target.value, 10);
        const sig = COMMON_TIME_SIGNATURES[idx];
        try {
            controller.setTimeSignature({ numerator: sig.numerator, denominator: sig.denominator });
        } catch { /* loops exist */ }
    };

    const currentTsIndex = COMMON_TIME_SIGNATURES.findIndex(
        s => s.numerator === ts.numerator && s.denominator === ts.denominator
    );

    return (
        <div className="app-container">
            {/* Global LCD Panel */}
            <div className="lcd-panel-container">
                <div className="lcd-panel">
                    <h1 className="lcd-title">PRECISION LOOP</h1>
                    <div className="lcd-controls">
                        {/* Tempo Control */}
                        <div className="lcd-control-group">
                            <span className="lcd-control-label">BPM</span>
                            <div className="lcd-control-row">
                                <button
                                    className="lcd-btn"
                                    onClick={() => handleTempoChange(-1)}
                                    disabled={hasLoops}
                                    aria-label="Decrease tempo"
                                >−</button>
                                <input
                                    className="lcd-input"
                                    type="text"
                                    value={tempoInput}
                                    onChange={e => setTempoInput(e.target.value)}
                                    onBlur={handleTempoInputBlur}
                                    onKeyDown={handleTempoInputKeyDown}
                                    disabled={hasLoops}
                                    aria-label="Tempo BPM"
                                    data-testid="tempo-input"
                                />
                                <button
                                    className="lcd-btn"
                                    onClick={() => handleTempoChange(1)}
                                    disabled={hasLoops}
                                    aria-label="Increase tempo"
                                >+</button>
                            </div>
                        </div>

                        {/* Time Signature Control */}
                        <div className="lcd-control-group">
                            <span className="lcd-control-label">SIG</span>
                            <select
                                className="lcd-select"
                                value={currentTsIndex >= 0 ? currentTsIndex : 0}
                                onChange={handleTsChange}
                                disabled={hasLoops}
                                aria-label="Time signature"
                                data-testid="time-sig-select"
                            >
                                {COMMON_TIME_SIGNATURES.map((sig, i) => (
                                    <option key={sig.label} value={i}>{sig.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Status */}
                        <div className="lcd-control-group">
                            <span className="lcd-control-label">STATUS</span>
                            <span className="lcd-status-value" data-testid="app-state-label">{appState}</span>
                        </div>
                    </div>
                    {hasLoops && (
                        <div className="lcd-lock-notice">🔒 Clear all loops to change tempo/signature</div>
                    )}
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
