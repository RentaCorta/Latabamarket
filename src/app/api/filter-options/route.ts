import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Devuelve la lista completa de categorías y productos para los filtros del dashboard.
// Independiente de filtros activos para que el usuario siempre vea todas las opciones.
export async function GET() {
  const [catRes, prodRes] = await Promise.all([
    supabase.rpc("list_product_categories"),
    supabase.from("products").select("name").not("name", "is", null).order("name"),
  ]);
  if (catRes.error) return NextResponse.json({ ok: false, error: catRes.error.message }, { status: 500 });
  if (prodRes.error) return NextResponse.json({ ok: false, error: prodRes.error.message }, { status: 500 });

  const categories = (catRes.data ?? []).map((r: { category_name: string }) => r.category_name);
  const products = [...new Set((prodRes.data ?? []).map((r: { name: string }) => r.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));

  return NextResponse.json({ ok: true, categories, products });
}