import { createClient } from "@supabase/supabase-js";

   // Cliente de Supabase para uso en el servidor.
   // Usa la llave secret, que tiene acceso total y nunca llega al navegador.
   export const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SECRET_KEY!,
     {
       auth: { persistSession: false },
     }
   );