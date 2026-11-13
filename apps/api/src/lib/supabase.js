import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
}

// Cliente con service role: solo accesible desde el backend.
// El backend valida JWT propio antes de cada consulta, nunca se expone al front.
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
