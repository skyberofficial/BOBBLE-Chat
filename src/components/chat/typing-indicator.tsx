'use client';

import React from 'react';

export function TypingIndicator() {
    return (
        <div className="flex items-end gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-muted text-foreground border border-border/50 rounded-2xl px-4 py-3 shadow-sm relative">
                <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                </div>

                {/* Tail bubbles to match the user's image */}
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-muted border border-border/50 rounded-full" />
                <div className="absolute -bottom-2 -left-2 w-1.5 h-1.5 bg-muted border border-border/50 rounded-full opacity-70" />
            </div>
        </div>
    );
}
