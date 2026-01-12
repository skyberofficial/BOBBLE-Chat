import { supabase } from './supabase';
import { findUserById } from '@/lib/data';
import type { User } from './types';

import { cookies } from 'next/headers';

export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return null;
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  const profile = await findUserById(user.id);

  return profile || null;
}

export async function signOut() {
  await supabase.auth.signOut();
}
