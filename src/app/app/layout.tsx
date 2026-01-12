import { getAuthUser } from '@/lib/auth';
import { getConversationsForUser } from '@/lib/data';
import { redirect } from 'next/navigation';
import React from 'react';
import { ChatShell } from '@/components/chat/chat-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect('/login');
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  // Create a fresh client with the user's token for RLS
  const { createClient } = require('@supabase/supabase-js');
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaldnmqostzgmqtyeprp.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WNtJxaQRsc7c5UckV6HhCQ_hzqGWJS4',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const conversations = await getConversationsForUser(user.id, authClient);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background p-0 sm:p-4 overflow-hidden">
      <div className="flex-1 w-full max-w-[1600px] mx-auto bg-white/40 dark:bg-black/20 rounded-none sm:rounded-3xl shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden backdrop-blur-md">
        <ChatShell user={user} conversations={conversations}>
          {children}
        </ChatShell>
      </div>
    </div>
  );
}
