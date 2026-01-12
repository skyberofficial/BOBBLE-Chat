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
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { updateUserProfile, checkUsername } from '@/lib/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

async function fetchClientUser() {
  const res = await fetch('/api/user');
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.user;
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

export default function ProfilePage() {
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
      setUser(authUser);
      if (authUser) {
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
        form.reset(result.user);
        toast({ title: 'Profile Updated!', description: 'Your profile has been successfully updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: result.message });
      }
    });
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const getStatusColor = (status: ValidationStatus) => {
    if (status === 'invalid') return 'border-destructive';
    if (status === 'valid') return 'border-green-500';
    return '';
  }

  return (
    <div className="flex h-full items-start justify-center bg-transparent p-4 sm:items-center">
      <Card className="w-full max-w-2xl bg-glass">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            <Link href="/app">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <CardTitle className="text-xl">Edit Your Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col items-center text-center mb-6">
                <FormField
                  control={form.control}
                  name="avatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Avatar className="mx-auto h-24 w-24 mb-4 border-2 border-primary">
                            <AvatarImage src={field.value} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <label htmlFor="avatar-upload" className="absolute bottom-4 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90">
                            <Upload className="h-4 w-4" />
                            <Input id="avatar-upload" type="file" className="sr-only" accept="image/*" onChange={handleAvatarChange} />
                          </label>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Your 10-Digit ID</Label>
                <Input readOnly disabled value={user.userCode || 'Generating...'} className="font-mono bg-muted" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            placeholder="your_username"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setUsername(e.target.value);
                            }}
                            className={cn(getStatusColor(usernameStatus), 'pr-10')}
                          />
                        </FormControl>
                        <div className="absolute inset-y-0 right-0 flex items-center justify-center pr-3 w-10">
                          {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin" />}
                          {usernameStatus === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {usernameStatus === 'invalid' && <XCircle className="h-4 w-4 text-destructive" />}
                        </div>
                      </div>
                      <FormMessage />
                      {usernameStatus === 'invalid' && <p className="text-sm text-destructive">Username is already taken.</p>}
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input readOnly disabled value={user.email} />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us a little bit about yourself"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Leave blank to keep current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
