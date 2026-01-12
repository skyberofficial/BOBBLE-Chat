'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { supabase } from './supabase';
import {
  findUserByEmail,
  createUser,
  findUserByUsernameOrId,
  findUserByUsername,
  findUserById,
  updateUser,
  sendMessage as sendMessageData,
  generateUserCode
} from '@/lib/data';
import { revalidatePath } from 'next/cache';
import type { User, Message } from './types';
import { createClient } from '@supabase/supabase-js';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email, Username, or ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  captcha: z.string().min(1, 'CAPTCHA is required'),
  terms: z.string().refine((val) => val === 'on', 'You must accept the terms'),
});

export async function login(prevState: any, formData: FormData) {
  const identifier = formData.get('identifier') as string;
  const password = formData.get('password') as string;

  const validatedFields = loginSchema.safeParse({ identifier, password });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid input.',
    };
  }

  let email = identifier;
  if (!identifier.includes('@')) {
    const user = await findUserByUsernameOrId(identifier);
    if (user) {
      email = user.email;
    } else {
      return { message: 'User not found.' };
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { message: error?.message || 'Login failed.' };
  }

  const remember = formData.get('remember') === 'on';
  const cookieStore = await cookies();
  const maxAge = remember ? 60 * 60 * 24 * 7 : undefined; // 7 days or session

  cookieStore.set('sb-access-token', data.session.access_token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAge,
    sameSite: 'lax',
  });

  cookieStore.set('sb-refresh-token', data.session.refresh_token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAge,
    sameSite: 'lax',
  });

  // Also set the provider token if available (optional/good practice)
  if (data.session.provider_token) {
    cookieStore.set('sb-provider-token', data.session.provider_token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAge,
      sameSite: 'lax',
    });
  }

  redirect('/app');
}

export async function signup(prevState: any, formData: FormData) {
  const userCode = formData.get('userCode') as string;

  try {
    const validatedFields = signupSchema.safeParse({
      name: formData.get('name'),
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
      captcha: formData.get('captcha'),
      terms: formData.get('terms'),
    });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Invalid data provided.',
      };
    }

    const { name, username, email, password, captcha } = validatedFields.data;
    const originalCaptcha = formData.get('original_captcha') as string;

    if (captcha.toUpperCase() !== originalCaptcha.toUpperCase()) {
      return { message: 'Incorrect CAPTCHA. Please try again.' };
    }

    // Check availability
    const { data: existingUser } = await supabase.from('profiles').select('id').or(`username.eq.${username},email.eq.${email}`).single();
    if (existingUser) {
      return { message: 'Username or email already taken.' };
    }

    // SignUp with Supabase
    // The profile will be created automatically by a database trigger
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          username: username,
          user_code: userCode, // Pass userCode here so the trigger can pick it up
        }
      }
    });

    if (authError) return { message: authError.message };

    // Emit socket event for new user
    if (authData.user) {
      try {
        const io = require('socket.io-client');
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const socket = io(socketUrl);

        socket.on('connect', () => {
          socket.emit('new_user_joined', {
            id: authData.user!.id,
            name: name,
            username: username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            userCode: userCode
          });
          // Disconnect after short delay to ensure send
          setTimeout(() => socket.disconnect(), 1000);
        });
      } catch (e) {
        console.error('Failed to emit new user event:', e);
      }
    }

  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred during signup.' };
  }

  redirect('/app');
}

export async function logout() {
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete('sb-access-token');
  cookieStore.delete('sb-refresh-token');
  cookieStore.delete('sb-provider-token');
  redirect('/login');
}

