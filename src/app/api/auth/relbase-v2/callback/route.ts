import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/relbase-v2-tokens";

// Callback OAuth v2. Relbase nos redirige acá con ?code=... y ?state=...
// Validamos el state contra la cookie, intercambiamos el code por tokens
// y los guardamos en Supabase.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.json({ ok: false, error: `Relbase devolvió error: ${errorParam}` }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: "Falta el parámetro 'code'" }, { status: 400 });
  }

  // Validar state contra la cookie
  const cookieState = request.headers.get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("relbase_v2_oauth_state="))
    ?.split("=")[1];

  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ ok: false, error: "State inválido (posible CSRF)" }, { status: 400 });
  }

  try {
    await exchangeCodeForTokens(code);
    const response = NextResponse.json({
      ok: true,
      message: "✓ Conexión OAuth v2 establecida. Tokens guardados.",
      next_step: "Visita /api/relbase-v2/warehouses para probar.",
    });
    // Limpiamos la cookie de state
    response.cookies.delete("relbase_v2_oauth_state");
    return response;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}