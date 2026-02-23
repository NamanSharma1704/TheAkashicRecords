import React from 'react';
import { Theme } from '../../core/types';

const GalaxyNebula: React.FC<{ theme: Theme }> = ({ theme }) => {
    if (theme.isDark) {
        return (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#020202]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#050510] via-[#020202] to-[#0a0510]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            </div>
        );
    }
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-50">
            <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f0f4f8] to-[#e2e8f0]" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-multiply"></div>
        </div>
    )
};

export default GalaxyNebula;
