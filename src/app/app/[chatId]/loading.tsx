'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function ChatLoading() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 bg-background/5 rounded-3xl m-2 border border-primary/5 shadow-inner">
            <div className="space-y-6 flex flex-col items-center">
                <div className="relative">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                        <Logo className="h-10 w-10" showText={false} variant="square" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-950 p-1 rounded-full shadow-lg border border-primary/20">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary/60 animate-pulse">
                        Establishing Secure Link
                    </p>
                    <h2 className="text-xl font-bold tracking-tight text-foreground/80">
                        Loading Chat...
                    </h2>
                </div>

                <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/5 border border-primary/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"></span>
                </div>
            </div>
        </div>
    );
}
