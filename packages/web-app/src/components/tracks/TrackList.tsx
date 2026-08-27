import React from 'react';
import { useApplicationController } from '../../application/ApplicationProvider';
import { TrackControl } from './TrackControl';

export const TrackList: React.FC = () => {
    const controller = useApplicationController();
    const tracks = controller.session.getTracks();

    return (
        <div className="tracks-container">
            {tracks.map((track, idx) => (
                <TrackControl key={track.id} track={track} index={idx} />
            ))}
        </div>
    );
};
