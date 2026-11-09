// Built into supabase-client.js for static hosting. Only a publishable key is used.
import {createClient} from '@supabase/supabase-js';
export function createSideLiteClient() {
  return createClient('https://hwwwoblfpsqqrkxvclag.supabase.co', 'sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN', {
    auth: {flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'side-lite-auth-v1'}
  });
}
