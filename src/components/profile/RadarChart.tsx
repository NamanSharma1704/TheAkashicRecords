import React from 'react';
import { motion } from 'motion/react';
import { Theme } from '../../core/types';

interface RadarChartProps {
    data: { label: string; value: number }[]; // value 0 to 100
    theme: Theme;
    className?: string;
}

const RadarChart: React.FC<RadarChartProps> = ({ data, theme, className = "" }) => {
    const size = 280;
    const center = size / 2;
    const radius = size * 0.4; // leave room for labels
    
    const numSides = data.length || 5;
    const angleStep = (Math.PI * 2) / numSides;
    const offset = -Math.PI / 2; // Start from top

    const points = data.map((d, i) => {
        const val = Math.max(0, Math.min(100, d.value));
        const rCurrent = (val / 100) * radius;
        const x = center + rCurrent * Math.cos(offset + i * angleStep);
        const y = center + rCurrent * Math.sin(offset + i * angleStep);
        
        const outerX = center + (radius + 20) * Math.cos(offset + i * angleStep);
        const outerY = center + (radius + 20) * Math.sin(offset + i * angleStep);
        
        return { x, y, outerX, outerY, label: d.label, val };
    });

    const polygonPath = points.map(p => `${p.x},${p.y}`).join(' ');
    
    // Background web paths
    const levels = [0.25, 0.5, 0.75, 1];
    const webPaths = levels.map(level => {
        const rCurrent = level * radius;
        return data.map((_, i) => `${center + rCurrent * Math.cos(offset + i * angleStep)},${center + rCurrent * Math.sin(offset + i * angleStep)}`).join(' ');
    });

    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Axes */}
                {data.map((_, i) => (
                    <line 
                        key={`axis-${i}`}
                        x1={center} 
                        y1={center} 
                        x2={center + radius * Math.cos(offset + i * angleStep)} 
                        y2={center + radius * Math.sin(offset + i * angleStep)} 
                        stroke={theme.isDark ? "rgb(255 255 255 / 0.1)" : "rgb(0 0 0 / 0.1)"}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Webs */}
                {webPaths.map((path, i) => (
                    <polygon 
                        key={`web-${i}`}
                        points={path} 
                        fill="none" 
                        stroke={theme.isDark ? "rgb(255 255 255 / 0.1)" : "rgb(0 0 0 / 0.1)"}
                        strokeWidth="1"
                    />
                ))}

                {/* Filled Status Polygon */}
                <motion.polygon
                    points={polygonPath}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 40,
                        damping: 10,
                        delay: 0.2
                    }}
                    style={{ transformOrigin: 'center' }}
                    fill={theme.id === 'LIGHT' ? '#0ea5e9' : '#f59e0b'}
                />

                {/* Polygon Border */}
                <motion.polygon
                    points={polygonPath}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                    fill="none"
                    stroke={theme.id === 'LIGHT' ? '#0ea5e9' : '#f59e0b'}
                    strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 8px ${theme.id === 'LIGHT' ? '#0ea5e9' : '#f59e0b'})` }}
                />

                {/* Points */}
                {points.map((p, i) => (
                    <motion.circle
                        key={`pt-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill={theme.isDark ? '#fff' : '#000'}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                    />
                ))}
            </svg>

            {/* Labels overlay */}
            {points.map((p, i) => {
                // Adjust label positions manually roughly
                const isLeft = Math.cos(offset + i * angleStep) < -0.1;
                const isRight = Math.cos(offset + i * angleStep) > 0.1;
                const isTop = Math.sin(offset + i * angleStep) < -0.1;
                
                return (
                    <motion.div
                        key={`label-${i}`}
                        className={`absolute flex flex-col font-mono uppercase tracking-[0.2em] transition-colors duration-700`}
                        style={{
                            left: p.outerX,
                            top: p.outerY,
                            transform: `translate(${isLeft ? '-100%' : isRight ? '0%' : '-50%'}, ${isTop ? '-100%' : '0%'})`
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 + i * 0.1 }}
                    >
                        <span className={`text-[9px] sm:text-[10px] ${theme.mutedText} font-bold text-center`}>{p.label}</span>
                        <span className={`text-[10px] sm:text-[11px] ${theme.headingText} font-orbitron text-center`}>{p.val.toFixed(0)}</span>
                    </motion.div>
                );
            })}
        </div>
    );
};

export default RadarChart;
