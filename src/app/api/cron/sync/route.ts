import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

const TYPES = [39, 41, 33, 34];
const LOOKBACK_DAYS = 2;

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
    let pagesChecked = 0;

    while (pagesChecked < 3) {
      const data = await relbaseFetch(`/dtes?type_document=${type}&per_page=50&page=${page}`);
      const dtes = data?.data?.dtes ?? [];
      if (dtes.length === 0) break;

      for (const d of dtes) {
        if (new Date(d.created_at) < since) continue;

        // Traemos el detalle SIEMPRE (para items Y para montos reales correctos)
        const detail = await relbaseFetch(`/dtes/${d.id}`);
        const det = detail?.data ?? {};

        await supabase.from("sales").upsert({
          id: d.id, folio: d.folio, type_document: d.type_document,
          type_document_name: d.type_document_name, status: d.status, sii_status: d.sii_status,
          issued_date: d.start_date, sold_at: d.created_at,
          amount_total: d.amount_total, amount_neto: d.amount_neto,
          amount_iva: d.amount_iva, amount_exempt: d.amount_exempt,
          // Montos REALES desde el detalle (no del listado, que no descuenta devoluciones)
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
        await new Promise((r) => setTimeout(r, 120));
      }

      const nextPage = data?.meta?.next_page;
      if (!nextPage || nextPage === -1) break;
      page = nextPage;
      pagesChecked++;
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  // Compras nuevas (solo cabeceras)
  const { data: lastP } = await supabase.from("purchases").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const maxPid = lastP?.id ?? 0;
  const cdata = await relbaseFetch(`/compras?per_page=50&page=1`);
  const nuevasC = (cdata?.data?.compras ?? []).filter((c: any) => c.id > maxPid);
  if (nuevasC.length > 0) {
    await supabase.from("purchases").upsert(nuevasC.map((c: any) => ({
      id: c.id, provider_id: c.provider_id, provider_name: c.provider_name, provider_rut: c.provider_rut,
      issued_date: c.start_date, type_document: c.type_document, type_document_name: c.type_document_name,
      status: c.status, status_payment: c.status_payment,
      amount_total: c.amount_total, amount_neto: c.amount_neto, amount_iva: c.amount_iva, amount_exempt: c.amount_exempt,
    })));
  }

  return NextResponse.json({ ok: true, synced: processed });
}