export async function sendMessage(receiverId: string, content: string, senderId: string, type: string = 'text') {
  if (!content.trim()) return { success: false, error: "Content cannot be empty" };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;

    let authClient = supabase;
    if (token) {
      // Create a new client instance for this request with the user's token
      authClient = {
        ...supabase,
        from: (table: string) => {
          const queryBuilder = supabase.from(table);
          // @ts-ignore - access internal headers to inject auth
          queryBuilder.headers['Authorization'] = `Bearer ${token}`;
          return queryBuilder;
        }
      } as any;
    }

    // Better yet, just use the token in a new client if we could, 
    // but since we can't easily import createClient here without config, 
    // we'll try a simpler approach if the data function supports it. 
    // Actually, creating a fresh client is safer.

    /* 
      NOTE: Since we don't have createClient exported or easy to re-init with params without duplication, 
      let's try to pass the token to data layer or trust the RLS policies are correct. 
      Wait, RLS FAILS because no auth. 
      Let's use the `supabase.auth.setSession` approach on a fresh client instance? 
      Or simply construct the header manually as we are doing above?
      Effectively, we need `supabase.rest.headers['Authorization'] = ...` but scoped.
    */

    // Alternative: Use the global client but set the session for this scope? No, unsafe for concurrent requests.
    // We MUST create a new client.

    // Re-importing createClient to be safe
    const { createClient } = require('@supabase/supabase-js');
    const authClientReal = createClient(
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

    const message = await sendMessageData(senderId, receiverId, content, authClientReal, type);
    return { success: true, message };
  } catch (error: any) {
    console.error('Failed to send message:', error);
    return { success: false, error: error.message };
  }
}

export async function startChat(currentUserId: string, otherUserId: string) {
  // In our simplified Supabase schema, a chat is just messages between two users.
  // So "starting a chat" is just identifying the other user.
  return { success: true, conversationId: otherUserId };
}

