import { useEffect } from 'react';

export function useVisibleInterval(callback: () => void, delayMs: number | null) {
    useEffect(() => {
        if (delayMs === null) return;

        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            callback();
        };

        const timer = window.setInterval(tick, delayMs);
        return () => window.clearInterval(timer);
    }, [callback, delayMs]);
}
