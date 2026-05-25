import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

export async function GET() {
  let page = 1;
  let imported = 0;

  while (true) {
    const data = await relbaseFetch(`/productos?per_page=100&page=${page}`);
    const products = data?.data?.products ?? [];
    if (products.length === 0) break;

    const rows = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      category_id: p.category?.id ?? null,
      category_name: p.category?.name ?? null,
      unit_cost: p.unit_cost,
      price_sale: p.price_sale,
    }));

    const { error } = await supabase.from("products").upsert(rows);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, imported }, { status: 500 });
    }
    imported += rows.length;

    const nextPage = data?.meta?.next_page;
    if (!nextPage || nextPage === -1) break;
    page = nextPage;
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({ ok: true, imported });
}