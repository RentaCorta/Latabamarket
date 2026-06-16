import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

const TYPES = [39, 41, 33, 34];
const MAX_PAGES = 60; // suficiente para varios días

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // Rango de fechas por parámetro (YYYY-MM-DD). Por defecto: hoy.
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!fromStr || !toStr) {
    return NextResponse.json({ ok: false, error: "Faltan parámetros ?from=YYYY-MM-DD&to=YYYY-MM-DD" });
  }
  // Comparamos por fecha de emisión (start_date), que es la fecha del documento
  const from = fromStr; // ej "2026-06-09"
  const to = toStr;     // ej "2026-06-09"

  let processed = 0;
  const debug: Record<string, number> = {};

  for (const type of TYPES) {
    let page = 1;
    while (page <= MAX_PAGES) {
      const data = await relbaseFetch(`/dtes?type_document=${type}&per_page=50&page=${page}`);
      const dtes = data?.data?.dtes ?? [];
      if (dtes.length === 0) break;

      for (const d of dtes) {
        const fecha = d.start_date; // YYYY-MM-DD
        // Solo procesar los que caen dentro del rango pedido
        if (fecha < from || fecha > to) continue;

        // Leer el detalle para obtener montos reales correctos (devoluciones)
        const detail = await relbaseFetch(`/dtes/${d.id}`);
        const det = detail?.data ?? d;

        await supabase.from("sales").upsert({
          id: d.id, folio: d.folio, type_document: d.type_document,
          type_document_name: d.type_document_name, status: det.status ?? d.status,
          sii_status: det.sii_status ?? d.sii_status,
          issued_date: d.start_date, sold_at: d.created_at,
          amount_total: d.amount_total, amount_neto: d.amount_neto,
          amount_iva: d.amount_iva, amount_exempt: d.amount_exempt,
          real_amount_total: det.real_amount_total ?? d.amount_total,
          real_amount_neto: det.real_amount_neto ?? d.amount_neto,
          real_amount_iva: det.real_amount_iva ?? d.amount_iva,
          real_amount_exempt: det.real_amount_exempt ?? d.amount_exempt,
          branch_id: d.branch_id, seller_id: d.seller_id,
          items_synced: true,
        });

        const products = det.products ?? [];
        await supabase.from("sale_items").delete().eq("sale_id", d.id);
        if (products.length > 0) {
          await supabase.from("sale_items").insert(products.map((p: any) => ({
            sale_id: d.id, product_id: p.product_id, name: p.name, code: p.code,
            price: p.price, quantity: p.quantity, unit_cost: p.unit_cost, tax_affected: p.tax_affected,
          })));
        }

        processed++;
        debug[`tipo_${type}`] = (debug[`tipo_${type}`] ?? 0) + 1;
        await new Promise((r) => setTimeout(r, 60));
      }

      const nextPage = data?.meta?.next_page;
      if (!nextPage || nextPage === -1) break;
      page = nextPage;
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  return NextResponse.json({ ok: true, range: { from, to }, processed, debug });
}