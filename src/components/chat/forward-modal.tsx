'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, SendHorizontal, Check, Loader2 } from 'lucide-react';
import type { User, Message } from '@/lib/types';
import { searchUsers, sendMessage } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

interface ForwardModalProps {
    message: Message | null;
    currentUser: User;
    isOpen: boolean;
    onClose: () => void;
}

export function ForwardModal({ message, currentUser, isOpen, onClose }: ForwardModalProps) {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isForwarding, setIsForwarding] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (query.trim().length > 2) {
            const delayDebounceFn = setTimeout(async () => {
                setLoading(true);
                try {
                    const results = await searchUsers(query, currentUser.id);
                    setUsers(results);
                } catch (error) {
                    console.error("Search failed:", error);
                } finally {
                    setLoading(false);
                }
            }, 300);

            return () => clearTimeout(delayDebounceFn);
        } else {
            setUsers([]);
        }
    }, [query, currentUser.id]);

    const handleForward = async () => {
        if (!selectedUser || !message) return;

        setIsForwarding(true);
        try {
            // Create forwarded content
            const forwardedContent = message.text.startsWith('> ')
                ? message.text.split('\n\n').slice(1).join('\n\n') // Remove original reply if present
                : message.text;

            const finalContent = `[Forwarded]: ${forwardedContent}`;

            const result = await sendMessage(selectedUser.id, finalContent, currentUser.id, message.type || 'text');

            if (result.success) {
                toast({
                    title: "Message Forwarded",
                    description: `Message sent to ${selectedUser.name}`,
                });
                onClose();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            toast({
                title: "Forward Failed",
                description: "An error occurred while forwarding.",
                variant: "destructive"
            });
        } finally {
            setIsForwarding(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl border-primary/20 rounded-3xl p-6 shadow-2xl">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <SendHorizontal className="h-6 w-6 text-primary" />
                        Forward Message
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search users..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-10 bg-primary/5 border-none h-12 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
                        />
                    </div>

                    <ScrollArea className="h-64 rounded-2xl border border-primary/10 p-2 bg-primary/5 shadow-inner">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : users.length > 0 ? (
                            <div className="space-y-1">
                                {users.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUser(user)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
                                            selectedUser?.id === user.id
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "hover:bg-primary/10 text-foreground"
                                        )}
                                    >
                                        <Avatar className="h-10 w-10 border-2 border-primary/10 group-hover:border-primary/30 transition-colors">
                                            <AvatarImage src={user.avatar} />
                                            <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                                {user.name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="font-bold text-sm truncate uppercase tracking-wider">{user.name}</p>
                                            <p className={cn(
                                                "text-xs truncate opacity-70",
                                                selectedUser?.id === user.id ? "text-primary-foreground/80" : "text-muted-foreground"
                                            )}>
                                                @{user.username}
                                            </p>
                                        </div>
                                        {selectedUser?.id === user.id && (
                                            <Check className="h-5 w-5 animate-in zoom-in-50 duration-200" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : query.trim().length > 2 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-2">
                                <Search className="h-8 w-8 opacity-20 mb-2" />
                                <p className="text-sm font-bold uppercase tracking-widest">No users found</p>
                                <p className="text-xs opacity-60 font-medium">Try searching for a different username or ID</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                                <p className="text-xs font-bold uppercase tracking-widest opacity-40">Start typing to search users</p>
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="mt-6 gap-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-xl font-bold uppercase tracking-widest text-xs h-11"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleForward}
                        disabled={!selectedUser || isForwarding}
                        className="rounded-xl font-black uppercase tracking-[0.15em] text-xs h-11 px-6 shadow-xl shadow-primary/20"
                    >
                        {isForwarding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SendHorizontal className="h-4 w-4 mr-2" />}
                        Forward Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

