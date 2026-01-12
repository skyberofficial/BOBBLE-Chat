'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceIntensityProps {
    stream: MediaStream | null;
    isMuted?: boolean;
    className?: string;
}

export function VoiceIntensity({ stream, isMuted, className }: VoiceIntensityProps) {
    const [intensity, setIntensity] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!stream || isMuted) {
            setIntensity(0);
            return;
        }

        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const updateIntensity = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                // Normalize to 0-100 (approximately)
                setIntensity(Math.min(100, Math.floor(average * 2)));

                animationFrameRef.current = requestAnimationFrame(updateIntensity);
            };

            updateIntensity();
        } catch (error) {
            console.error("Error initializing audio context:", error);
        }

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, [stream, isMuted]);

    return (
        <div className={cn("flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10", className)}>
            <Volume2 className={cn(
                "h-4 w-4 transition-colors duration-300",
                intensity > 10 ? "text-primary" : "text-white/60"
            )} />
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-75 ease-out rounded-full"
                    style={{ width: `${intensity}%` }}
                />
            </div>
        </div>
    );
}
