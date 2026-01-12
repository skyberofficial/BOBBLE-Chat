'use client';

import React from 'react';
import { Conversation, User } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import { ConversationSidebar } from './conversation-sidebar';
import { ChatProvider, useChat } from './chat-context';

interface ChatShellProps {
    children: React.ReactNode;
    user: User;
    conversations: Conversation[];
}

function ChatShellContent({ children, user }: { children: React.ReactNode, user: User }) {
    const { conversations, isSidebarOpen, setSidebarOpen } = useChat();
    const pathname = usePathname();
    const router = useRouter();
    const isBaseApp = pathname === '/app';
    const selectedConversationId = pathname.startsWith('/app/') ? pathname.split('/').pop() || null : null;

    return (
        <div className="flex h-full w-full bg-background/60 backdrop-blur-xl relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Sidebar Container */}
            <div className={`
                ${isBaseApp ? 'flex' : (isSidebarOpen ? 'flex absolute inset-0 z-50' : 'hidden md:flex')} 
                w-full md:w-[380px] lg:w-[420px] border-r border-primary/5 flex-col bg-white dark:bg-neutral-950 md:bg-white/20 md:dark:bg-black/10 backdrop-blur-md relative z-10 h-full
            `}>
                <div className="flex-1 overflow-hidden">
                    <ConversationSidebar
                        conversations={conversations}
                        user={user}
                        selectedConversationId={selectedConversationId}
                        onSelectConversation={(id) => {
                            router.push(`/app/${id}`);
                            setSidebarOpen(false);
                        }}
                        onConversationCreated={(conv) => {
                            router.push(`/app/${conv.id}`);
                            setSidebarOpen(false);
                        }}
                        isCollapsed={false}
                    />
                </div>
                {/* Mobile Close Button for Sidebar Overlay */}
                {isSidebarOpen && !isBaseApp && (
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-primary/10 text-primary md:hidden"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className={`
                ${isBaseApp ? 'hidden md:flex' : 'flex'} 
                flex-1 flex flex-col h-full overflow-hidden relative z-0
            `}>
                {children}
            </div>
        </div>
    );
}

export function ChatShell({ children, user, conversations: initialConversations }: ChatShellProps) {
    return (
        <ChatProvider initialConversations={initialConversations} user={user}>
            <ChatShellContent user={user}>
                {children}
            </ChatShellContent>
        </ChatProvider>
    );
}
