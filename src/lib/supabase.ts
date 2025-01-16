import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    fetch: async (url, options = {}) => {
      const maxRetries = 3;
      let attempt = 0;
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      while (attempt < maxRetries) {
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': accessToken ? `Bearer ${accessToken}` : '',
              'apikey': supabaseAnonKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Supabase request failed:', {
              url,
              status: response.status,
              body: errorText
            });
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
          }
          
          return response;
        } catch (error) {
          attempt++;
          if (attempt === maxRetries) {
            throw error;
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
      
      throw new Error('Max retries reached');
    }
  }
});