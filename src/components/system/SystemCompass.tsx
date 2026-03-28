import React from 'react';
import { motion } from 'framer-motion';
import { Theme } from '../../core/types';

interface SystemCompassProps {
  theme: Theme;
}

/**
 * SystemCompass — Precision navigation element for the Akashic Records HUD.
 *
 * Design language:
 *  - Corner bracket ornaments (matches SystemFrame / holographic-panel style)
 *  - Orbitron font — same as h1/logo throughout the app
 *  - Amber  (#f59e0b) on dark / Cyan (#06b6d4) on light  
 *  - Tick ring + N / E / S / W cardinal marks
 *  - Scanline grid inside face
 *  - Diamond needle with north glow
 *  - Slow rotating sweep arc
 */
const SystemCompass: React.FC<SystemCompassProps> = ({ theme }) => {
  const isDark = theme.isDark;
  const col   = isDark ? '#f59e0b' : '#06b6d4';
  const col2  = isDark ? '#fbbf24' : '#22d3ee';
  const dim   = (a: number) =>
    isDark ? `rgba(245,158,11,${a})` : `rgba(6,182,212,${a})`;

  const SIZE     = 72;
  const CX       = 36;
  const CY       = 36;
  const R_OUTER  = 34;
  const R_RING1  = 27;
  const R_RING2  = 20;
  const R_FACE   = 16;

  const cardinals: Record<number, string> = { 0: 'N', 6: 'E', 12: 'S', 18: 'W' };

  // Sweep arc path (60° sector)
  const sweepAngle = Math.PI / 3;
  const sx1 = CX;
  const sy1 = CY - R_FACE;
  const sx2 = CX + R_FACE * Math.sin(sweepAngle);
  const sy2 = CY - R_FACE * Math.cos(sweepAngle);
  const sweepPath = `M ${CX} ${CY} L ${sx1} ${sy1} A ${R_FACE} ${R_FACE} 0 0 1 ${sx2} ${sy2} Z`;

  return (
    <div
      style={{ width: SIZE, height: SIZE, position: 'relative', flexShrink: 0 }}
      aria-label="Navigation system"
    >
      {/* Ambient pulse glow behind the whole element */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: 1,
          background: `radial-gradient(circle, ${dim(0.2)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>
          {/* Scanline micro-grid */}
          <pattern id="akGrid" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="4" y2="0" stroke={dim(0.09)} strokeWidth="0.4" />
            <line x1="0" y1="0" x2="0" y2="4" stroke={dim(0.06)} strokeWidth="0.4" />
          </pattern>

          {/* Face bg — deep void */}
          <radialGradient id="akFaceBg" cx="38%" cy="35%" r="75%">
            <stop offset="0%"   stopColor={isDark ? '#120d02' : '#001219'} />
            <stop offset="100%" stopColor={isDark ? '#020202' : '#000b12'} />
          </radialGradient>

          {/* Sweep sector */}
          <radialGradient id="akSweep" cx="0%" cy="0%" r="100%">
            <stop offset="0%"   stopColor={col} stopOpacity="0.0"  />
            <stop offset="70%"  stopColor={col} stopOpacity="0.08" />
            <stop offset="100%" stopColor={col} stopOpacity="0.22" />
          </radialGradient>

          {/* North needle gradient */}
          <linearGradient id="akNeedle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={col}   stopOpacity="0.55" />
            <stop offset="50%"  stopColor="white" stopOpacity="1.0" />
            <stop offset="100%" stopColor={col}   stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* ── CORNER BRACKETS (SystemFrame style) ── */}
        {/* These are the small L-shaped corner marks used system-wide */}
        <polyline points="1,9 1,1 9,1"           fill="none" stroke={dim(0.65)} strokeWidth="1.5" />
        <polyline points="63,1 71,1 71,9"         fill="none" stroke={dim(0.65)} strokeWidth="1.5" />
        <polyline points="1,63 1,71 9,71"         fill="none" stroke={dim(0.65)} strokeWidth="1.5" />
        <polyline points="71,63 71,71 63,71"      fill="none" stroke={dim(0.65)} strokeWidth="1.5" />

        {/* ── OUTER BOX EDGE (very subtle) ── */}
        <rect x="1" y="1" width="70" height="70" fill="none" stroke={dim(0.1)} strokeWidth="0.5" />

        {/* ── TICK RING ── */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle   = (i / 24) * 2 * Math.PI - Math.PI / 2;
          const isCard  = i % 6 === 0;
          const isMid   = i % 3 === 0 && !isCard;
          const tickLen = isCard ? 7 : (isMid ? 4 : 2.5);
          const x1 = CX + R_OUTER * Math.cos(angle);
          const y1 = CY + R_OUTER * Math.sin(angle);
          const x2 = CX + (R_OUTER - tickLen) * Math.cos(angle);
          const y2 = CY + (R_OUTER - tickLen) * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isCard ? col : dim(isCard ? 0.8 : isMid ? 0.4 : 0.2)}
              strokeWidth={isCard ? 1.4 : 0.7}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── CARDINAL LABELS ── */}
        {Object.entries(cardinals).map(([iStr, label]) => {
          const i     = Number(iStr);
          const angle = (i / 24) * 2 * Math.PI - Math.PI / 2;
          const r     = R_OUTER - 11;
          const x     = CX + r * Math.cos(angle);
          const y     = CY + r * Math.sin(angle) + 2.5;
          const isN   = label === 'N';
          return (
            <text
              key={label}
              x={x} y={y}
              textAnchor="middle"
              fontSize={isN ? 7.5 : 5.5}
              fontFamily="Orbitron, monospace"
              fontWeight="900"
              fill={isN ? col2 : dim(0.5)}
              style={isN ? { filter: `drop-shadow(0 0 3px ${col})` } : {}}
            >
              {label}
            </text>
          );
        })}

        {/* ── DASHED INNER RING (counter-rotates slowly) ── */}
        <motion.circle
          cx={CX} cy={CY} r={R_RING1}
          fill="none" stroke={dim(0.18)} strokeWidth="0.7" strokeDasharray="2 5"
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
        />

        {/* ── SOLID ACCENT RING ── */}
        <circle cx={CX} cy={CY} r={R_RING2} fill="none" stroke={dim(0.25)} strokeWidth="0.8" />

        {/* ── FACE BACKGROUND ── */}
        <circle cx={CX} cy={CY} r={R_FACE} fill="url(#akFaceBg)" />

        {/* ── SCANLINE GRID OVERLAY ── */}
        <circle cx={CX} cy={CY} r={R_FACE} fill="url(#akGrid)" />

        {/* ── CROSSHAIRS ── */}
        <line x1={CX - R_FACE + 1} y1={CY} x2={CX + R_FACE - 1} y2={CY}
              stroke={dim(0.1)} strokeWidth="0.5" />
        <line x1={CX} y1={CY - R_FACE + 1} x2={CX} y2={CY + R_FACE - 1}
              stroke={dim(0.1)} strokeWidth="0.5" />

        {/* ── FACE BORDER ── */}
        <circle cx={CX} cy={CY} r={R_FACE}
                fill="none" stroke={dim(0.5)} strokeWidth="0.9" />

        {/* ── ROTATION SWEEP ── */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        >
          <path d={sweepPath} fill="url(#akSweep)" />
        </motion.g>

        {/* ── NEEDLE ── */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ rotate: [0, 4, -3, 1.5, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* North — bright */}
          <polygon
            points={`${CX},${CY - R_FACE + 2} ${CX - 2.2},${CY + 1} ${CX},${CY + 4} ${CX + 2.2},${CY + 1}`}
            fill="url(#akNeedle)"
            style={{ filter: `drop-shadow(0 0 3px ${col})` }}
          />
          {/* South — dark */}
          <polygon
            points={`${CX},${CY + R_FACE - 2} ${CX - 1.8},${CY - 1} ${CX},${CY - 4} ${CX + 1.8},${CY - 1}`}
            fill={dim(0.18)}
          />
          {/* Centre pivot */}
          <circle cx={CX} cy={CY} r="2.8"
                  fill={col} style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
          <circle cx={CX} cy={CY} r="1.2"
                  fill={isDark ? '#020202' : '#000b12'} />
        </motion.g>

        {/* ── OUTER OUTERMOST RING ── */}
        <circle cx={CX} cy={CY} r={R_OUTER}
                fill="none" stroke={dim(0.15)} strokeWidth="0.5" />

        {/* ── LORE SUB-LABEL ── */}
        <text
          x={CX} y={SIZE - 3}
          textAnchor="middle"
          fontSize="4"
          fontFamily="Orbitron, monospace"
          fontWeight="700"
          letterSpacing="2"
          fill={dim(0.35)}
        >
          NAVI_SYS
        </text>
      </svg>
    </div>
  );
};

export default SystemCompass;
