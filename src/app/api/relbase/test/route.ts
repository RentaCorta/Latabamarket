import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";

export async function GET() {
  try {
    const data = await relbaseFetch("/productos?per_page=1");
    return NextResponse.json({
      ok: true,
      productos_totales: data?.meta?.total_count ?? null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}