import { supabase } from "./supabase";

type RelbaseTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

export async function saveTokens(tokens: RelbaseTokenResponse) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await supabase.from("relbase_tokens").upsert({
    provider: "relbase",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`No se pudo guardar el token en Supabase: ${error.message}`);
  }
}

async function readTokenRow() {
  const { data, error } = await supabase
    .from("relbase_tokens")
    .select("*")
    .eq("provider", "relbase")
    .single();

  if (error || !data) {
    throw new Error("No hay token guardado. Conecta tu cuenta de relBase primero.");
  }
  return data;
}

async function refreshTokens(refreshToken: string): Promise<string> {
  const response = await fetch(process.env.RELBASE_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.RELBASE_CLIENT_ID!,
      client_secret: process.env.RELBASE_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo renovar el token (${response.status}): ${detail}`);
  }

  const tokens = (await response.json()) as RelbaseTokenResponse;
  // Guardamos el par NUEVO (el anterior queda revocado)
  await saveTokens(tokens);
  return tokens.access_token;
}

// Devuelve un access_token válido, renovándolo si está por expirar.
export async function getValidToken(): Promise<string> {
  const row = await readTokenRow();
  const expiresAt = new Date(row.expires_at).getTime();

  // Margen de 60s: si está por expirar, lo renovamos antes de usarlo.
  if (Date.now() >= expiresAt - 60_000) {
    return await refreshTokens(row.refresh_token);
  }
  return row.access_token;
}