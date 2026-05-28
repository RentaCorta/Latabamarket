import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

const AUTHORIZE_URL = "https://api.relbase.cl/oauth/authorize";

const SCOPES = [
  "products:read",
  "products:write",
  "providers:read",
  "providers:write",
  "inventory:read",
  "inventory:write",
  "warehouses:read",
  "documents:read",
].join(" ");

// Inicia el flujo OAuth v2. Genera un state aleatorio, lo guarda en
// cookie y redirige a Relbase. Cuando vuelva al callback validamos el state.
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.RELBASE_V2_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.RELBASE_V2_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  // Cookie temporal con el state (anti-CSRF). Vive 10 minutos.
  response.cookies.set("relbase_v2_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}