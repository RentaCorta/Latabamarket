import { NextResponse } from "next/server";
   import { randomBytes } from "crypto";

   export async function GET() {
     // Generamos un "state" aleatorio para protección CSRF.
     // Lo verificaremos cuando relBase nos devuelva al usuario.
     const state = randomBytes(16).toString("hex");

     const params = new URLSearchParams({
       client_id: process.env.RELBASE_CLIENT_ID!,
       redirect_uri: process.env.RELBASE_REDIRECT_URI!,
       response_type: "code",
       scope: "documents:read products:read webhooks:read webhooks:write",
       state,
     });

     const authorizeUrl = `${process.env.RELBASE_AUTH_URL}?${params.toString()}`;

     const response = NextResponse.redirect(authorizeUrl);

     // Guardamos el state en una cookie segura para compararlo después.
     response.cookies.set("relbase_oauth_state", state, {
       httpOnly: true,
       secure: true,
       sameSite: "lax",
       maxAge: 600,
       path: "/",
     });

     return response;
   }