export type User = {
  id: string; // Supabase UUID
  userCode: string; // 10-digit unique user code
  name: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type?: 'text' | 'image' | 'call_voice' | 'call_video' | 'call_missed_voice' | 'call_missed_video';
  status?: 'sent' | 'delivered' | 'read';
};

export type Conversation = {
  id: string;
  participantIds: string[];
  participants: User[];
  messages: Message[];
  lastMessage?: Message;
  unreadCount?: number;
};
