import type { User, Conversation, Message } from '@/lib/types';
import { supabase } from './supabase';

// Helper to generate a 10-digit ID
export const generateUserCode = (): string => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// --- Data Access Functions ---

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return undefined;
  return mapProfileToUser(data);
}

export async function findUserByUsername(username: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) return undefined;
  return mapProfileToUser(data);
}

export async function findUserById(id: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;
  return mapProfileToUser(data);
}

export async function findUserByUsernameOrId(identifier: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.eq."${identifier}",user_code.eq."${identifier}"`)
    .single();

  if (error || !data) return undefined;
  return mapProfileToUser(data);
}

function mapProfileToUser(data: any): User {
  return {
    id: data.id,
    userCode: data.user_code,
    name: data.full_name || data.username,
    username: data.username,
    email: data.email,
    avatar: data.avatar_url,
    bio: data.bio || '',
  };
}

export async function createUser(id: string, email: string, name: string, username: string, userCode: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id,
      email,
      full_name: name,
      username,
      user_code: userCode,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
    }])
    .select()
    .single();

  if (error) throw error;
  return mapProfileToUser(data);
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  const supabaseUpdates: any = {};
  if (updates.name) supabaseUpdates.full_name = updates.name;
  if (updates.username) supabaseUpdates.username = updates.username;
  if (updates.avatar) supabaseUpdates.avatar_url = updates.avatar;
  if (updates.bio) supabaseUpdates.bio = updates.bio;

  const { data, error } = await supabase
    .from('profiles')
    .update(supabaseUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return null;
  return mapProfileToUser(data);
}

export async function getConversationsForUser(userId: string, supabaseClient?: any): Promise<Conversation[]> {
  // Bubbe Link uses messages table directly for real-time. 
  // We'll fetch the list of people the user has chatted with.
  const client = supabaseClient || supabase;
  const { data: messages, error } = await client
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !messages) return [];

  const conversationMap = new Map<string, Conversation>();

  for (const msg of messages) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (!conversationMap.has(otherId)) {
      const otherUser = await findUserById(otherId);
      if (otherUser) {
        conversationMap.set(otherId, {
          id: otherId, // Using otherId as conversation ID for simplicity in 1-on-1
          participantIds: [userId, otherId],
          participants: [otherUser],
          messages: [],
          unreadCount: 0
        });
      }
    }
    const conv = conversationMap.get(otherId);
    if (conv) {
      // Set last message if not set (first one found is latest because query is DESC)
      if (!conv.lastMessage) {
        conv.lastMessage = {
          id: msg.id,
          senderId: msg.sender_id,
          text: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          type: msg.type || 'text'
        };
      }

      // Count unread messages
      // Check for 'is_read' or 'read' column (Supabase/Postgres convention)
      const isRead = msg.is_read === true || msg.read === true;
      if (msg.receiver_id === userId && !isRead) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
    }
  }

  const conversations = Array.from(conversationMap.values());
  // Sort by last message timestamp desc
  conversations.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));

  return conversations;
}

export async function searchUsers(query: string, currentUserId: string): Promise<User[]> {
  if (!query.trim()) return [];
  const searchQuery = query.trim();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${searchQuery}%,user_code.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
    .neq('id', currentUserId)
    .limit(10);

  if (error || !data) return [];
  return data.map(mapProfileToUser);
}

export async function getMessages(userId1: string, userId2: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map(msg => ({
    id: msg.id,
    senderId: msg.sender_id,
    text: msg.content,
    timestamp: new Date(msg.created_at).getTime(),
    type: msg.type || 'text'
  }));
}

export async function sendMessage(senderId: string, receiverId: string, content: string, supabaseClient?: any, type: string = 'text'): Promise<Message> {
  const client = supabaseClient || supabase;

  const insertData: any = {
    sender_id: senderId,
    receiver_id: receiverId,
    content: content,
    type: type,
  };

  // Try with 'type' first
  try {
    const { data: dataWithId, error: errorWithId } = await client
      .from('messages')
      .insert([insertData])
      .select()
      .single();

    if (errorWithId) {
      // If it's a "column does not exist" error, fallback to text only
      if (errorWithId.code === '42703' || errorWithId.message?.includes('Could not find the \'type\' column')) {
        console.warn('Database "messages" table is missing the "type" column. Falling back to plain text content.');
        delete insertData.type;
        const { data: retryData, error: retryError } = await client
          .from('messages')
          .insert([insertData])
          .select()
          .single();

        if (retryError) throw retryError;
        return mapDbMessageToAppMessage(retryData);
      }
      throw errorWithId;
    }
    return mapDbMessageToAppMessage(dataWithId);
  } catch (error) {
    console.error('CRITICAL: Failed to save message to database:', error);
    throw error;
  }
}

function mapDbMessageToAppMessage(dbMsg: any): Message {
  return {
    id: dbMsg.id,
    senderId: dbMsg.sender_id,
    text: dbMsg.content,
    timestamp: new Date(dbMsg.created_at).getTime(),
    type: dbMsg.type || 'text',
    status: (dbMsg.read || dbMsg.is_read) ? 'read' : 'sent'
  };
}
