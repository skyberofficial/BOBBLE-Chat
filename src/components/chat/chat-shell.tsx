'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { User, Conversation, Message } from '@/lib/types';
import { ConversationSidebar } from './conversation-sidebar';
import { cn } from '@/lib/utils';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Button } from '../ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logo } from '../logo';

interface ChatShellProps {
    user: User;
    conversations: Conversation[];
    children: React.ReactNode;
}

export function ChatShell({ user, conversations: initialConversations, children }: ChatShellProps) {
    const params = useParams();
    const router = useRouter();
    const chatId = params.chatId as string | undefined;

    const [conversations, setConversations] = useState(initialConversations);
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
    const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    const [socket, setSocket] = useState<any>(null);

    // Global Socket for Realtime Sync
    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const sock = require('socket.io-client').io(socketUrl);
        setSocket(sock);

        sock.on('connect', () => {
            if (user?.id) sock.emit('register', user.id);
        });

        sock.on('receive_message', (data: any) => {
            setConversations(prev => {
                const convIndex = prev.findIndex(c => c.id === data.conversationId);
                if (convIndex === -1) return prev;
                const updatedConv = { ...prev[convIndex] };
                const newMessage: Message = {
                    id: data.id,
                    senderId: data.senderId,
                    text: data.content,
                    timestamp: data.timestamp,
                    type: data.type,
                    status: 'sent'
                };

                const currentPath = window.location.pathname;
                const isActive = currentPath.includes(data.conversationId);

                if (isActive && data.senderId !== user.id) {
                    newMessage.status = 'read';
                }

                const messages = updatedConv.messages || [];
                if (!messages.some(m => m.id === newMessage.id)) {
                    updatedConv.messages = [...messages, newMessage];
                }
                updatedConv.lastMessage = newMessage;
                if (!isActive && data.senderId !== user.id) {
                    updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
                }
                const newConvs = [...prev];
                newConvs.splice(convIndex, 1);
                return [updatedConv, ...newConvs];
            });
        });

        sock.on('message_delivered', (data: any) => {
            setConversations(prev => prev.map(conv => {
                if (conv.id !== data.conversationId) return conv;
                return {
                    ...conv,
                    messages: conv.messages.map(m => m.id === data.id ? { ...m, status: 'delivered' as const } : m)
                };
            }));
        });

        sock.on('message_read', (data: any) => {
            setConversations(prev => prev.map(conv => {
                if (conv.id !== data.conversationId) return conv;
                return {
                    ...conv,
                    messages: conv.messages.map(m => data.messageIds.includes(m.id) ? { ...m, status: 'read' as const } : m)
                };
            }));
        });

        return () => {
            sock.disconnect();
        };
    }, [user.id]);

    // Emit read receipt when conversation becomes active
    useEffect(() => {
        if (!socket || !chatId) return;
        const currentConv = conversations.find(c => c.id === chatId);
        if (!currentConv) return;

        const unreadMessagesForMe = currentConv.messages.filter(m =>
            m.senderId !== user.id && m.status !== 'read'
        );

        if (unreadMessagesForMe.length > 0) {
            const messageIds = unreadMessagesForMe.map(m => m.id);
            socket.emit('mark_as_read', {
                conversationId: chatId,
                messageIds: messageIds,
                readerId: user.id,
                senderId: unreadMessagesForMe[0].senderId
            });

            // Local update to clear unread count and set status to read
            setConversations(prev => prev.map(c => {
                if (c.id !== chatId) return c;
                return {
                    ...c,
                    unreadCount: 0,
                    messages: c.messages.map(m =>
                        messageIds.includes(m.id) ? { ...m, status: 'read' as const } : m
                    )
                };
            }));
        }
    }, [chatId, conversations, socket, user.id]);

    const handleSelectConversation = (conversationId: string) => {
        router.push(`/app/${conversationId}`);
        if (isMobile) {
            setIsMobileSheetOpen(false);
        }
    };

    const onConversationCreated = (newConversation: Conversation) => {
        setConversations(prev => [newConversation, ...prev.filter(c => c.id !== newConversation.id)]);
        router.push(`/app/${newConversation.id}`);
    };

    const sidebar = (
        <ConversationSidebar
            user={user}
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
            selectedConversationId={chatId || null}
            onConversationCreated={onConversationCreated}
            isCollapsed={isDesktopSidebarCollapsed && !isMobile}
        />
    );

    return (
        <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row text-sm bg-background/50 backdrop-blur-sm">
            {/* Mobile Sidebar */}
            <div className="md:hidden absolute top-4 left-4 z-30">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm border border-border/40">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-80 bg-white dark:bg-neutral-900 border-r">
                        <SheetTitle className="sr-only">Conversations</SheetTitle>
                        {sidebar}
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <div className={cn(
                "hidden md:flex flex-col border-r bg-white dark:bg-neutral-900 transition-all duration-300 ease-in-out h-full shadow-sm",
                isDesktopSidebarCollapsed ? "w-16" : "w-80 lg:w-96"
            )}>
                <div className="p-3 h-[61px] border-b flex items-center justify-between">
                    {!isDesktopSidebarCollapsed && (
                        <div className="flex items-center gap-2">
                            <Logo variant="rectangular" showText={false} className="justify-start h-8 origin-left" />
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
                        className={cn("hover:bg-primary/5 hover:text-primary transition-colors", isDesktopSidebarCollapsed && "mx-auto")}
                    >
                        {isDesktopSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                    {sidebar}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {children}
            </div>
        </div>
    );
}
