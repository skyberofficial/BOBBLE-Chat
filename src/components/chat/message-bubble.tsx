import React, { useState, useRef, useEffect } from 'react';
import type { Message, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Phone,
  Video,
  PhoneMissed,
  MoreVertical,
  Reply,
  Forward,
  Trash2,
  Undo2,
  Check,
  CheckCheck,
  Eye,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ImageViewer } from './image-viewer';

interface MessageBubbleProps {
  message: Message;
  currentUser: User;
  onUnsend?: (messageId: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
}

export function MessageBubble({
  message,
  currentUser,
  onUnsend,
  onDeleteForMe,
  onReply,
  onForward
}: MessageBubbleProps) {
  const isCurrentUser = message.senderId === currentUser.id;
  const [isLongPressed, setIsLongPressed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isViewingImage, setIsViewingImage] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDownload = async () => {
    try {
      const response = await fetch(message.text);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bubblechat-image-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const canUnsend = isCurrentUser && (Date.now() - new Date(message.timestamp).getTime()) < 30000;

  const handlePointerDown = () => {
    pressTimerRef.current = setTimeout(() => {
      setIsLongPressed(true);
      setShowMenu(true);
    }, 500); // 500ms for long press
  };

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (isLongPressed) {
      const timer = setTimeout(() => setIsLongPressed(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLongPressed]);

  if (message.type && message.type !== 'text' && message.type !== 'image') {
    const isMissed = message.type.includes('missed');
    const isVideo = message.type.includes('video');

    return (
      <div className="flex justify-center my-4 animate-in fade-in duration-700">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 border border-border/50 backdrop-blur-sm shadow-sm">
          {isMissed ? (
            <PhoneMissed className="h-4 w-4 text-red-500" />
          ) : isVideo ? (
            <Video className="h-4 w-4 text-primary" />
          ) : (
            <Phone className="h-4 w-4 text-primary" />
          )}
          <span className="text-xs font-medium text-muted-foreground italic">
            {message.text}
          </span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">
            {format(message.timestamp, 'HH:mm')}
          </span>
        </div>
      </div>
    );
  }

  const isImage = message.type === 'image' ||
    (typeof message.text === 'string' && message.text.startsWith('http') &&
      (message.text.includes('/storage/v1/object/public/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(message.text)));

  return (
    <div
      className={cn(
        'group flex items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500',
        isCurrentUser ? 'justify-end' : 'justify-start'
      )}
    >
      <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
        <DropdownMenuTrigger asChild>
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => isImage && setIsViewingImage(true)}
            className={cn(
              'max-w-[70%] rounded-2xl shadow-sm overflow-hidden cursor-pointer transition-all duration-300 relative',
              isCurrentUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground border border-border/50',
              isImage ? 'p-1' : 'px-4 py-2.5',
              isLongPressed && 'scale-[0.98] opacity-90 brightness-95'
            )}
          >
            {isImage ? (
              <div className="relative group/img">
                <img
                  src={message.text}
                  alt="Shared image"
                  className="max-h-[300px] w-full object-cover rounded-xl transition-opacity group-hover/img:opacity-90"
                />
                <p className={cn(
                  "absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10",
                )}>
                  {format(message.timestamp, 'HH:mm')}
                </p>
              </div>
            ) : (
              <>
                {message.text.startsWith('> ') && message.text.includes('\n\n') ? (
                  <div className="space-y-2">
                    <div className={cn(
                      "p-2 rounded-lg border-l-4 text-xs mb-1",
                      isCurrentUser
                        ? "bg-black/10 border-primary-foreground/30 text-primary-foreground/80"
                        : "bg-primary/5 border-primary/30 text-foreground/70"
                    )}>
                      {message.text.split('\n\n')[0].substring(2)}
                    </div>
                    <p className="text-sm break-all whitespace-pre-wrap">
                      {message.text.split('\n\n').slice(1).join('\n\n')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm break-all whitespace-pre-wrap">{message.text}</p>
                )}
                {isCurrentUser ? (
                  <span className="flex items-center space-x-0.5">
                    {message.status === 'read' ? (
                      <CheckCheck className="h-4 w-4 text-emerald-500" />
                    ) : message.status === 'delivered' ? (
                      <CheckCheck className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Check className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={cn("text-[10px]", "text-primary-foreground/70")}> {format(message.timestamp, 'HH:mm')} </span>
                  </span>
                ) : (
                  <p className={cn(
                    "text-[10px] mt-1 text-right",
                    "text-muted-foreground/70"
                  )}>
                    {format(message.timestamp, 'HH:mm')}
                  </p>
                )}
              </>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isCurrentUser ? "end" : "start"} className="w-56 p-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-primary/20 shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200">
          {isImage && (
            <>
              <DropdownMenuItem onClick={() => setIsViewingImage(true)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer font-bold text-xs uppercase tracking-widest">
                <Eye className="h-4 w-4" />
                View Full Version
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} className="flex items-center gap-3 px-3 py-2.5 rounded-xl focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer font-bold text-xs uppercase tracking-widest">
                <Download className="h-4 w-4" />
                Save to Device
              </DropdownMenuItem>
              <div className="my-1 h-px bg-primary/10" />
            </>
          )}
          <DropdownMenuItem onClick={() => onReply?.(message)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer font-bold text-xs uppercase tracking-widest">
            <Reply className="h-4 w-4" />
            Reply
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onForward?.(message)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer font-bold text-xs uppercase tracking-widest">
            <Forward className="h-4 w-4" />
            Forward
          </DropdownMenuItem>

          <div className="my-1 h-px bg-primary/10" />

          <DropdownMenuItem onClick={() => onDeleteForMe?.(message.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl focus:bg-destructive/10 focus:text-destructive transition-colors cursor-pointer font-bold text-xs uppercase tracking-widest">
            <Trash2 className="h-4 w-4" />
            Delete For Me
          </DropdownMenuItem>

          {canUnsend && (
            <DropdownMenuItem onClick={() => onUnsend?.(message.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-destructive/5 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors cursor-pointer font-bold text-xs uppercase tracking-widest">
              <Undo2 className="h-4 w-4" />
              Unsend
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isImage && (
        <ImageViewer
          src={message.text}
          isOpen={isViewingImage}
          onClose={() => setIsViewingImage(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
