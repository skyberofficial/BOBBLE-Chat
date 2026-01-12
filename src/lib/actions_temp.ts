'use server';

import { cookies } from 'next/headers';
import { supabase } from './supabase'; // Fallback client
import { getMessages } from './data';
import type { Message } from './types';

// ... existing imports ...

// New authenticated fetch action
export async function fetchConversationMessages(userId1: string, userId2: string): Promise<Message[]> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('sb-access-token')?.value;

        if (!token) {
            console.warn("fetchConversationMessages: No token found");
            return [];
        }

        // Create authenticated client
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

        // Reuse the logic from data.ts but with the auth client
        // We can't easily call getMessages(..., authClient) because getMessages doesn't accept a client (yet)
        // So we'll inline the fetch here or modify getMessages to accept a client (which I didn't do for getMessages, only getConversations)

        // Let's modify getMessages in data.ts first to be safe, or just do the query here.
        // Doing the query here is safer and self-contained.

        const { data, error } = await authClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
            .order('created_at', { ascending: true });

        if (error || !data) {
            console.error("Fetch error:", error);
            return [];
        }

        return data.map((msg: any) => ({
            id: msg.id,
            senderId: msg.sender_id,
            text: msg.content,
            timestamp: new Date(msg.created_at).getTime()
        }));

    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}
