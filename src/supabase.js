import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('tu-proyecto') &&
  !supabaseAnonKey.includes('tu-clave')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;

/**
 * Inicializa o recupera la sesión anónima del usuario.
 * Si el usuario no tiene una sesión activa, crea una automáticamente con signInAnonymously().
 */
export async function getOrCreateAnonymousSession() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase no está configurado. Por favor, define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env');
  }

  // 1. Verificar si ya existe una sesión activa persistida en localStorage
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error al obtener la sesión:', sessionError);
    throw sessionError;
  }

  if (session && session.user) {
    return session.user;
  }

  // 2. Si no hay sesión, iniciar sesión de forma anónima
  const { data: authData, error: signInError } = await supabase.auth.signInAnonymously();

  if (signInError) {
    console.error('Error en autenticación anónima:', signInError);
    throw signInError;
  }

  return authData.user;
}

/**
 * Cierra la sesión anónima actual para permitir simular un nuevo usuario (útil para pruebas de RLS)
 */
export async function resetAnonymousSession() {
  if (!supabase) return null;
  await supabase.auth.signOut();
  return await getOrCreateAnonymousSession();
}
