import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

// 39 = boleta afecta, 41 = boleta exenta, 33 = factura electrónica
const TYPES = [39, 41, 33];
const DAYS = 90;

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  let imported = 0;

  for (const type of TYPES) {
    let page = 1;
    let stop = false;
    while (!stop) {
      const data = await relbaseFetch(`/dtes?type_document=${type}&per_page=50&page=${page}`);
      const dtes = data?.data?.dtes ?? [];
      if (dtes.length === 0) break;

      const rows = [];
      for (const d of dtes) {
        if (new Date(d.created_at) < since) { stop = true; break; }
        rows.push({
          id: d.id, folio: d.folio, type_document: d.type_document,
          type_document_name: d.type_document_name, status: d.status, sii_status: d.sii_status,
          issued_date: d.start_date, sold_at: d.created_at,
          amount_total: d.amount_total, amount_neto: d.amount_neto,
          amount_iva: d.amount_iva, amount_exempt: d.amount_exempt,
          // Montos reales (con devoluciones / notas de crédito descontadas).
          // Si la API no los trae, caemos al monto original.
          real_amount_total: d.real_amount_total ?? d.amount_total,
          real_amount_neto: d.real_amount_neto ?? d.amount_neto,
          real_amount_iva: d.real_amount_iva ?? d.amount_iva,
          real_amount_exempt: d.real_amount_exempt ?? d.amount_exempt,
          branch_id: d.branch_id, seller_id: d.seller_id,
        });
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("sales").upsert(rows);
        if (error) return NextResponse.json({ ok: false, error: error.message, imported }, { status: 500 });
        imported += rows.length;
      }

      const nextPage = data?.meta?.next_page;
      if (!nextPage || nextPage === -1) break;
      page = nextPage;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return NextResponse.json({ ok: true, imported });
}