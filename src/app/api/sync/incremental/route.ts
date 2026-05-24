import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

const TYPE_BOLETA = 39;

export async function GET() {
  // 1. La venta más reciente que ya tenemos
  const { data: latest } = await supabase
    .from("sales")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxId = latest?.id ?? 0;

  // 2. Traer boletas nuevas (de más nueva a más antigua) hasta toparnos con una conocida
  let page = 1;
  const newSales: any[] = [];
  let stop = false;

  while (!stop) {
    const data = await relbaseFetch(`/dtes?type_document=${TYPE_BOLETA}&per_page=50&page=${page}`);
    const dtes = data?.data?.dtes ?? [];
    if (dtes.length === 0) break;

    for (const d of dtes) {
      if (d.id <= maxId) { stop = true; break; }
      newSales.push(d);
    }

    const nextPage = data?.meta?.next_page;
    if (stop || !nextPage || nextPage === -1) break;
    page = nextPage;
    await new Promise((r) => setTimeout(r, 250));
  }

  // 3. Guardar cabeceras + detalle de cada venta nueva
  for (const d of newSales) {
    await supabase.from("sales").upsert({
      id: d.id, folio: d.folio, type_document: d.type_document,
      type_document_name: d.type_document_name, status: d.status, sii_status: d.sii_status,
      issued_date: d.start_date, sold_at: d.created_at,
      amount_total: d.amount_total, amount_neto: d.amount_neto,
      amount_iva: d.amount_iva, amount_exempt: d.amount_exempt, branch_id: d.branch_id,
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
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({ ok: true, new_sales: newSales.length });
}