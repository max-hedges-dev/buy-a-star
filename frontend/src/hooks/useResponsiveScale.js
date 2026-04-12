import { useEffect, useMemo, useState } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const useResponsiveScale = ({
    baseWidth = 1440,
    baseHeight = 920,
    min = 0.74,
    max = 1.04,
    compactWidth = 900,
} = {}) => {
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : baseWidth,
        height: typeof window !== 'undefined' ? window.innerHeight : baseHeight,
    }));

    useEffect(() => {
        const handleResize = () => setViewportSize({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return useMemo(() => {
        const scale = clamp(Math.min(viewportSize.width / baseWidth, viewportSize.height / baseHeight), min, max);
        return {
            viewportWidth: viewportSize.width,
            viewportHeight: viewportSize.height,
            scale,
            isCompact: viewportSize.width < compactWidth,
            isNarrow: viewportSize.width < 680,
            px: (value) => Math.round(value * scale),
        };
    }, [baseHeight, baseWidth, compactWidth, max, min, viewportSize.height, viewportSize.width]);
};

export default useResponsiveScale;