export async function updateUserProfile(userId: string, data: any) {
  try {
    const updatedUser = await updateUser(userId, data);
    return { success: true, user: updatedUser };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function checkUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  return { isAvailable: !data };
}

export async function checkEmail(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  return { isAvailable: !data };
}

export async function searchUsers(query: string, currentUserId: string) {
  if (!query.trim()) return [];

  const searchQuery = query.trim();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${searchQuery}%,user_code.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
    .neq('id', currentUserId)
    .limit(10);

  if (error || !data) return [];
  return data.map(p => ({
    id: p.id,
    userCode: p.user_code,
    name: p.full_name || p.username,
    username: p.username,
    email: p.email,
    avatar: p.avatar_url,
    bio: p.bio,
  }));
}

export async function fetchConversationMessages(userId1: string, userId2: string, limit?: number): Promise<Message[]> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;

    if (!token) {
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

    let query = authClient
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`);

    if (limit) {
      query = query.order('created_at', { ascending: false }).limit(limit);
    } else {
      query = query.order('created_at', { ascending: true });
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    const mappedMessages = data.map((msg: any) => ({
      id: msg.id,
      senderId: msg.sender_id,
      text: msg.content,
      timestamp: new Date(msg.created_at).getTime(),
      type: msg.type || 'text'
    }));

    return limit ? mappedMessages.reverse() : mappedMessages;

  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

// Helper to extract storage path from public URL
function getStoragePathFromUrl(url: string) {
  try {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'image-bucket';
    const urlParts = url.split(`${bucket}/`);
    if (urlParts.length > 1) {
      return urlParts[1];
    }
  } catch (e) {
    console.error("Error parsing storage path:", e);
  }
  return null;
}

export async function deleteConversation(userId: string, otherUserId: string) {
  try {
    console.log(`--- Delete Conversation Started: ${userId} <-> ${otherUserId} ---`);
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;

    const { createClient } = require('@supabase/supabase-js');
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaldnmqostzgmqtyeprp.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WNtJxaQRsc7c5UckV6HhCQ_hzqGWJS4',
      {
        global: {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        },
      }
    );

    // 1. Fetch messages to check for images
    const { data: messages, error: fetchError } = await authClient
      .from('messages')
      .select('content, type')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`);

    if (fetchError) {
      console.error('Fetch error during delete:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${messages?.length || 0} messages to delete.`);

    // 2. Identify and delete image files from storage
    const imagePaths = (messages || [])
      .filter((m: any) => m.type === 'image')
      .map((m: any) => getStoragePathFromUrl(m.content))
      .filter(Boolean) as string[];

    if (imagePaths.length > 0) {
      console.log(`Deleting ${imagePaths.length} images from storage...`);
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'chat-media';
      await authClient.storage.from(bucket).remove(imagePaths);
    }

    // 3. Delete messages from database
    const { error: deleteError } = await authClient
      .from('messages')
      .delete()
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`);

    if (deleteError) {
      console.error('Delete error from DB:', deleteError);
      throw deleteError;
    }

    console.log('--- Delete Conversation Success ---');
    revalidatePath('/app', 'layout');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete conversation:', error);
    return { success: false, message: error.message };
  }
}

export async function uploadChatMedia(formData: FormData) {
  console.log('--- STORAGE UPLOAD START ---');
  try {
    const fileArg = formData.get('file') as any;
    const fileName = formData.get('fileName') as string || 'image.webp';

    if (!fileArg) {
      console.error('No file provided in FormData');
      throw new Error('No file provided');
    }

    const arrayBuffer = await fileArg.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = fileArg.type || 'image/webp';

    console.log(`Uploading file: ${fileName}, size: ${buffer.length} bytes, type: ${contentType}`);

    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;

    if (!token) {
      console.error('Authentication token missing from cookies');
      throw new Error('Not authenticated');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaldnmqostzgmqtyeprp.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WNtJxaQRsc7c5UckV6HhCQ_hzqGWJS4';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase environment variables missing in server action');
      throw new Error('Server configuration error');
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'image-bucket';
    const filePath = `private/${Date.now()}-${fileName}`;
    const { data, error } = await authClient.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error('Supabase Storage Error Details:', error);
      throw error;
    }

    const { data: { publicUrl } } = authClient.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log(`Upload successful! URL: ${publicUrl}`);
    return { publicUrl };
  } catch (error: any) {
    console.error('--- STORAGE UPLOAD FAILED ---');
    console.error(error);
    throw new Error(error.message || 'Upload failed');
  }
}

export async function unsendMessage(messageId: string, senderId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;

    if (!token) throw new Error('Not authenticated');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaldnmqostzgmqtyeprp.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WNtJxaQRsc7c5UckV6HhCQ_hzqGWJS4';

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get message to check timestamp and type
    const { data: message, error: fetchError } = await authClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) throw new Error('Message not found');
    if (message.sender_id !== senderId) throw new Error('Unauthorized');

    const messageTime = new Date(message.created_at).getTime();
    const now = Date.now();
    const diff = (now - messageTime) / 1000;

    if (diff > 30) {
      return { success: false, message: 'Unsend only available for 30 seconds.' };
    }

    // If it's an image, delete from storage
    if (message.type === 'image' && message.content) {
      const path = getStoragePathFromUrl(message.content);
      if (path) {
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'image-bucket';
        await authClient.storage.from(bucket).remove([path]);
      }
    }

    const { error: deleteError } = await authClient
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error: any) {
    console.error('Failed to unsend message:', error);
    return { success: false, message: error.message };
  }
}

export async function deleteMessageForMe(messageId: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value;

    if (!token) throw new Error('Not authenticated');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaldnmqostzgmqtyeprp.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WNtJxaQRsc7c5UckV6HhCQ_hzqGWJS4';

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Note: Since we don't have a "deleted_for" column, 
    // "delete for me" will currently delete the message globally.
    // In a full implementation, we'd need a join table or array of hidden_for_ids.

    // Get message to check for images
    const { data: message } = await authClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (message?.type === 'image' && message.content) {
      const path = getStoragePathFromUrl(message.content);
      if (path) {
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'image-bucket';
        await authClient.storage.from(bucket).remove([path]);
      }
    }

    const { error: deleteError } = await authClient
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete message:', error);
    return { success: false, message: error.message };
  }
}
