import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseInt(url.searchParams.get("days") ?? "15", 10);
  const days = Number.isNaN(parsed) ? 15 : parsed;
  const { data, error } = await supabase.rpc("kpi_slow_movers", { p_days: days });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slow_movers: data });
}