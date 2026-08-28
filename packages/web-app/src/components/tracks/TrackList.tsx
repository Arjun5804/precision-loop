import React from 'react';
import { useApplicationController } from '../../application/ApplicationProvider';
import { useApplicationState } from '../../hooks/useApplicationState';
import { TrackControl } from './TrackControl';

export const TrackList: React.FC = () => {
    const controller = useApplicationController();
    useApplicationState(); // re-render on state changes (track add/remove triggers setState)
    const tracks = controller.session.getTracks();

    const handleAddTrack = () => {
        controller.addTrack();
    };

    return (
        <div className="tracks-container">
            {tracks.map((track, idx) => (
                <TrackControl key={track.id} track={track} index={idx} />
            ))}
            <div className="track-column add-track-card" onClick={handleAddTrack} role="button" tabIndex={0} aria-label="Add track">
                <div className="add-track-icon">+</div>
                <div className="add-track-label">ADD TRACK</div>
            </div>
        </div>
    );
};
