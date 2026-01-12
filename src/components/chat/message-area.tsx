'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, SendHorizontal, Loader2, Video, Phone, MessageSquare, Menu } from 'lucide-react';
import type { Conversation, User, Message } from '@/lib/types';
import { MessageBubble } from './message-bubble';
import { sendMessage, fetchConversationMessages, unsendMessage, deleteMessageForMe } from '@/lib/actions';
import { Logo } from '../logo';
import { supabase } from '@/lib/supabase';
import { io, Socket } from 'socket.io-client';
import { useChat } from './chat-context';
import { FloatingBubbles } from '../ui/floating-bubbles';
import { TypingIndicator } from './typing-indicator';
import { CallOverlay } from './call-overlay';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Paperclip, Image as ImageIcon, Camera as CameraIcon, X as XIcon } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { CameraCapture } from './camera-capture';
import { convertToWebP, blobToDataURL } from '@/lib/image-utils';
import { uploadChatMedia } from '@/lib/actions';
import { ForwardModal } from './forward-modal';

interface MessageAreaProps {
  conversation: Conversation;
  currentUser: User;
  onBack?: () => void;
}

export function MessageArea({
  conversation: initialConversation,
  currentUser,
  onBack,
}: MessageAreaProps) {
  const { toast } = useToast();
  const { conversations, setConversations, socket, setSidebarOpen } = useChat();
  const [text, setText] = useState('');

  // Find the live version of this conversation from our context
  const conversation = conversations.find(c => (c.id === initialConversation?.id) || (c.id === initialConversation?.participants.find(p => p.id !== currentUser.id)?.id)) || initialConversation;

  // Sync local messages with the live conversation state from context
  const [messages, setMessages] = useState<Message[]>(conversation?.messages || []);

  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation?.messages]);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  // Only show loading if we have NO messages
  const [isLoadingHistory, setIsLoadingHistory] = useState(!(conversation?.messages && conversation.messages.length > 0));
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef(conversation);
  // useChat provides the global socket

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // WebRTC States
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connecting' | 'active' | 'hangup' | 'rejected'>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const callStatusRef = useRef(callStatus);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const outgoingToneRef = useRef<HTMLAudioElement | null>(null);
  const hangupToneRef = useRef<HTMLAudioElement | null>(null);

  // Image Sharing States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Message Actions States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isForwarding, setIsForwarding] = useState<Message | null>(null);

  useEffect(() => {
    // Initialize ringtone (incoming)
    ringtoneRef.current = new Audio();
    ringtoneRef.current.loop = true;

    // Initialize outgoing tone (ringback)
    outgoingToneRef.current = new Audio('/assets/calling_tone/bell-ringing.ogg');
    outgoingToneRef.current.loop = true;

    // Initialize hangup tone
    hangupToneRef.current = new Audio('/assets/calling_tone/Hang-Up.ogg');
    hangupToneRef.current.loop = false;

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
      if (outgoingToneRef.current) {
        outgoingToneRef.current.pause();
        outgoingToneRef.current = null;
      }
      if (hangupToneRef.current) {
        hangupToneRef.current.pause();
        hangupToneRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    callStatusRef.current = callStatus;

    // Incoming ringtone management
    if (callStatus === 'incoming') {
      if (ringtoneRef.current) {
        ringtoneRef.current.src = callType === 'video'
          ? '/assets/calling_tone/video-tone.ogg'
          : '/assets/calling_tone/voice-tone.ogg';
        ringtoneRef.current.play().catch(err => console.error("Ringtone play failed:", err));
      }
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }

    // Outgoing ringback management
    if (callStatus === 'calling') {
      outgoingToneRef.current?.play().catch(err => console.error("Outgoing tone play failed:", err));
    } else {
      if (outgoingToneRef.current) {
        outgoingToneRef.current.pause();
        outgoingToneRef.current.currentTime = 0;
      }
    }
  }, [callStatus]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // WebRTC Logic
  const initPeerConnection = () => {
    if (peerConnection.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        socket.current.emit('ice-candidate', {
          from: currentUser.id,
          to: conversationRef.current?.id,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current = pc;
    return pc;
  };

  const startCall = async (type: 'audio' | 'video') => {
    setCallType(type);
    setCallStatus('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);

      const pc = initPeerConnection();
      if (!pc) return;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.current?.emit('call-user', {
        from: currentUser.id,
        to: conversationRef.current?.id,
        offer,
        type
      });
    } catch (e) {
      console.error('Error starting call', e);
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: "Could not access camera or microphone. Please check your permissions.",
      });
      endCall();
    }
  };

  const acceptCall = async () => {
    if (!pendingOffer) return;
    setCallStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
      });
      setLocalStream(stream);

      const pc = initPeerConnection();
      if (!pc) return;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.current?.emit('answer-call', {
        from: currentUser.id,
        to: conversationRef.current?.id,
        answer
      });
      setCallStatus('active');
      logCallEvent(callType === 'video' ? 'call_video' : 'call_voice', `${callType === 'video' ? 'Video' : 'Voice'} call started`);
    } catch (e) {
      console.error('Error accepting call', e);
      toast({
        variant: "destructive",
        title: "Call Error",
        description: "Failed to connect the call. Please try again.",
      });
      endCall();
    }
  };

  const rejectCall = () => {
    socket?.emit('reject-call', {
      from: currentUser.id,
      to: conversationRef.current?.id
    });
    setCallStatus('idle');
    setPendingOffer(null);
    logCallEvent(callType === 'video' ? 'call_missed_video' : 'call_missed_voice', `Missed ${callType === 'video' ? 'video' : 'voice'} call`);
  };

  const endCall = (shouldEmit = true) => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    const prevStatus = callStatus;
    if (prevStatus !== 'idle') {
      hangupToneRef.current?.play().catch(err => console.error("Hangup tone play failed:", err));
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setPendingOffer(null);

    if (shouldEmit) {
      socket?.emit('hangup', {
        from: currentUser.id,
        to: conversationRef.current?.id
      });
      // Only log if call was active
      if (prevStatus === 'active') {
        logCallEvent(callType === 'video' ? 'call_video' : 'call_voice', `${callType === 'video' ? 'Video' : 'Voice'} call ended`);
      }
    }
  };

  const logCallEvent = async (type: Message['type'], text: string) => {
    if (!conversation || !type) return;

    const timestamp = Date.now();
    const messageData: Message = {
      id: `call-${timestamp}`,
      senderId: currentUser.id,
      text,
      timestamp,
      type
    };

    setMessages(prev => [...prev, messageData]);

    socket?.emit('send_message', {
      senderId: currentUser.id,
      receiverId: conversation.id,
      content: text,
      timestamp,
      type
    });

    try {
      await sendMessage(conversation.id, text, currentUser.id, type);
    } catch (error) {
      console.error("Failed to log call:", error);
    }
  };

  // Sync with global conversation messages (which includes real-time status updates from ChatShell)
  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation?.messages]);

  // Initialize signaling listeners on contextSocket
  useEffect(() => {
    if (!socket) return;

    const onUserTyping = (data: { senderId: string }) => {
      if (data.senderId === conversationRef.current?.id) {
        setIsTyping(true);
      }
    };

    const onUserStopTyping = (data: { senderId: string }) => {
      if (data.senderId === conversationRef.current?.id) {
        setIsTyping(false);
      }
    };

    // WebRTC Signaling Listeners
    socket.on('incoming-call', (data: { from: string, offer: any, type: 'audio' | 'video' }) => {
      if (data.from === conversationRef.current?.id) {
        setCallType(data.type);
        setPendingOffer(data.offer);
        setCallStatus('incoming');
      }
    });

    socket.on('call-answered', async (data: { from: string, answer: any }) => {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('active');
      }
    });

    socket.on('ice-candidate', async (data: { from: string, candidate: any }) => {
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ice candidate', e);
        }
      }
    });

    socket.on('call-ended', () => {
      if (callStatusRef.current === 'incoming') {
        logCallEvent(callType === 'video' ? 'call_missed_video' : 'call_missed_voice', `Missed ${callType === 'video' ? 'video' : 'voice'} call`);
      }
      endCall(false);
    });

    socket.on('call-rejected', () => {
      setCallStatus('rejected');
      setTimeout(() => setCallStatus('idle'), 2000);
    });

    socket.on('user_typing', onUserTyping);
    socket.on('user_stop_typing', onUserStopTyping);

    return () => {
      socket.off('incoming-call');
      socket.off('call-answered');
      socket.off('ice-candidate');
      socket.off('call-ended');
      socket.off('call-rejected');
      socket.off('user_typing', onUserTyping);
      socket.off('user_stop_typing', onUserStopTyping);
    };
  }, [socket, conversation?.id]);

  // Fetch messages and handle Supabase Realtime
  useEffect(() => {
    if (conversation) {
      const fetchMsgs = async () => {
        setIsLoadingHistory(true);
        try {
          // Stage 1: Fast load latest 15 messages
          const initialMsgs = await fetchConversationMessages(currentUser.id, conversation.id, 15);
          setMessages(initialMsgs);
          setIsLoadingHistory(false); // Render immediately

          // Stage 2: Background load full history
          const allMsgs = await fetchConversationMessages(currentUser.id, conversation.id);
          setMessages(prev => {
            const existingIds = new Set(allMsgs.map(m => m.id));
            const uniqueNewMessages = prev.filter(m => !existingIds.has(m.id));
            return [...allMsgs, ...uniqueNewMessages].sort((a, b) => a.timestamp - b.timestamp);
          });
        } catch (error) {
          console.error("Message fetching failed:", error);
          setIsLoadingHistory(false);
        }
      };
      fetchMsgs();

      // Supabase Realtime as a fallback/backup "dual layer"
      const channel = supabase
        .channel(`chat:${conversation.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
          // Only process messages relevant to this conversation (from the other user)
          if (payload.new.sender_id === conversation.id) {
            const newMsg: Message = {
              id: payload.new.id,
              senderId: payload.new.sender_id,
              text: payload.new.content,
              timestamp: new Date(payload.new.created_at).getTime(),
              type: payload.new.type || 'text'
            };
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversation, currentUser.id]); // Re-subscribe when conversation changes

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages, isTyping]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-4 bg-background/30 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
          <Logo />
          <MessageSquare className="h-16 w-16 text-primary/20" />
          <div className='text-center max-w-xs'>
            <h2 className="text-xl font-semibold text-primary">Bubble Link</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Search for a user by their 10-digit ID to start a secure chat.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const otherParticipant = conversation.participants.find(p => p.id !== currentUser.id) || conversation.participants[0];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    // Emit typing event
    if (socket && conversation) {
      socket.emit('typing', { senderId: currentUser.id, receiverId: conversation.id });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { senderId: currentUser.id, receiverId: conversation.id });
      }, 1000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentText = text.trim();
    if ((!currentText && !imageBlob) || isSending) return;

    setIsSending(true);

    let contentToSave = currentText;
    let messageType: 'text' | 'image' = 'text';

    if (imageBlob) {
      try {
        const formData = new FormData();
        const file = new File([imageBlob], 'captured-image.webp', { type: 'image/webp' });
        formData.append('file', file);
        formData.append('fileName', 'captured-image.webp');

        const { publicUrl } = await uploadChatMedia(formData);
        contentToSave = publicUrl;
        messageType = 'image';
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: "Could not upload image to storage. Please try again.",
          variant: "destructive",
        });
        setIsSending(false);
        return; // Don't send the message if upload fails
      }
    }

    // Prepend reply context if replying
    let finalContent = contentToSave || currentText;
    if (replyingTo) {
      const quotedName = replyingTo.senderId === currentUser.id ? 'You' : (conversation.participants.find(p => p.id === replyingTo.senderId)?.name || 'User');
      finalContent = `> ${quotedName}: ${replyingTo.text}\n\n${finalContent}`;
    }

    setText('');
    setImagePreview(null);
    setImageBlob(null);
    setReplyingTo(null);

    // Optimistic UI for socket layer
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUser.id,
      text: finalContent,
      timestamp: Date.now(),
      type: messageType
    };
    setMessages(prev => [...prev, optimisticMessage]);

    // OPTIMISTIC UPDATE: Update the global conversations list immediately 
    if (socket) {
      socket.emit('send_message', {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        receiverId: otherParticipant.id,
        conversationId: conversation.id,
        content: finalContent,
        timestamp: Date.now(),
        type: messageType,
        id: optimisticMessage.id
      });
    }

    // Update global state optimistically
    setConversations(prev => prev.map(c => {
      if (c.id !== conversation.id) return c;
      return {
        ...c,
        messages: [...(c.messages || []), optimisticMessage],
        lastMessage: optimisticMessage
      };
    }));

    try {
      const result = await sendMessage(conversation.id, finalContent, currentUser.id, messageType);
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to persist message');
      }

      // Replace the temp message with the real one in global state
      if (result?.message) {
        setConversations(prev => prev.map(c => {
          if (c.id !== conversation.id) return c;
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === optimisticMessage.id ? result.message : m)
          };
        }));
      }
    } catch (error) {
      console.error("Failed to send:", error);
      toast({
        title: "Message Not Saved",
        description: "Your message was sent but might not be saved. Please check your internet or Supabase policies.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedImage(file);
    }
  };

  const processSelectedImage = async (file: File | Blob) => {
    try {
      const webpBlob = await convertToWebP(file);
      const dataUrl = await blobToDataURL(webpBlob);
      setImageBlob(webpBlob);
      setImagePreview(dataUrl);
    } catch (error) {
      console.error("Image processing failed:", error);
      toast({
        title: "Processing Failed",
        description: "Could not process the image.",
        variant: "destructive",
      });
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setText(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleUnsend = async (messageId: string) => {
    console.log('[DEBUG] handleUnsend called with ID:', messageId);
    if (messageId.startsWith('temp-')) {
      toast({ title: "Please wait", description: "Message is still syncing...", variant: "destructive" });
      return;
    }

    const result = await unsendMessage(messageId, currentUser.id);
    if (result.success) {
      setConversations(prev => prev.map(c => {
        if (c.id !== conversation.id) return c;
        return {
          ...c,
          messages: (c.messages || []).filter(m => m.id !== messageId)
        };
      }));
      socket?.emit('delete_message', { messageId, receiverId: conversation.id });
      toast({ title: "Message Unsent", description: "Your message has been removed for everyone." });
    } else {
      console.error('[DEBUG] unsendMessage failed:', result.message);
      toast({ title: "Error", description: result.message || "Failed to unsend message.", variant: "destructive" });
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    const result = await deleteMessageForMe(messageId);
    if (result.success) {
      setConversations(prev => prev.map(c => {
        if (c.id !== conversation.id) return c;
        return {
          ...c,
          messages: (c.messages || []).filter(m => m.id !== messageId)
        };
      }));
      toast({ title: "Deleted", description: "Message removed from your view." });
    } else {
      toast({ title: "Error", description: "Failed to delete message.", variant: "destructive" });
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleForward = (message: Message) => {
    setIsForwarding(message);
  };

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-sm overflow-hidden relative">
      <FloatingBubbles />
      {/* Header */}
      <div className="p-3 md:p-4 border-b flex items-center gap-3 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl sticky top-0 z-40 w-full transition-all">
        {!onBack && (
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="md:hidden flex h-9 w-9 rounded-full bg-primary/5 text-primary hover:bg-primary/10">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden flex h-9 w-9 rounded-full bg-primary/5 text-primary hover:bg-primary/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {otherParticipant && (
          <>
            <Avatar className="h-9 w-9 md:h-10 md:w-10 ring-2 ring-primary/10">
              <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
              <AvatarFallback className="bg-primary/5 text-primary">{otherParticipant.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm md:text-base truncate">{otherParticipant.name}</p>
              <div className="flex items-center gap-2">
                {isTyping ? (
                  <p className="text-[10px] md:text-xs text-primary animate-pulse font-medium">Typing...</p>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[10px] md:text-xs text-muted-foreground font-mono">ID: {otherParticipant.userCode}</p>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Call Actions */}
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
            onClick={() => startCall('audio')}
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
            onClick={() => startCall('video')}
          >
            <Video className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 md:p-4" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-4xl mx-auto min-h-full flex flex-col">
          {isLoadingHistory ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in duration-500">
              <div className="relative">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center animate-pulse">
                  <Logo showText={false} variant="square" className="h-8 w-8 opacity-50" />
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 animate-pulse">Syncing BobbleChat...</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  currentUser={currentUser}
                  onUnsend={handleUnsend}
                  onDeleteForMe={handleDeleteForMe}
                  onReply={handleReply}
                  onForward={handleForward}
                />
              ))}
              {isTyping && <TypingIndicator />}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 md:p-4 border-t bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl sticky bottom-0 z-40 w-full">
        {imagePreview && (
          <div className="max-w-4xl mx-auto mb-3 animate-in slide-in-from-bottom-2 duration-300 relative px-4">
            <div className="relative inline-block mt-4">
              <img src={imagePreview} alt="Preview" className="h-20 w-20 md:h-32 md:w-32 object-cover rounded-xl border-2 border-primary/20 shadow-lg" />
              <Button
                size="icon"
                variant="destructive"
                className="h-6 w-6 rounded-full absolute -top-2 -right-2 shadow-lg"
                onClick={() => { setImagePreview(null); setImageBlob(null); }}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {replyingTo && (
          <div className="max-w-4xl mx-auto mb-3 animate-in slide-in-from-bottom-2 duration-400 px-4">
            <div className="flex items-center gap-3 p-3 bg-primary/5 border-l-4 border-l-primary rounded-r-xl relative group mt-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-0.5 select-none">Replying to</p>
                <p className="text-sm text-foreground/80 truncate font-medium">
                  {replyingTo.text}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground transition-all"
                onClick={() => setReplyingTo(null)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <form className="flex items-center gap-2 max-w-4xl mx-auto" onSubmit={handleSendMessage}>
          <div className="flex items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
                >
                  <Paperclip className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="p-2 border-none shadow-2xl rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl mb-2 flex flex-col gap-1 w-48">
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start gap-3 rounded-xl hover:bg-primary/5 hover:text-primary w-full"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <CameraIcon className="h-4 w-4" />
                  <span className="font-medium">Camera</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start gap-3 rounded-xl hover:bg-primary/5 hover:text-primary w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="font-medium">Gallery</span>
                </Button>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
                >
                  <Smile className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="p-0 border-none shadow-2xl rounded-2xl overflow-hidden mb-2 w-[calc(100vw-2rem)] max-w-[350px]">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  autoFocusSearch={false}
                  theme={Theme.AUTO}
                  width="100%"
                  height={400}
                  lazyLoadEmojis={true}
                />
              </PopoverContent>
            </Popover>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageSelect}
          />

          <Input
            autoFocus
            placeholder={imageBlob ? "Add a caption..." : "Type a message..."}
            className="flex-1 bg-background/50 border-primary/10 focus:border-primary/30 h-10 md:h-12 text-sm md:text-base"
            value={text}
            onChange={handleInputChange}
            ref={inputRef}
          />
          <Button type="submit" size="icon" disabled={(!text.trim() && !imageBlob) || isSending} className="h-10 w-10 md:h-12 md:w-12 rounded-full shadow-lg shadow-primary/20 transition-transform active:scale-95">
            <SendHorizontal className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </form>
      </div>

      {/* Camera Capture Modal */}
      {isCameraOpen && (
        <CameraCapture
          onCapture={(blob) => {
            processSelectedImage(blob);
            setIsCameraOpen(false);
          }}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Call Overlay */}
      {callStatus !== 'idle' && (
        <CallOverlay
          type={callType}
          otherParticipant={{
            name: otherParticipant.name,
            avatar: otherParticipant.avatar
          }}
          localStream={localStream}
          remoteStream={remoteStream}
          onHangup={endCall}
          status={callStatus}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Forward Modal */}
      <ForwardModal
        message={isForwarding}
        currentUser={currentUser}
        isOpen={!!isForwarding}
        onClose={() => setIsForwarding(null)}
      />
    </div>
  );
}
