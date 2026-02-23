import React, { memo } from 'react';
import GalaxyNebula from './GalaxyNebula';
import OmniscientField from './OmniscientField';
import SanctuaryRing from './SanctuaryRing';
import GoldenRipples from './GoldenRipples';
import NoiseOverlay from './NoiseOverlay';
import { Theme } from '../../core/types';

interface BackgroundControllerProps {
    theme: Theme;
    isPaused?: boolean;
    isMobile?: boolean;
}

const BackgroundController: React.FC<BackgroundControllerProps> = ({ theme, isPaused = false, isMobile = false }) => {
    const isDivineMode = theme.id === 'LIGHT';

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <GalaxyNebula theme={theme} />
            <OmniscientField isDivineMode={isDivineMode} isPaused={isPaused} isMobile={isMobile} />
            {!isMobile && (
                <>
                    <SanctuaryRing theme={theme} isPaused={isPaused} />
                    <GoldenRipples colorRGB={theme.starColor} isPaused={isPaused} />
                </>
            )}
            <NoiseOverlay />
        </div>
    );
};

export default memo(BackgroundController);
