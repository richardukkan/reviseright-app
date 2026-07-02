import { createClient } from '@supabase/supabase-js'

const URL = 'https://cuebkjqbwblmhrwshrsv.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZWJranFid2JsbWhyd3NocnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDk2NTEsImV4cCI6MjA5ODQ4NTY1MX0.Yyh7FBaYdUik9MzGMo8nZUWCsD8HcF4KCreneFjBJXs'

export const supabase = createClient(URL, KEY)

export const supabaseAdmin = createClient(
  URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? KEY
)
