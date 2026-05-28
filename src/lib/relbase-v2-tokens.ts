import { supabase } from "./supabase";

const TOKEN_URL = "https://api.relbase.cl/oauth/token";

interface TokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

// Lee el token actual desde Supabase. Si no existe, lanza error
// (caso típico: aún no se ha completado el flujo OAuth inicial).
async function getStoredToken(): Promise<TokenRow> {
  const { data, error } = await supabase
    .from("relbase_v2_tokens")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(`relbase_v2_tokens: ${error.message}`);
  if (!data) throw new Error("No hay token v2. Visita /api/auth/relbase-v2/authorize para conectar.");
  return data;
}

// Guarda el nuevo par de tokens. Importante: cada refresh genera
// un par NUEVO y el anterior queda revocado. Hay que guardar siempre el más reciente.
async function saveToken(t: TokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();
  const { error } = await supabase
    .from("relbase_v2_tokens")
    .upsert({
      id: "default",
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: expiresAt,
      scope: t.scope,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`saveToken: ${error.message}`);
}

// Hace refresh y devuelve el nuevo access_token.
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.RELBASE_V2_CLIENT_ID!,
    client_secret: process.env.RELBASE_V2_CLIENT_SECRET!,
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Refresh v2 falló (${res.status}): ${detail}`);
  }
  const data: TokenResponse = await res.json();
  await saveToken(data);
  return data.access_token;
}

// Devuelve un access_token válido. Si está por expirar (< 60s),
// lo refresca automáticamente antes de devolverlo.
export async function getValidV2Token(): Promise<string> {
  const stored = await getStoredToken();
  const msUntilExpiry = new Date(stored.expires_at).getTime() - Date.now();
  if (msUntilExpiry < 60_000) {
    return refreshAccessToken(stored.refresh_token);
  }
  return stored.access_token;
}

// Helper para el callback OAuth: intercambia el code por tokens iniciales.
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.RELBASE_V2_CLIENT_ID!,
    client_secret: process.env.RELBASE_V2_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.RELBASE_V2_REDIRECT_URI!,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Exchange v2 falló (${res.status}): ${detail}`);
  }
  const data: TokenResponse = await res.json();
  await saveToken(data);
  return data;
}