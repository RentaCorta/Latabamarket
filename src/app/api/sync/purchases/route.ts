import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

// Limpia nombres repetidos como "COMERCIAL CCU S.A.COMERCIAL CCU S.A...."
const cleanName = (n: string) => (n || "").replace(/^(.{4,}?)\1+$/, "$1").trim();

export async function GET() {
  let page = 1, imported = 0;
  while (true) {
    const data = await relbaseFetch(`/compras?per_page=50&page=${page}`);
    const compras = data?.data?.compras ?? [];
    if (compras.length === 0) break;

    const rows = compras.map((c: any) => ({
      id: c.id, provider_id: c.provider_id, provider_name: cleanName(c.provider_name),
      provider_rut: c.provider_rut, folio: c.folio,
      type_document: c.type_document, type_document_name: c.type_document_name,
      status: c.status, status_payment: c.status_payment,
      issued_date: c.start_date, bought_at: c.created_at,
      amount_total: c.amount_total, amount_neto: c.amount_neto,
      amount_iva: c.amount_iva, amount_exempt: c.amount_exempt,
    }));
    const { error } = await supabase.from("purchases").upsert(rows);
    if (error) return NextResponse.json({ ok: false, error: error.message, imported }, { status: 500 });
    imported += rows.length;

    const nextPage = data?.meta?.next_page;
    if (!nextPage || nextPage === -1) break;
    page = nextPage;
    await new Promise((r) => setTimeout(r, 250));
  }
  return NextResponse.json({ ok: true, imported });
}