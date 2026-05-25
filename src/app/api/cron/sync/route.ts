import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

const TYPES = [39, 41];
const MAX_PER_RUN = 5;

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { data: latest } = await supabase
    .from("sales").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const maxId = latest?.id ?? 0;

  let candidatas: any[] = [];
  for (const type of TYPES) {
    const data = await relbaseFetch(`/dtes?type_document=${type}&per_page=50&page=1`);
    candidatas = candidatas.concat((data?.data?.dtes ?? []).filter((d: any) => d.id > maxId));
  }
  const nuevas = candidatas.sort((a, b) => a.id - b.id).slice(0, MAX_PER_RUN);

  for (const d of nuevas) {
    await supabase.from("sales").upsert({
      id: d.id, folio: d.folio, type_document: d.type_document,
      type_document_name: d.type_document_name, status: d.status, sii_status: d.sii_status,
      issued_date: d.start_date, sold_at: d.created_at,
      amount_total: d.amount_total, amount_neto: d.amount_neto,
      amount_iva: d.amount_iva, amount_exempt: d.amount_exempt,
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
    await new Promise((r) => setTimeout(r, 200));
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
  return NextResponse.json({ ok: true, synced: nuevas.length });
}