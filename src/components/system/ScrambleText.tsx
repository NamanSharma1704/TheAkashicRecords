import React, { useState, useEffect, useRef } from 'react';

interface ScrambleTextProps {
    text: string;
    className?: string;
    speed?: number;
    revealSpeed?: number;
    animatedGradient?: boolean;
    gradientColors?: string;
}

const ScrambleText: React.FC<ScrambleTextProps> = ({
    text,
    className,
    speed = 50,
    revealSpeed = 0.33,
    animatedGradient = false,
    gradientColors
}) => {
    const [display, setDisplay] = useState(text);
    const intervalRef = useRef<ReturnType<typeof setInterval>>();
    useEffect(() => {
        if (display === text) return;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
        let iterations = 0;

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setDisplay(text.split('').map((char, index) => {
                if (char === ' ') return ' ';
                if (index < Math.floor(iterations)) return char;
                return chars[Math.floor(Math.random() * chars.length)];
            }).join(''));

            if (iterations >= text.length) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setDisplay(text);
            }
            iterations += revealSpeed;
        }, 60); // Standardized to 60ms for smoother frame budget

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
        // `display` is read on line 23 but must NOT be a dependency: it changes on every
        // 60ms tick, so listing it would tear down and restart the interval each frame and
        // the text would never finish resolving. The guard is meant to compare against the
        // value as it stood when `text` changed, which is exactly what excluding it gives.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, speed, revealSpeed]);
    const gradientClass = animatedGradient ? `bg-gradient-to-r ${gradientColors} bg-[200%_auto] animate-text-shimmer bg-clip-text text-transparent` : "";
    return (<span className={`${className} ${gradientClass} font-mono cursor-default inline break-words`}>{display}</span>);
};

export default React.memo(ScrambleText);
