import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

const TYPE_BOLETA = 39;
const MAX_PER_RUN = 5; // límite para no pasar el timeout de 10s de Vercel

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { data: latest } = await supabase
    .from("sales").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const maxId = latest?.id ?? 0;

  const data = await relbaseFetch(`/dtes?type_document=${TYPE_BOLETA}&per_page=50&page=1`);
  const nuevas = (data?.data?.dtes ?? []).filter((d: any) => d.id > maxId).slice(0, MAX_PER_RUN);

  for (const d of nuevas) {
    await supabase.from("sales").upsert({
      id: d.id, folio: d.folio, type_document: d.type_document,
      type_document_name: d.type_document_name, status: d.status, sii_status: d.sii_status,
      issued_date: d.start_date, sold_at: d.created_at,
      amount_total: d.amount_total, amount_neto: d.amount_neto,
      amount_iva: d.amount_iva, amount_exempt: d.amount_exempt, branch_id: d.branch_id,seller_id: d.seller_id,
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

  return NextResponse.json({ ok: true, synced: nuevas.length });
}