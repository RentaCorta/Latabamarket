import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const foliosBuscados = [232536, 232665];
  let target: any = null;

  // Buscamos en hasta 20 páginas (1000 boletas)
  for (let page = 1; page <= 20 && !target; page++) {
    const list = await relbaseFetch(`/dtes?type_document=39&per_page=50&page=${page}`);
    const dtes = list?.data?.dtes ?? [];
    target = dtes.find((d: any) => foliosBuscados.includes(d.folio));
    if (dtes.length === 0) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!target) {
    return NextResponse.json({ ok: false, error: "No encontré las boletas en las primeras 20 páginas" });
  }

  const detail = await relbaseFetch(`/dtes/${target.id}`);

  return NextResponse.json({
    ok: true,
    folio: target.folio,
    desde_listado: {
      amount_total: target.amount_total,
      real_amount_total: target.real_amount_total,
    },
    desde_detalle: {
      amount_total: detail?.data?.amount_total,
      real_amount_total: detail?.data?.real_amount_total,
      todos_los_campos: detail?.data,
    },
  });
}