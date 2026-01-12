'use client';

import { useEffect, useState, useTransition, ChangeEvent } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Upload, Menu, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { updateUserProfile, checkUsername } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { FloatingBubbles } from '@/components/ui/floating-bubbles';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

async function fetchClientUser() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch (e) {
    return null;
  }
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  avatar: z.string().optional().or(z.literal('')),
  bio: z.string().max(1500, 'Bio must be 1500 characters or less').optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export default function ProfilePage({ onMenuClick }: { onMenuClick?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [username, setUsername] = useState('');
  const debouncedUsername = useDebounce(username, 500);
  const [usernameStatus, setUsernameStatus] = useState<ValidationStatus>('idle');
  const [isCheckingUsername, startUsernameCheck] = useTransition();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      username: '',
      avatar: '',
      bio: '',
      newPassword: '',
    },
  });

  useEffect(() => {
    async function fetchUser() {
      const authUser = await fetchClientUser();
      if (authUser) {
        setUser(authUser);
        form.reset({
          name: authUser.name,
          username: authUser.username,
          avatar: authUser.avatar,
          bio: authUser.bio || '',
          newPassword: '',
        });
        setUsername(authUser.username);
      }
    }
    fetchUser();
  }, [form]);

  useEffect(() => {
    if (debouncedUsername && user && debouncedUsername !== user.username) {
      setUsernameStatus('checking');
      startUsernameCheck(async () => {
        const { isAvailable } = await checkUsername(debouncedUsername);
        setUsernameStatus(isAvailable ? 'valid' : 'invalid');
      });
    } else {
      setUsernameStatus('idle');
    }
  }, [debouncedUsername, user]);

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('avatar', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      if (!user) return;
      if (usernameStatus === 'invalid') {
        toast({ variant: 'destructive', title: 'Username is already taken.' });
        return;
      }
      const result = await updateUserProfile(user.id, data);
      if (result.success && result.user) {
        setUser(result.user);
        form.reset({
          ...result.user,
          newPassword: '',
        });
        toast({ title: 'Profile Updated!', description: 'Your profile has been successfully updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: result.message });
      }
    });
  };

  const getStatusColor = (status: ValidationStatus) => {
    if (status === 'invalid') return 'border-destructive text-destructive';
    if (status === 'valid') return 'border-green-500 text-green-600';
    return '';
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Syncing Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-sm overflow-hidden relative">
      <FloatingBubbles />

      {/* Header */}
      <div className="p-3 md:p-4 border-b flex items-center justify-between bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl sticky top-0 z-40 w-full">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="md:hidden flex h-9 w-9 rounded-full bg-primary/5 text-primary hover:bg-primary/10">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Link href="/app">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg md:text-xl tracking-tight">Profile Settings</h1>
        </div>
        <div className="hidden sm:flex items-center px-3 py-1 bg-green-500/10 text-green-600 rounded-full border border-green-500/20 gap-2">
          <Shield className="h-3 w-3" />
          <span className="text-[10px] font-black uppercase tracking-widest">Secure View</span>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full">
        <div className="flex items-start justify-center p-4 md:p-8 min-h-full">
          <Card className="w-full max-w-2xl bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border-primary/10 shadow-2xl relative z-10 transition-all hover:shadow-primary/5 pb-8">
            <CardHeader className="pb-0">
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-3xl mb-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-white dark:border-neutral-800 shadow-xl ring-4 ring-primary/10 transition-transform group-hover:scale-105 duration-300">
                      <AvatarImage src={form.getValues('avatar') || user.avatar} alt={user.name} />
                      <AvatarFallback className="text-3xl bg-primary/20 text-primary font-bold">{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-2.5 cursor-pointer hover:bg-primary/90 shadow-lg transition-all hover:scale-110 active:scale-95 z-20">
                      <Upload className="h-5 w-5" />
                      <input id="avatar-upload" type="file" className="sr-only" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                  </div>
                  <div className="text-center md:text-left space-y-2">
                    <h2 className="text-2xl font-black tracking-tight">{user.name}</h2>
                    <p className="text-primary font-mono font-bold text-sm bg-primary/5 px-3 py-1 rounded-full inline-block border border-primary/10">ID: {user.userCode}</p>
                    <p className="text-muted-foreground text-xs font-medium">@{user.username}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Name" className="h-12 bg-background/50 border-primary/10 focus:border-primary/30 rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Username</FormLabel>
                          <div className="relative group">
                            <FormControl>
                              <Input
                                placeholder="your_username"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setUsername(e.target.value);
                                }}
                                className={cn(
                                  'h-12 bg-background/50 border-primary/10 focus:border-primary/30 rounded-xl pr-12 transition-all',
                                  getStatusColor(usernameStatus)
                                )}
                              />
                            </FormControl>
                            <div className="absolute inset-y-0 right-0 flex items-center justify-center pr-3 w-12">
                              {usernameStatus === 'checking' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                              {usernameStatus === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in-50 duration-300" />}
                              {usernameStatus === 'invalid' && <XCircle className="h-5 w-5 text-destructive animate-in shake duration-300" />}
                            </div>
                          </div>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                    <Input readOnly disabled value={user.email} className="h-12 bg-muted/30 border-primary/5 rounded-xl font-medium opacity-60 cursor-not-allowed" />
                    <p className="text-[10px] text-muted-foreground/60 italic ml-1">Email cannot be changed for security reasons.</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Bio / Status</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us a little bit about yourself"
                            className="min-h-[120px] bg-background/50 border-primary/10 focus:border-primary/30 rounded-2xl resize-none p-4"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Change Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" className="h-12 bg-background/50 border-primary/10 focus:border-primary/30 rounded-xl" {...field} />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground/60 ml-1">Leave blank to keep your current password.</p>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4">
                    <Button type="submit" className="w-full h-14 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-95 gap-3" disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <span>Update Profile</span>
                          <CheckCircle2 className="h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
