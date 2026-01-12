'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Conversation, Message, User } from '@/lib/types';
import { usePathname } from 'next/navigation';

interface ChatContextType {
    conversations: Conversation[];
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
    socket: any;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
    children,
    initialConversations,
    user
}: {
    children: ReactNode;
    initialConversations: Conversation[];
    user: User;
}) {
    const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
    const [socket, setSocket] = useState<any>(null);
    const pathname = usePathname();

    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    // Global Socket for Realtime Sync
    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        console.log('--- Socket Context: Initializing connection to:', socketUrl);

        const sock = require('socket.io-client').io(socketUrl, {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 5,
            timeout: 10000
        });
        setSocket(sock);

        sock.on('connect', () => {
            console.log('--- Socket Context: Connected! ID:', sock.id);
            if (user?.id) sock.emit('register', user.id);
        });

        sock.on('receive_message', (data: any) => {
            setConversations(prev => {
                const convIndex = prev.findIndex(c => c.id === data.conversationId);

                // If conversation doesn't exist, we should ideally fetch it or handle it.
                // For now, if it's not in the list, we just return prev.
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
                    messages: conv.messages.map(m =>
                        data.messageIds.includes(m.id) ? { ...m, status: 'read' as const } : m
                    )
                };
            }));
        });

        sock.on('conversation_deleted', (data: any) => {
            setConversations(prev => prev.filter(c => c.id !== data.senderId));
        });

        return () => {
            sock.disconnect();
        };
    }, [user.id]);

    // Handle marking as read when a conversation is viewed
    useEffect(() => {
        const chatId = pathname.split('/').pop();
        if (chatId && chatId !== 'app' && chatId !== 'profile' && socket) {
            const conversation = conversations.find(c => c.id === chatId);
            if (conversation) {
                const unreadMessages = conversation.messages.filter(
                    m => m.senderId !== user.id && m.status !== 'read'
                );

                if (unreadMessages.length > 0) {
                    socket.emit('mark_as_read', {
                        conversationId: chatId,
                        messageIds: unreadMessages.map(m => m.id),
                        readerId: user.id,
                        senderId: conversation.participants.find(p => p.id !== user.id)?.id
                    });

                    // Update local state immediately
                    setConversations(prev => prev.map(conv => {
                        if (conv.id !== chatId) return conv;
                        return {
                            ...conv,
                            unreadCount: 0,
                            messages: conv.messages.map(m =>
                                m.senderId !== user.id ? { ...m, status: 'read' as const } : m
                            )
                        };
                    }));
                }
            }
        }
    }, [pathname, socket, conversations.length]);

    return (
        <ChatContext.Provider value={{ conversations, setConversations, socket }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
