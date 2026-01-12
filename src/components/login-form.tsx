'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { login } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, User, Lock, Loader2, Fingerprint } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full h-12 md:h-14 text-base font-bold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Signing In...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          Sign In
        </span>
      )}
    </Button>
  );
}

const placeholderTexts = ["Username", "Email", "10-digit ID"];

export function LoginForm() {
  const [state, formAction] = useActionState(login, undefined);
  const [placeholder, setPlaceholder] = useState(placeholderTexts[0]);
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const type = () => {
      const currentText = placeholderTexts[textIndex];
      if (isDeleting) {
        if (charIndex > 0) {
          setPlaceholder(currentText.substring(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % placeholderTexts.length);
        }
      } else {
        if (charIndex < currentText.length) {
          setPlaceholder(currentText.substring(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      }
    };

    const timeoutId = setTimeout(type, isDeleting ? 60 : 100);
    return () => clearTimeout(timeoutId);
  }, [charIndex, isDeleting, textIndex]);


  return (
    <div className="w-full flex justify-center px-4">
      <form action={formAction} className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
        <Card className="w-full bg-white/80 dark:bg-neutral-950/90 backdrop-blur-2xl border-primary/20 shadow-[0_20px_50px_rgba(135,206,235,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500">
          <CardHeader className="p-6 md:p-8 space-y-2 border-b border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
            <CardTitle className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Welcome Back</CardTitle>
            <CardDescription className="text-sm md:text-base font-medium text-muted-foreground/80">Enter your credentials to access BobbleChat.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Identity</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    placeholder={placeholder}
                    className="h-12 md:h-13 pl-10 bg-background/40 border-primary/15 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all rounded-xl"
                    required
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-20">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="password text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Password</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••••••"
                    className="h-12 md:h-13 pl-10 bg-background/40 border-primary/15 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all rounded-xl"
                    required
                  />
                </div>
                {state?.errors?.password && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.password[0]}</p>}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="remember" name="remember" className="data-[state=checked]:bg-primary border-primary/20" />
                <Label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground select-none group-hover:text-foreground transition-colors"
                >
                  Remember me for 7 days
                </Label>
              </div>
            </div>
            {state?.message && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl animate-shake">
                <AlertDescription className="text-xs font-bold">{state.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="p-6 md:p-8 pt-0 flex flex-col gap-6">
            <SubmitButton />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
            <p className="text-center text-sm font-medium text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-black text-primary hover:text-blue-600 hover:underline transition-all">
                Create Account
              </Link>
            </p>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
