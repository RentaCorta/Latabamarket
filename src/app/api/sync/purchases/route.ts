import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

const DAYS = 90;

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  let imported = 0;
  let page = 1;
  let stop = false;

  while (!stop) {
    const data = await relbaseFetch(`/compras?per_page=50&page=${page}`);
    const compras = data?.data?.compras ?? [];
    if (compras.length === 0) break;

    const rows = [];
    for (const c of compras) {
      if (new Date(c.created_at) < since) { stop = true; break; }
      rows.push({
        id: c.id, provider_id: c.provider_id, provider_name: c.provider_name, provider_rut: c.provider_rut,
        issued_date: c.start_date, type_document: c.type_document, type_document_name: c.type_document_name,
        status: c.status, status_payment: c.status_payment,
        amount_total: c.amount_total, amount_neto: c.amount_neto, amount_iva: c.amount_iva, amount_exempt: c.amount_exempt,
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("purchases").upsert(rows);
      if (error) return NextResponse.json({ ok: false, error: error.message, imported }, { status: 500 });
      imported += rows.length;
    }

    const nextPage = data?.meta?.next_page;
    if (!nextPage || nextPage === -1) break;
    page = nextPage;
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({ ok: true, imported });
}