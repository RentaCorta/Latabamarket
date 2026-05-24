import { NextRequest, NextResponse } from "next/server";
import { saveTokens } from "@/lib/relbase-tokens";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // 1. Verificar el state (protección CSRF)
  const savedState = request.cookies.get("relbase_oauth_state")?.value;
  if (!state || state !== savedState) {
    return new NextResponse(
      "Error: el parámetro 'state' no coincide. Intenta conectar de nuevo desde /api/auth/relbase/authorize",
      { status: 400 }
    );
  }
  if (!code) {
    return new NextResponse("Error: relBase no devolvió un código de autorización.", { status: 400 });
  }

  // 2. Canjear el código por tokens
  const tokenResponse = await fetch(process.env.RELBASE_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.RELBASE_CLIENT_ID!,
      client_secret: process.env.RELBASE_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.RELBASE_REDIRECT_URI!,
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    return new NextResponse(`Error al canjear el token (${tokenResponse.status}): ${detail}`, { status: 500 });
  }

  const tokens = await tokenResponse.json();

  // 3. Guardar el token en la base de datos
  try {
    await saveTokens(tokens);
  } catch (e) {
    return new NextResponse(`Token obtenido, pero falló al guardarlo: ${(e as Error).message}`, { status: 500 });
  }

  // 4. Confirmación
  return new NextResponse(
    `<html><body style="font-family: sans-serif; padding: 2rem; line-height: 1.6; max-width: 600px;">
      <h1 style="color: #0F6E56;">Conexión guardada</h1>
      <p>El token de relBase se guardó en tu base de datos. Ahora tu app puede sincronizar datos sin reconectarse cada vez.</p>
      <p style="color: #666; font-size: 0.9rem;">Revisa la tabla <strong>relbase_tokens</strong> en el Table Editor de Supabase: deberías ver una fila nueva.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}