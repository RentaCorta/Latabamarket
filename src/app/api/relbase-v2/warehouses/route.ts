import { NextResponse } from "next/server";
import { relbaseV2Fetch } from "@/lib/relbase-v2";

// Lista las bodegas de la cuenta. Sirve como prueba inicial de la
// conexión OAuth v2: si esto devuelve datos, los tokens y scopes están bien.
export async function GET() {
  try {
    const data = await relbaseV2Fetch<{
      data: { resources: { id: number; name: string }[] };
      meta: { code: number; message: string };
    }>("/bodegas");
    return NextResponse.json({ ok: true, warehouses: data.data?.resources ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}