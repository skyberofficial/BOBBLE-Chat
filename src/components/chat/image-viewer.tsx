'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, X, Download } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ImageViewerProps {
    src: string;
    isOpen: boolean;
    onClose: () => void;
    onDownload?: () => void;
}

export function ImageViewer({ src, isOpen, onClose, onDownload }: ImageViewerProps) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom limits
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 5;

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, MAX_SCALE));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, MIN_SCALE));
    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // Zoom on wheel
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!isOpen) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(prev => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => container?.removeEventListener('wheel', handleWheel);
    }, [isOpen]);

    // Pan logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale <= 1) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || scale <= 1) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }, [isDragging, dragStart, scale]);

    const handleMouseUp = () => setIsDragging(false);

    // Touch logic for pinch-to-zoom
    const touchStartRef = useRef<{ dist: number; scale: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchStartRef.current = { dist, scale };
        } else if (e.touches.length === 1 && scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStartRef.current) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = dist / touchStartRef.current.dist;
            setScale(Math.min(Math.max(touchStartRef.current.scale * ratio, MIN_SCALE), MAX_SCALE));
        } else if (e.touches.length === 1 && isDragging) {
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
            });
        }
    };

    const handleTouchEnd = () => {
        touchStartRef.current = null;
        setIsDragging(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[100vw] h-[100dvh] p-0 border-none bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center overflow-hidden">
                <DialogHeader className="absolute top-0 left-0 right-0 z-50 p-4 border-none flex flex-row items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
                    <DialogTitle className="text-white font-bold tracking-tight flex items-center gap-2">
                        Image Preview
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        {onDownload && (
                            <Button variant="ghost" size="icon" onClick={onDownload} className="text-white hover:bg-white/10 rounded-full h-10 w-10">
                                <Download className="h-5 w-5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full h-10 w-10">
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </DialogHeader>

                <div
                    ref={containerRef}
                    className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <img
                        ref={imgRef}
                        src={src}
                        alt="Preview"
                        draggable={false}
                        className={cn(
                            "max-w-full max-h-full transition-transform duration-75 ease-out select-none",
                            !isDragging && "duration-200"
                        )}
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                        }}
                    />
                </div>

                <div className="absolute bottom-10 z-50 flex items-center gap-4 p-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl animate-in slide-in-from-bottom-5 duration-500">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= MIN_SCALE} className="text-white hover:bg-white/10 hover:text-primary rounded-xl">
                        <ZoomOut className="h-5 w-5" />
                    </Button>
                    <div className="w-12 text-center text-[10px] font-black tracking-widest text-white/70 uppercase">
                        {Math.round(scale * 100)}%
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= MAX_SCALE} className="text-white hover:bg-white/10 hover:text-primary rounded-xl">
                        <ZoomIn className="h-5 w-5" />
                    </Button>
                    <div className="w-px h-6 bg-white/10" />
                    <Button variant="ghost" size="icon" onClick={handleReset} className="text-white hover:bg-white/10 hover:text-primary rounded-xl">
                        <RotateCcw className="h-5 w-5" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
