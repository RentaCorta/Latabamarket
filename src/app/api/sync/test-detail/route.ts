import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const ids = [48297142, 48332990]; // folios 232536 y 232665
  const resultados = [];

  for (const id of ids) {
    const detail = await relbaseFetch(`/dtes/${id}`);
    const d = detail?.data;
    resultados.push({
      id,
      folio: d?.folio,
      amount_total: d?.amount_total,
      real_amount_total: d?.real_amount_total,
      real_amount_neto: d?.real_amount_neto,
      // mostramos todas las claves disponibles para inspeccionar
      claves_disponibles: d ? Object.keys(d) : [],
      objeto_completo: d,
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({ ok: true, resultados });
}