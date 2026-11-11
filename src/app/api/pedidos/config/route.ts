// src/app/api/pedidos/config/route.ts
// Configuración del sistema de pedidos:
//  - categoría → proveedor (tabla existente category_provider_map, se edita en "Mapeo proveedores")
//  - tiempo de entrega por proveedor (supplier_settings)
//  - excepciones por SKU (supplier_products)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [map, settings, products] = await Promise.all([
      supabase.from("category_provider_map").select("category_name, provider_name"),
      supabase.from("supplier_settings").select("provider_name, lead_days, contact"),
      supabase.from("supplier_products").select("product_id, provider_name"),
    ]);
    const err = map.error || settings.error || products.error;
    if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      category_map: map.data ?? [],
      settings: settings.data ?? [],
      product_overrides: products.data ?? [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    // Guardar tiempo de entrega / contacto de un proveedor
    if (action === "set_lead") {
      const provider_name = String(body.provider_name ?? "").trim();
      const lead_days = Math.max(0, Math.round(Number(body.lead_days) || 0));
      const contact = body.contact ? String(body.contact) : null;
      if (!provider_name) return NextResponse.json({ ok: false, error: "Falta proveedor" }, { status: 400 });
      const { error } = await supabase.from("supplier_settings")
        .upsert({ provider_name, lead_days, contact, updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Asignar (o quitar) un SKU a un proveedor distinto al de su categoría
    if (action === "set_product") {
      const product_id = Number(body.product_id);
      const provider_name = body.provider_name ? String(body.provider_name) : null;
      if (!product_id) return NextResponse.json({ ok: false, error: "Falta producto" }, { status: 400 });
      const { error } = provider_name
        ? await supabase.from("supplier_products")
            .upsert({ product_id, provider_name, updated_at: new Date().toISOString() })
        : await supabase.from("supplier_products").delete().eq("product_id", product_id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
