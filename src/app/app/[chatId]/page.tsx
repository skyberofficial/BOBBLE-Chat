import { getAuthUser } from '@/lib/auth';
import { getConversationsForUser } from '@/lib/data';
import { notFound } from 'next/navigation';
import { MessageArea } from '@/components/chat/message-area';

interface PageProps {
    params: Promise<{ chatId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
    const { chatId } = await params;
    const user = await getAuthUser();
    if (!user) {
        notFound();
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
    const conversation = conversations.find(c => c.id === chatId);

    if (!conversation) {
        // If not found in sidebar list, it might be a direct navigation to a user ID
        // but For now we assume the ID must be valid. 
        // We could implement fetching a specific conversation by ID here.
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-3xl">📭</span>
                    </div>
                    <h2 className="text-xl font-bold">Conversation not found</h2>
                    <p className="text-muted-foreground max-w-xs">The chat you're looking for doesn't exist or you don't have access.</p>
                </div>
            </div>
        );
    }

    return (
        <MessageArea
            key={chatId}
            conversation={conversation}
            currentUser={user}
        />
    );
}
