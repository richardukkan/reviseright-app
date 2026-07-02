import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://cuebkjqbwblmhrwshrsv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZWJranFid2JsbWhyd3NocnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk2NTEsImV4cCI6MjA5ODQ4NTY1MX0.Yyh7FBaYdUik9MzGMo8nZUWCsD8HcF4KCreneFjBJXs'
)

export const supabaseAdmin = createClient(
  'https://cuebkjqbwblmhrwshrsv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)
