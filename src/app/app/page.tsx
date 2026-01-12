import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Coffee, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AppWelcomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
      <div className="space-y-8 max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-24 w-24 bg-primary/5 rounded-full flex items-center justify-center animate-pulse">
            <Logo className="h-12 w-12" showText={false} variant="square" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight text-foreground/90">
            Welcome to <span className="text-primary">BobbleChat</span>
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed font-medium">
            Select a friend from the sidebar or search for a new user to start a conversation.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-xs font-bold text-muted-foreground/70 uppercase tracking-[0.2em]">
            <div className="p-5 rounded-3xl border border-primary/10 bg-primary/5 backdrop-blur-sm transition-all hover:bg-primary/10">
              <p className="flex items-center justify-center gap-2">🔒 End-to-End</p>
            </div>
            <div className="p-5 rounded-3xl border border-primary/10 bg-primary/5 backdrop-blur-sm transition-all hover:bg-primary/10">
              <p className="flex items-center justify-center gap-2">⚡ Real-time</p>
            </div>
          </div>

          <div className="pt-2">
            <Link href="https://rzp.io/rzp/bobblechat" target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                className="w-full h-14 rounded-3xl border-primary/20 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xl hover:bg-primary/5 hover:border-primary/40 transition-all duration-500 group overflow-hidden relative animate-aurora"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <Coffee className="h-5 w-5 mr-3 text-orange-500 transition-transform group-hover:scale-110 group-hover:rotate-12" />
                <span className="font-black uppercase tracking-[0.15em] text-[11px]">Buy me a coffee</span>
                <ExternalLink className="h-3 w-3 ml-2 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
