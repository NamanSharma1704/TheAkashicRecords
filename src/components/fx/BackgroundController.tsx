import React, { memo } from 'react';
import GalaxyNebula from './GalaxyNebula';
import OmniscientField from './OmniscientField';
import GoldenRipples from './GoldenRipples';
import IlluminatedCodex from './IlluminatedCodex';
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
            {/* Two different atmospheres, not one recoloured. The Void keeps its emissive
                starfield/ripples; the light theme gets its own "light and ink on vellum" set. The
                concentric ring system is no longer here — it is the card-centred ArcaneSigil in the
                hero now (both themes), so it stays aligned to the card instead of the viewport. */}
            {isDivineMode ? (
                <IlluminatedCodex theme={theme} isPaused={isPaused} />
            ) : (
                <>
                    <OmniscientField isDivineMode={isDivineMode} isPaused={isPaused} isMobile={isMobile} />
                    {!isMobile && (
                        <GoldenRipples colorRGB={theme.starColor} isPaused={isPaused} isDark={theme.isDark} />
                    )}
                </>
            )}
            <NoiseOverlay />
        </div>
    );
};

export default memo(BackgroundController);
