import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined') 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
            order: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') })
          })
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: new Error('Supabase not configured') })
        })
      }
    };
