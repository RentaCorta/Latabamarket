import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

const TYPES = [41, 33]; // solo exentas y facturas, que son las que faltan
const LOOKBACK_DAYS = 35; // todo el mes y un poco más

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  let processed = 0;

  for (const type of TYPES) {
    let page = 1;
    let stop = false;

    while (!stop) {
      const data = await relbaseFetch(`/dtes?type_document=${type}&per_page=50&page=${page}`);
      const dtes = data?.data?.dtes ?? [];
      if (dtes.length === 0) break;

      for (const d of dtes) {
        if (new Date(d.created_at) < since) { stop = true; break; }

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

        const detail = await relbaseFetch(`/dtes/${d.id}`);
        const products = detail?.data?.products ?? [];
        await supabase.from("sale_items").delete().eq("sale_id", d.id);
        if (products.length > 0) {
          await supabase.from("sale_items").insert(products.map((p: any) => ({
            sale_id: d.id, product_id: p.product_id, name: p.name, code: p.code,
            price: p.price, quantity: p.quantity, unit_cost: p.unit_cost, tax_affected: p.tax_affected,
          })));
        }
        processed++;
        await new Promise((r) => setTimeout(r, 100));
      }

      const nextPage = data?.meta?.next_page;
      if (stop || !nextPage || nextPage === -1) break;
      page = nextPage;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return NextResponse.json({ ok: true, processed });
}