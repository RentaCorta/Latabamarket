import { NextResponse } from "next/server";
   import { relbaseFetch } from "@/lib/relbase";
   import { supabase } from "@/lib/supabase";

   export async function GET(request: Request) {
     const url = new URL(request.url);
     const limit = Number(url.searchParams.get("limit") ?? 150);

     // Ventas que todavía no tienen su detalle de productos (las más recientes primero)
     const { data: pending, error: selErr } = await supabase
       .from("sales")
       .select("id")
       .eq("items_synced", false)
       .order("sold_at", { ascending: false })
       .limit(limit);

     if (selErr) {
       return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
     }

     let processed = 0;
     for (const sale of pending ?? []) {
       const detail = await relbaseFetch(`/dtes/${sale.id}`);
       const products = detail?.data?.products ?? [];

       // Borramos items previos de esta venta (idempotencia) e insertamos los actuales
       await supabase.from("sale_items").delete().eq("sale_id", sale.id);

       if (products.length > 0) {
         const items = products.map((p: any) => ({
           sale_id: sale.id,
           product_id: p.product_id,
           name: p.name,
           code: p.code,
           price: p.price,
           quantity: p.quantity,
           unit_cost: p.unit_cost,
           tax_affected: p.tax_affected,
         }));
         const { error: insErr } = await supabase.from("sale_items").insert(items);
         if (insErr) {
           return NextResponse.json(
             { ok: false, error: insErr.message, processed },
             { status: 500 }
           );
         }
       }

       await supabase.from("sales").update({ items_synced: true }).eq("id", sale.id);
       processed++;

       await new Promise((r) => setTimeout(r, 250));
     }

     // Cuántas quedan pendientes
     const { count } = await supabase
       .from("sales")
       .select("id", { count: "exact", head: true })
       .eq("items_synced", false);

     return NextResponse.json({ ok: true, processed, remaining: count ?? 0 });
   }