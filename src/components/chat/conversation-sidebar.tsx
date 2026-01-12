'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut, Search, Trash2, Bell, BellOff, MoreVertical, X, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { User, Conversation } from '@/lib/types';
import { io } from 'socket.io-client';

interface Notification {
  type: 'user_joined' | 'message';
  data: {
    id: string; // User ID for joined, Message ID for message
    name: string; // User name or Sender name
    username?: string;
    avatar?: string;
    content?: string; // For message
    senderId?: string; // For message
  };
  timestamp: number;
  read: boolean;
}

import { logout, startChat, searchUsers, deleteConversation } from '@/lib/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from '@/hooks/use-debounce';
import { Logo } from '../logo';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConversationSidebarProps {
  user: User;
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onConversationCreated: (conversation: Conversation) => void;
  isCollapsed: boolean;
}

export function ConversationSidebar({
  user,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onConversationCreated,
  isCollapsed,
}: ConversationSidebarProps) {
  // Refs for accessing latest state in socket listeners without re-registering
  const selectedConversationIdRef = React.useRef(selectedConversationId);
  const conversationsRef = React.useRef(conversations);

  React.useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
    conversationsRef.current = conversations;
  }, [selectedConversationId, conversations]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { toast } = useToast();
  const [mutedUsers, setMutedUsers] = useState<Record<string, number>>({});

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = React.useRef<any>(null);

  React.useEffect(() => {
    // Load notifications from local storage
    const saved = localStorage.getItem('bubblechat-notifications');
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse notifications", e);
      }
    }

    const savedMutes = localStorage.getItem('bubblechat-mutes');
    if (savedMutes) {
      try {
        setMutedUsers(JSON.parse(savedMutes));
      } catch (e) {
        console.error("Failed to parse mutes", e);
      }
    }
  }, []);

  // Sync notifications with unread conversations from DB on mount/update
  React.useEffect(() => {
    if (!conversations) return;

    const unreadConvos = conversations.filter(c => (c.unreadCount || 0) > 0);
    if (unreadConvos.length === 0) return;

    setNotifications(prev => {
      const newNotifications: Notification[] = [];

      unreadConvos.forEach(c => {
        if (!c.lastMessage) return;

        // Avoid duplicates
        if (prev.some(n => n.type === 'message' && n.data.id === c.lastMessage!.id)) return;

        const sender = c.participants.find(p => p.id === c.lastMessage!.senderId);
        const notification: Notification = {
          type: 'message',
          data: {
            id: c.lastMessage!.id,
            name: sender?.name || 'Someone',
            senderId: c.lastMessage!.senderId,
            content: c.lastMessage!.text,
            avatar: sender?.avatar
          },
          timestamp: c.lastMessage!.timestamp,
          read: false
        };
        newNotifications.push(notification);
      });

      if (newNotifications.length === 0) return prev;

      const updated = [...newNotifications, ...prev];
      // Sort by timestamp desc
      updated.sort((a, b) => b.timestamp - a.timestamp);

      localStorage.setItem('bubblechat-notifications', JSON.stringify(updated.slice(0, 50)));
      return updated;
    });
  }, [conversations]);

  React.useEffect(() => {
    // Connect to socket for notifications
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(socketUrl);

    socketRef.current.on('connect', () => {
      // Register just to receive broadcasts
      // We don't need full registration if we only listen for 'notification' which is broadcast
    });

    socketRef.current.on('receive_message', (data: any) => {
      const currentConversationId = selectedConversationIdRef.current;
      const allConversations = conversationsRef.current;

      // 1. Skip if user sent it or if currently viewing this conversation
      if (data.senderId === user.id) return;
      // The socket sends conversationId in the new payload
      if (currentConversationId && data.conversationId === currentConversationId) {
        return;
      }

      // 2. Find sender details
      // Use data direct from socket if available, fallback to "Someone"
      // This decouples notification from local conversation state loaded in the sidebar
      let senderName = data.senderName || 'Someone';
      let senderAvatar = data.senderAvatar;

      // Fallback: Try to find in loaded conversations if not in payload (legacy/backward compat)
      if (!data.senderName) {
        const conversation = allConversations.find(c => c.id === data.conversationId);
        if (conversation) {
          const sender = conversation.participants.find(p => p.id === data.senderId);
          if (sender) {
            senderName = sender.name;
            senderAvatar = sender.avatar;
          }
        }
      }

      const newNotification: Notification = {
        type: 'message',
        data: {
          id: data.id,
          name: senderName,
          senderId: data.senderId,
          content: data.content,
          avatar: senderAvatar
        },
        timestamp: Date.now(),
        read: false
      };

      setNotifications(prev => {
        if (prev.some(n => n.type === 'message' && n.data.id === data.id)) return prev;
        const updated = [newNotification, ...prev];
        localStorage.setItem('bubblechat-notifications', JSON.stringify(updated.slice(0, 50)));
        return updated;
      });

      toast({
        title: `New message from ${senderName}`,
        description: data.content,
      });
    });

    socketRef.current.on('notification', (notice: any) => {
      // Deduplicate by timestamp and user ID
      setNotifications(prev => {
        const isDuplicate = prev.some(n =>
          n.timestamp === notice.timestamp && n.data.id === notice.data.id
        );
        if (isDuplicate) return prev;

        const newNotification: Notification = {
          ...notice,
          read: false
        };
        const updated = [newNotification, ...prev];
        localStorage.setItem('bubblechat-notifications', JSON.stringify(updated.slice(0, 50))); // Keep last 50
        return updated;
      });
      toast({
        title: "New User Joined!",
        description: `${notice.data.name} just joined BobbleChat. Say hi!`,
      });
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const markNotificationsAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('bubblechat-notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const hasUnread = notifications.some(n => !n.read);
  const updatesNotifications = notifications.filter(n => n.type === 'user_joined');
  const messageNotifications = notifications.filter(n => n.type === 'message');

  const handleMute = (otherUserId: string, hours: number) => {
    const expiresAt = hours === -1 ? -1 : Date.now() + hours * 60 * 60 * 1000;
    const newMutes = { ...mutedUsers, [otherUserId]: expiresAt };
    setMutedUsers(newMutes);
    localStorage.setItem('bubblechat-mutes', JSON.stringify(newMutes));
    toast({
      title: hours === 0 ? 'Chat unmuted' : (hours === -1 ? 'Chat muted indefinitely' : `Chat muted for ${hours} hours`),
      variant: hours === 0 ? "default" : "destructive"
    });
  };

  const isUserMuted = (otherUserId: string) => {
    const expiry = mutedUsers[otherUserId];
    if (!expiry) return false;
    if (expiry === -1) return true;
    return Date.now() < expiry;
  };

  React.useEffect(() => {
    if (debouncedSearchQuery) {
      startSearchTransition(async () => {
        const results = await searchUsers(debouncedSearchQuery, user.id);
        setSearchResults(results);
      });
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, user.id]);

  const handleStartChat = async (foundUser: User) => {
    // Check if conversation already exists
    const existingConversation = conversations.find(c =>
      c.participants.some(p => p.id === foundUser.id)
    );

    if (existingConversation) {
      onSelectConversation(existingConversation.id);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    // Create new conversation
    const result = await startChat(user.id, foundUser.id);
    if (result.success && result.conversationId) {
      // Create optimistic conversation object
      const newConversation: Conversation = {
        id: result.conversationId,
        participantIds: [user.id, foundUser.id],
        participants: [user, foundUser],
        messages: [],
        unreadCount: 0
      };
      onConversationCreated(newConversation);
      onSelectConversation(newConversation.id);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const filteredConversations = conversations.filter(c => {
    const otherParticipant = c.participants.find(p => p.id !== user.id);
    if (!otherParticipant) return false;
    const searchLower = debouncedSearchQuery.toLowerCase();
    return (
      otherParticipant.name.toLowerCase().includes(searchLower) ||
      otherParticipant.username.toLowerCase().includes(searchLower) ||
      otherParticipant.userCode.toLowerCase().includes(searchLower)
    );
  });

  const globalSearchResults = searchResults.filter(
    foundUser => !conversations.some(c => c.participants.some(p => p.id === foundUser.id))
  );

  const conversationsContent = (
    <>
      <div className="p-4 border-b bg-white/30 dark:bg-black/10 backdrop-blur-sm sticky top-0 z-20 space-y-4">
        <div className="flex items-center justify-between">
          <Logo variant="rectangular" showText={false} className="h-8 w-auto" />
          <Popover onOpenChange={(open) => { if (open) markNotificationsAsRead(); }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors relative">
                <Bell className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full animate-pulse ring-2 ring-background" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 border-none shadow-xl rounded-2xl overflow-hidden bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl">
              <div className="p-4 border-b border-border/40 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">Notifications</h4>
                  {hasUnread && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-widest">New</span>
                  )}
                </div>

                <Tabs defaultValue="updates" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 h-9 p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger value="messages" className="text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Messages</TabsTrigger>
                    <TabsTrigger value="updates" className="text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Updates</TabsTrigger>
                  </TabsList>

                  <TabsContent value="updates" className="mt-0">
                    {notifications.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <BellOff className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground/80">All caught up!</p>
                          <p className="text-xs text-muted-foreground">You don't have any new notifications.</p>
                        </div>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px]">
                        <div className="flex flex-col">
                          {notifications.map((n, i) => (
                            <div key={i} className={cn("p-4 border-b border-border/40 hover:bg-muted/50 transition-colors flex gap-3 relative", !n.read && "bg-primary/5")}>
                              <Avatar className="h-10 w-10 border border-primary/20">
                                <AvatarImage src={n.data.avatar} />
                                <AvatarFallback>{n.data.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{n.data.name} <span className="font-normal text-muted-foreground">joined!</span></p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(n.timestamp, { addSuffix: true })}</p>
                                {!n.read && <span className="absolute top-4 right-4 h-2 w-2 bg-primary rounded-full" />}
                              </div>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleStartChat(n.data as any)}>
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>

                  <TabsContent value="messages" className="mt-0">
                    {messageNotifications.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 h-[200px]">
                        <BellOff className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground">No new messages.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px]">
                        <div className="flex flex-col">
                          {messageNotifications.map((n, i) => (
                            <div key={i} className={cn("p-4 border-b border-border/40 hover:bg-muted/50 transition-colors flex gap-3 relative", !n.read && "bg-primary/5")}>
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{(n.data.name || 'Unknown').charAt(0)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">Message from <span className="text-primary">{n.data.name}</span></p>
                                <p className="text-xs text-muted-foreground truncate">{n.data.content}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(n.timestamp, { addSuffix: true })}</p>
                                {!n.read && <span className="absolute top-4 right-4 h-1.5 w-1.5 bg-primary rounded-full" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary pointer-events-none" />
          <Input
            placeholder="Search name, @username or ID..."
            className="pl-10 pr-10 h-10 bg-zinc-100/50 dark:bg-zinc-800/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-all active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {debouncedSearchQuery ? (
            <div className="space-y-4">
              {filteredConversations.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Existing Chats</p>
                  {filteredConversations.map((conversation) => {
                    const otherParticipant = conversation.participants.find((p) => p.id !== user.id)!;
                    return (
                      <div
                        key={conversation.id}
                        onClick={() => {
                          onSelectConversation(conversation.id);
                          setSearchQuery('');
                        }}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group relative',
                          selectedConversationId === conversation.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
                          <AvatarFallback>{otherParticipant.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-semibold truncate text-sm">
                            {otherParticipant.name}
                            {isUserMuted(otherParticipant.id) && <BellOff className="inline-block h-3 w-3 ml-1 text-muted-foreground/50" />}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">@{otherParticipant.username}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Global Search</p>
                  {isSearching && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>

                {globalSearchResults.length > 0 ? (
                  globalSearchResults.map((foundUser) => (
                    <div
                      key={foundUser.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 cursor-pointer transition-all border border-transparent hover:border-primary/10 active:scale-95"
                      onClick={() => handleStartChat(foundUser)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={foundUser.avatar} alt={foundUser.name} />
                        <AvatarFallback>{foundUser.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold truncate text-sm">{foundUser.name}</p>
                        <p className="text-xs text-muted-foreground">@{foundUser.username}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  !isSearching && filteredConversations.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-2xl">
                      <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">No users found for<br /><span className="font-bold text-foreground">"{debouncedSearchQuery}"</span></p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <nav className="space-y-1">
              {conversations.map((conversation) => {
                const otherParticipant = conversation.participants.find((p) => p.id !== user.id);
                if (!otherParticipant) return null;

                return (
                  <div
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group relative',
                      selectedConversationId === conversation.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
                      <AvatarFallback>{otherParticipant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold truncate">
                          {otherParticipant.name}
                          {isUserMuted(otherParticipant.id) && <BellOff className="inline-block h-3 w-3 ml-1 text-muted-foreground/50" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {conversation.lastMessage &&
                            formatDistanceToNow(conversation.lastMessage.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className={cn("text-sm truncate pr-2", (conversation.unreadCount || 0) > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                          {conversation.lastMessage?.text}
                        </p>
                        {(conversation.unreadCount || 0) > 0 && (
                          <Badge variant="default" className="h-5 min-w-[1.25rem] rounded-full px-1 flex items-center justify-center text-[10px]">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions Group - Always Visible */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>

                      {/* Mute Action */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7 transition-colors", isUserMuted(otherParticipant.id) ? "text-primary/50" : "text-muted-foreground hover:text-primary")}>
                            {isUserMuted(otherParticipant.id) ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-primary/20 shadow-2xl">
                          <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-3 py-2">Mute Notifications</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-primary/5" />
                          <DropdownMenuItem onClick={() => handleMute(otherParticipant.id, 1)} className="rounded-lg focus:bg-primary/5 cursor-pointer text-xs font-bold">For 1 Hour</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMute(otherParticipant.id, 5)} className="rounded-lg focus:bg-primary/5 cursor-pointer text-xs font-bold">For 5 Hours</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMute(otherParticipant.id, 168)} className="rounded-lg focus:bg-primary/5 cursor-pointer text-xs font-bold">For 1 Week</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMute(otherParticipant.id, -1)} className="rounded-lg focus:bg-primary/5 cursor-pointer text-xs font-bold">Indefinitely</DropdownMenuItem>
                          {isUserMuted(otherParticipant.id) && (
                            <>
                              <DropdownMenuSeparator className="bg-primary/5" />
                              <DropdownMenuItem onClick={() => handleMute(otherParticipant.id, 0)} className="rounded-lg focus:bg-green-500/10 text-green-600 focus:text-green-600 cursor-pointer text-xs font-bold font-black">Unmute Chat</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Delete Action */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the chat history for both participants. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              await deleteConversation(user.id, otherParticipant.id);
                              window.location.reload(); // Quick refresh to update state
                            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                    </div>
                  </div>
                );
              })}
            </nav>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const collapsedConversationsContent = (
    <ScrollArea className="flex-1">
      <div className="flex flex-col items-center gap-2 py-4">
        <Button variant="ghost" size="icon">
          <Search className="h-6 w-6" />
        </Button>
        {conversations.map((conversation) => {
          const otherParticipant = conversation.participants.find((p) => p.id !== user.id);
          return (
            <Avatar
              key={conversation.id}
              className={cn(
                'h-10 w-10 border-2 cursor-pointer',
                selectedConversationId === conversation.id ? 'border-primary' : 'border-transparent'
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <AvatarImage src={otherParticipant?.avatar} alt={otherParticipant?.name} />
              <AvatarFallback>{otherParticipant?.name.charAt(0)}</AvatarFallback>
            </Avatar>
          );
        })}
      </div>
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full text-card-foreground">
      <div className={cn('flex-1 flex flex-col overflow-hidden', isCollapsed && 'items-center')}>
        {isCollapsed ? collapsedConversationsContent : conversationsContent}
      </div>

      <div className="p-4 mt-auto border-t bg-white dark:bg-neutral-900">
        <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <Link href="/app/profile" className={cn("flex-1 flex items-center gap-3 overflow-hidden rounded-md hover:bg-muted/50 p-1 transition-colors", isCollapsed && 'w-10 h-10 flex-none justify-center')}>
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold truncate text-sm">{user.name}</p>
                <p className="text-[10px] text-primary font-mono truncate">{user.userCode}</p>
              </div>
            )}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => logout()} className={cn(isCollapsed && 'w-10 h-10')}>
            <LogOut className="h-5 w-5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
