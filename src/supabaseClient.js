import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://qxwzgvkrppwdwbjkkxhx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4d3pndmtycHB3ZHdiamtreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTMzMTMsImV4cCI6MjA4ODU2OTMxM30.GUIO0UEK4JyPleVc2fLTw85m0bRZGruBcDF4ne-1pYk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);