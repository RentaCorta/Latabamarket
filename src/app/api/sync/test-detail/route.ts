import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // Buscamos el id de la boleta folio 232536 (la que tiene devolución)
  const list = await relbaseFetch(`/dtes?type_document=39&per_page=50&page=1`);
  const dtes = list?.data?.dtes ?? [];
  const target = dtes.find((d: any) => d.folio === 232536) ?? dtes.find((d: any) => d.folio === 232665);

  if (!target) {
    return NextResponse.json({ ok: false, error: "No encontré la boleta en la página 1, puede estar más atrás" });
  }

  // Traemos el detalle individual
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
      // incluimos el objeto completo para inspeccionar todos los campos de monto
      todos_los_campos: detail?.data,
    },
  });
}