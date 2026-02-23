import React, { useState, useEffect } from 'react';
import { Theme } from '../../core/types';
import OmniscientField from '../fx/OmniscientField';
import ScrambleText from './ScrambleText';

interface BootScreenProps {
    onComplete: () => void;
    theme: Theme;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete, theme }) => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const t1 = setTimeout(() => setPhase(1), 500);
        const t2 = setTimeout(() => setPhase(2), 1500);
        const t3 = setTimeout(() => setPhase(3), 3000);
        const t4 = setTimeout(() => onComplete(), 5500);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[100] bg-[#020202] flex flex-col items-center justify-center overflow-hidden cursor-wait font-mono">
            <OmniscientField forceAmber={true} />
            <div className="relative z-10 flex flex-col items-center">
                <div className={`relative transition-all duration-1000 ${phase >= 2 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                    {/* Outer Ring: Dominant Gold with Internal Bloom */}
                    <div className="w-64 h-64 md:w-96 md:h-96 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-600 via-amber-600 to-cyan-500 animate-[spin_10s_linear_infinite] absolute inset-0 m-auto flex items-center justify-center opacity-100 overflow-hidden shadow-[inset_0_0_15px_rgba(255,255,255,0.2)]">
                        <div className="w-full h-full rounded-full bg-[#020202] shadow-[0_0_10px_rgba(251,191,36,0.3)]" />
                    </div>

                    {/* Middle Ring: Dominant Gold Reverse with Internal Bloom */}
                    <div className="w-48 h-48 md:w-72 md:h-72 rounded-full p-[2.5px] bg-gradient-to-bl from-cyan-500 via-amber-600 to-amber-600 animate-[spin_6s_linear_infinite_reverse] absolute inset-0 m-auto flex items-center justify-center opacity-100 overflow-hidden shadow-[inset_0_0_12px_rgba(255,255,255,0.15)]">
                        <div className="w-full h-full rounded-full bg-[#020202] shadow-[0_0_8px_rgba(6,182,212,0.2)]" />
                    </div>

                    {/* Inner Ring: Gold Dominant Pulse with Internal Bloom */}
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full p-[3px] bg-gradient-to-r from-amber-600 via-amber-600 to-cyan-500 animate-pulse absolute inset-0 m-auto flex items-center justify-center opacity-100 overflow-hidden shadow-[inset_0_0_10px_rgba(255,255,255,0.2)]">
                        <div className="w-full h-full rounded-full bg-[#020202] border border-dashed border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.2)]" />
                    </div>
                </div>
                <div className={`mt-8 text-center transition-opacity duration-500 ${phase >= 1 ? 'opacity-100' : 'opacity-0'} relative z-20`}>
                    <div className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-cyan-200 tracking-tighter drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                        <ScrambleText text={phase >= 3 ? "APOTHEOSIS COMPLETE" : "ASCENDING..."} speed={40} revealSpeed={phase >= 3 ? 0.6 : 0.33} />
                    </div>
                    <div className="mt-4 h-1.5 w-48 mx-auto bg-gray-900 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r from-amber-500 to-cyan-500 transition-all duration-[3000ms] ease-out progress-bloom ${phase >= 1 ? 'w-full' : 'w-0'}`} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootScreen;
