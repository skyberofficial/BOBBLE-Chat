'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function FloatingBubbles() {
    const [bubbles, setBubbles] = useState<{ id: number; left: number; size: number; delay: number; duration: number }[]>([]);

    useEffect(() => {
        // Generate static bubbles to avoid hydration mismatch
        const newBubbles = Array.from({ length: 15 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100, // 0-100%
            size: Math.random() * 60 + 20, // 20-80px
            delay: Math.random() * 5, // 0-5s delay
            duration: Math.random() * 10 + 10, // 10-20s duration
        }));
        setBubbles(newBubbles);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {bubbles.map((bubble) => (
                <div
                    key={bubble.id}
                    className="absolute bottom-[-100px] rounded-full bg-primary/5 dark:bg-primary/10 backdrop-blur-sm"
                    style={{
                        left: `${bubble.left}%`,
                        width: `${bubble.size}px`,
                        height: `${bubble.size}px`,
                        animation: `float ${bubble.duration}s linear infinite`,
                        animationDelay: `${bubble.delay}s`,
                    }}
                />
            ))}
            <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
        </div>
    );
}
