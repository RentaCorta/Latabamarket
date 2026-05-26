import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — devuelve todos los mapeos + categorías disponibles desde products
export async function GET() {
  const [mapRes, catRes] = await Promise.all([
    supabase.from("category_provider_map").select("*").order("category_name"),
    supabase.from("products").select("category_name").not("category_name", "is", null),
  ]);
  if (mapRes.error) return NextResponse.json({ ok: false, error: mapRes.error.message }, { status: 500 });
  if (catRes.error) return NextResponse.json({ ok: false, error: catRes.error.message }, { status: 500 });

  const categories = [...new Set((catRes.data ?? []).map((r: { category_name: string }) => r.category_name).filter(Boolean))].sort();
  return NextResponse.json({ ok: true, mappings: mapRes.data, categories });
}

// POST — upsert de un mapeo (category_name es la PK)
export async function POST(request: Request) {
  const body = await request.json();
  const { category_name, provider_name } = body;
  if (!category_name) return NextResponse.json({ ok: false, error: "category_name requerido" }, { status: 400 });

  const { error } = await supabase
    .from("category_provider_map")
    .upsert({ category_name, provider_name: provider_name || null }, { onConflict: "category_name" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — elimina un mapeo
export async function DELETE(request: Request) {
  const { category_name } = await request.json();
  const { error } = await supabase
    .from("category_provider_map")
    .delete()
    .eq("category_name", category_name);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}