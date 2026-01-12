'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signup, checkUsername, checkEmail } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Eye, EyeOff, Loader2, CheckCircle2, XCircle, UserPlus, Mail, User, Lock, Fingerprint, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateUserCode } from '@/lib/data';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

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
          Creating...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Join BobbleChat
        </span>
      )}
    </Button>
  );
}

type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

const generateCaptcha = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let captcha = '';
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return captcha;
};

export function SignUpForm() {
  const [state, formAction] = useActionState(signup, undefined);
  const [captcha, setCaptcha] = useState('');
  const [preGeneratedId, setPreGeneratedId] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const debouncedUsername = useDebounce(username, 500);
  const debouncedEmail = useDebounce(email, 500);

  const [usernameStatus, setUsernameStatus] = useState<ValidationStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<ValidationStatus>('idle');

  const [isCheckingUsername, startUsernameCheck] = useTransition();
  const [isCheckingEmail, startEmailCheck] = useTransition();

  useEffect(() => {
    if (debouncedUsername.length > 2) {
      setUsernameStatus('checking');
      startUsernameCheck(async () => {
        const { isAvailable } = await checkUsername(debouncedUsername);
        setUsernameStatus(isAvailable ? 'valid' : 'invalid');
      });
    } else {
      setUsernameStatus('idle');
    }
  }, [debouncedUsername]);

  useEffect(() => {
    if (debouncedEmail.includes('@') && debouncedEmail.includes('.')) {
      setEmailStatus('checking');
      startEmailCheck(async () => {
        const { isAvailable } = await checkEmail(debouncedEmail);
        setEmailStatus(isAvailable ? 'valid' : 'invalid');
      });
    } else {
      setEmailStatus('idle');
    }
  }, [debouncedEmail]);


  useEffect(() => {
    setCaptcha(generateCaptcha());
    setPreGeneratedId(generateUserCode());
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Your unique 10-digit User ID has been copied to the clipboard.",
    });
  };

  const getStatusColor = (status: ValidationStatus) => {
    if (status === 'invalid') return 'border-destructive ring-destructive/20 ring-4';
    if (status === 'valid') return 'border-green-500 ring-green-500/10 ring-4';
    return 'border-primary/10';
  }


  return (
    <div className="w-full flex justify-center px-4">
      <form action={formAction} className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <input type="hidden" name="userCode" value={preGeneratedId} />
        <Card className="w-full bg-white/80 dark:bg-neutral-950/90 backdrop-blur-2xl border-primary/20 shadow-[0_20px_50px_rgba(135,206,235,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500">
          <CardHeader className="p-6 md:p-8 space-y-2 border-b border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
            <CardTitle className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Create Account</CardTitle>
            <CardDescription className="text-sm md:text-base font-medium text-muted-foreground/80">Connect instantly with a unique identity.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Full Name</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter your full name"
                    className="h-12 md:h-13 pl-10 bg-background/40 border-primary/15 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all rounded-xl"
                    required
                  />
                </div>
                {state?.errors?.name && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.name[0]}</p>}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Username</Label>
                <div className="relative group">
                  <Input
                    id="username"
                    name="username"
                    placeholder="choose_a_username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={cn(
                      'h-12 md:h-13 bg-background/40 pr-10 border-primary/15 focus:border-primary focus:ring-4 transition-all rounded-xl',
                      getStatusColor(usernameStatus)
                    )}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center justify-center pr-3 w-10">
                    {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {usernameStatus === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" />}
                    {usernameStatus === 'invalid' && <XCircle className="h-5 w-5 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />}
                  </div>
                </div>
                {state?.errors?.username && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.username[0]}</p>}
                {usernameStatus === 'invalid' && <p className="text-[11px] font-bold text-destructive ml-1">Username is already taken</p>}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Email Address</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      'h-12 md:h-13 bg-background/40 pl-10 pr-10 border-primary/15 focus:border-primary focus:ring-4 transition-all rounded-xl',
                      getStatusColor(emailStatus)
                    )}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center justify-center pr-3 w-10">
                    {emailStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {emailStatus === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" />}
                    {emailStatus === 'invalid' && <XCircle className="h-5 w-5 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />}
                  </div>
                </div>
                {state?.errors?.email && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.email[0]}</p>}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="password" title="At least 8 characters" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Secret Password</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    placeholder="••••••••••••"
                    required
                    className="h-12 md:h-13 bg-background/40 pl-10 pr-12 border-primary/15 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full w-12 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {state?.errors?.password && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.password[0]}</p>}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/5 border border-primary/20 relative overflow-hidden group hover:border-primary/40 transition-all duration-300">
              <div className="absolute top-0 right-0 p-3 text-primary/10 transition-transform group-hover:scale-110">
                <Fingerprint className="h-12 w-12" />
              </div>
              <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 mb-2 block">Your Unique Passport (10-Digit ID)</Label>
              <div className="flex items-center gap-3">
                <code className="text-2xl md:text-3xl font-black text-primary tracking-tighter drop-shadow-sm font-mono">{preGeneratedId}</code>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => copyToClipboard(preGeneratedId)}
                  className="h-auto p-0 text-primary hover:text-blue-600 font-bold flex items-center gap-1.5 no-underline hover:underline transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy ID
                </Button>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground mt-2 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-primary/40"></span>
                Save this code carefully—it's how friends find you.
              </p>
            </div>

            <div className="space-y-4 p-5 rounded-2xl bg-background/40 border border-primary/10">
              <Label htmlFor="captcha" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">Human Verification</Label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-center py-3 font-mono text-2xl tracking-[0.5em] select-none text-primary/60 italic skew-x-[-12deg] shadow-inner">
                  {captcha}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCaptcha(generateCaptcha())}
                  className="rounded-full hover:bg-primary/10 text-primary"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
                <Input
                  id="captcha"
                  name="captcha"
                  placeholder="Type CAPTCHA"
                  required
                  className="h-12 w-full sm:w-40 bg-background/40 border-primary/15 focus:border-primary rounded-xl text-center font-mono font-bold"
                />
                <input type="hidden" name="original_captcha" value={captcha} />
              </div>
              {state?.errors?.captcha && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.captcha[0]}</p>}
            </div>

            <div className="flex items-center space-x-3 p-2">
              <Checkbox id="terms" name="terms" className="h-5 w-5 rounded-md border-primary/20 data-[state=checked]:bg-primary transition-all" required />
              <Label
                htmlFor="terms"
                className="text-sm font-medium leading-none text-muted-foreground cursor-pointer select-none"
              >
                I accept the <a href="#" className="text-primary font-bold hover:underline transition-all">Terms of Service</a> and <a href="#" className="text-primary font-bold hover:underline transition-all">Privacy Policy</a>
              </Label>
            </div>
            {state?.errors?.terms && <p className="text-[11px] font-bold text-destructive ml-1">{state.errors.terms[0]}</p>}

            {state?.message && !state?.errors && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl animate-shake">
                <AlertDescription className="text-xs font-bold">{state.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="p-6 md:p-8 pt-0 flex flex-col gap-6">
            <SubmitButton />
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
            <p className="text-center text-sm font-medium text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-black text-primary hover:text-blue-600 hover:underline transition-all">
                Sign in now
              </Link>
            </p>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
