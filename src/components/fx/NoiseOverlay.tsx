import React, { useEffect, useState } from 'react';

const NoiseOverlay: React.FC = () => {
    const [noiseUrl, setNoiseUrl] = useState<string>('');

    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const val = Math.floor(Math.random() * 255);
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
            data[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        setNoiseUrl(canvas.toDataURL());
    }, []);

    return (
        <div
            className="fixed inset-0 pointer-events-none z-[50] opacity-[0.035] mix-blend-overlay"
            style={{
                backgroundImage: noiseUrl ? `url(${noiseUrl})` : 'none',
                backgroundRepeat: 'repeat'
            }}
        />
    );
};

export default NoiseOverlay;
