'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
    onCapture: (blob: Blob) => void;
    onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isFrontCamera, setIsFrontCamera] = useState(false);

    const activeStreamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        // Stop any existing tracks before starting a new one
        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach(track => track.stop());
            activeStreamRef.current = null;
        }

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: isFrontCamera ? 'user' : 'environment' },
                audio: false
            });
            activeStreamRef.current = newStream;
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (error) {
            console.error("Camera access failed:", error);
            alert("Could not access camera. Please check permissions.");
            onClose();
        }
    };

    useEffect(() => {
        startCamera();
        // The cleanup function now uses the ref to ensure it always stops the correct stream
        return () => {
            if (activeStreamRef.current) {
                activeStreamRef.current.getTracks().forEach(track => track.stop());
                activeStreamRef.current = null;
            }
        };
    }, [isFrontCamera]);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Flip horizontally if using front camera
                if (isFrontCamera) {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL('image/webp');
                setCapturedImage(dataUrl);
            }
        }
    };

    const confirmCapture = () => {
        if (capturedImage && canvasRef.current) {
            // Stop camera immediately for better UX
            if (activeStreamRef.current) {
                activeStreamRef.current.getTracks().forEach(track => track.stop());
                activeStreamRef.current = null;
            }

            canvasRef.current.toBlob((blob) => {
                if (blob) {
                    onCapture(blob);
                }
            }, 'image/webp', 0.8);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center">
            <div className="absolute top-6 right-6 z-20">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
                    <X className="h-6 w-6" />
                </Button>
            </div>

            <div className="relative w-full max-w-2xl aspect-[3/4] md:aspect-video bg-neutral-900 overflow-hidden md:rounded-3xl border border-white/10 shadow-2xl">
                {!capturedImage ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn("w-full h-full object-cover", isFrontCamera && "scale-x-[-1]")}
                    />
                ) : (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                )}

                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 px-6">
                    {!capturedImage ? (
                        <>
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full h-12 w-12 border-white/20 bg-white/10 text-white"
                                onClick={() => setIsFrontCamera(!isFrontCamera)}
                            >
                                <RefreshCw className="h-5 w-5" />
                            </Button>

                            <button
                                onClick={capturePhoto}
                                className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <div className="h-12 w-12 rounded-full bg-white" />
                            </button>

                            <div className="w-12" /> {/* Spacer */}
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                className="rounded-full px-6 bg-white/10 border-white/20 text-white"
                                onClick={() => setCapturedImage(null)}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" /> Retake
                            </Button>

                            <Button
                                className="rounded-full px-8 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
                                onClick={confirmCapture}
                            >
                                <Check className="mr-2 h-4 w-4" /> Use Photo
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <p className="mt-6 text-white/60 text-sm font-medium">
                {!capturedImage ? "Smile and capture!" : "Ready to send?"}
            </p>
        </div>
    );
}
