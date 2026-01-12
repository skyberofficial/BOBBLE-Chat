'use client';

import Link from 'next/link';
import { Github, Twitter, Globe, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full py-6 mt-auto">
            <div className="container mx-auto px-4 flex flex-col items-center gap-4">
                <div className="flex items-center gap-6">
                    <Link
                        href="#"
                        className="text-muted-foreground hover:text-primary transition-colors duration-200"
                        aria-label="Twitter"
                    >
                        <Twitter className="h-5 w-5" />
                    </Link>
                    <Link
                        href="#"
                        className="text-muted-foreground hover:text-primary transition-colors duration-200"
                        aria-label="GitHub"
                    >
                        <Github className="h-5 w-5" />
                    </Link>
                    <Link
                        href="#"
                        className="text-muted-foreground hover:text-primary transition-colors duration-200"
                        aria-label="Website"
                    >
                        <Globe className="h-5 w-5" />
                    </Link>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        Made with <Heart className="h-3.5 w-3.5 text-destructive fill-destructive" /> by
                        <span className="text-primary font-bold">BobbleChat Team</span>
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        © {currentYear} BobbleChat • All Rights Reserved
                    </p>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">
                    <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                    <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                    <Link href="#" className="hover:text-primary transition-colors">Help Center</Link>
                </div>
            </div>
        </footer>
    );
}
