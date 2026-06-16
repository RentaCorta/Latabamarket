import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta el parámetro ?id=" });
  }

  const detail = await relbaseFetch(`/dtes/${id}`);
  const d = detail?.data;

  return NextResponse.json({
    ok: true,
    id,
    folio: d?.folio,
    status: d?.status,
    sii_status: d?.sii_status,
    amount_total: d?.amount_total,
    real_amount_total: d?.real_amount_total,
    real_amount_exempt: d?.real_amount_exempt,
    references: d?.references,
    dte_children: d?.dte_children,
  });
}