import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const window = Number(url.searchParams.get("window") ?? 30);

  const { data, error } = await supabase.rpc("kpi_stock_coverage", { p_window: window });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, window, products: data ?? [] });
}