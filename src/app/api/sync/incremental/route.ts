import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

// 39 = boleta afecta, 41 = boleta exenta, 33 = factura electrónica
const TYPES = [39, 41, 33];
// Reprocesa los últimos N días para capturar cambios (devoluciones, NC, pagos)
const LOOKBACK_DAYS = 7;

interface Dte {
  id: number; folio: number; type_document: number; type_document_name: string;
  status: string; sii_status: string; start_date: string; created_at: string;
  amount_total: number; amount_neto: number; amount_iva: number; amount_exempt: number;
  real_amount_total?: number; real_amount_neto?: number; real_amount_iva?: number; real_amount_exempt?: number;
  branch_id: number; seller_id: number;
}

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  let processed = 0;

  for (const type of TYPES) {
    let page = 1;
    let stop = false;

    while (!stop) {
      const data = await relbaseFetch(`/dtes?type_document=${type}&per_page=50&page=${page}`);

      // 👇 LOGS DE DEBUG
      console.log(`[sync] type=${type} page=${page} raw:`, JSON.stringify(data).slice(0, 800));
      const dtes: Dte[] = data?.data?.dtes ?? [];
      console.log(`[sync] DTEs encontrados:`, dtes.length);
      if (dtes.length > 0) {
        console.log(`[sync] Primer DTE created_at:`, dtes[0].created_at);
        console.log(`[sync] Último DTE created_at:`, dtes[dtes.length - 1].created_at);
      }
      // 👆 FIN LOGS DE DEBUG

      if (dtes.length === 0) break;

      for (const d of dtes) {
        // Nos detenemos cuando salimos de la ventana de lookback
        if (new Date(d.created_at) < since) { stop = true; break; }

        // Upsert cabecera (con montos reales)
        await supabase.from("sales").upsert({
          id: d.id, folio: d.folio, type_document: d.type_document,
          type_document_name: d.type_document_name, status: d.status, sii_status: d.sii_status,
          issued_date: d.start_date, sold_at: d.created_at,
          amount_total: d.amount_total, amount_neto: d.amount_neto,
          amount_iva: d.amount_iva, amount_exempt: d.amount_exempt,
          real_amount_total: d.real_amount_total ?? d.amount_total,
          real_amount_neto: d.real_amount_neto ?? d.amount_neto,
          real_amount_iva: d.real_amount_iva ?? d.amount_iva,
          real_amount_exempt: d.real_amount_exempt ?? d.amount_exempt,
          branch_id: d.branch_id, seller_id: d.seller_id,
          items_synced: true,
        });

        // Refrescar detalle de items
        const detail = await relbaseFetch(`/dtes/${d.id}`);
        const products = detail?.data?.products ?? [];
        await supabase.from("sale_items").delete().eq("sale_id", d.id);
        if (products.length > 0) {
          await supabase.from("sale_items").insert(products.map((p: {
            product_id: number; name: string; code: string; price: number;
            quantity: number; unit_cost: number; tax_affected: boolean;
          }) => ({
            sale_id: d.id, product_id: p.product_id, name: p.name, code: p.code,
            price: p.price, quantity: p.quantity, unit_cost: p.unit_cost, tax_affected: p.tax_affected,
          })));
        }
        processed++;
        await new Promise((r) => setTimeout(r, 200));
      }

      const nextPage = data?.meta?.next_page;
      if (stop || !nextPage || nextPage === -1) break;
      page = nextPage;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return NextResponse.json({ ok: true, processed });
}