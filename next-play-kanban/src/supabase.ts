import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iouusmjemxqkjnefnjjw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvdXVzbWplbXhxa2puZWZuamp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDA1NjgsImV4cCI6MjA5MTYxNjU2OH0.kqWq0yZoGiwsQCsTAsTWwv4_fB2nBiXEod8MfXRi2_M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)