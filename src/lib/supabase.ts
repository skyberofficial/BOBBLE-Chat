import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaldnmqostzgmqtyeprp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WNtJxaQRsc7c5UckV6HhCQ_hzqGWJS4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
