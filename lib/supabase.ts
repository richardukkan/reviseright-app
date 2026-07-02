import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cuebkjqbwblmhrwshrsv.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZWJranFid2JsbWhyd3NocnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk2NTEsImV4cCI6MjA5ODQ4NTY1MX0.Yyh7FBaYdUik9MzGMo8nZUWCsD8HcF4KCreneFjBJXs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)
