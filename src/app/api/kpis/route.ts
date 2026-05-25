import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();

  const to = url.searchParams.get("to") ?? fmt(today);
  const fromDefault = new Date(today);
  fromDefault.setDate(fromDefault.getDate() - 89);
  const from = url.searchParams.get("from") ?? fmt(fromDefault);
  const shift = url.searchParams.get("shift") ?? "all";

  const start = new Date(from);
  const end = new Date(to);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1);

  const args = { p_start: from, p_end: to, p_shift: shift };
  const [summary, prev, daily, hourly, top, mix, sellers, service, coffee] = await Promise.all([
    supabase.rpc("kpi_summary", args),
    supabase.rpc("kpi_summary", { p_start: fmt(prevStart), p_end: fmt(prevEnd), p_shift: shift }),
    supabase.rpc("kpi_daily", args),
    supabase.rpc("kpi_hourly", args),
    supabase.rpc("kpi_top_products", args),
    supabase.rpc("kpi_category_mix", args),
    supabase.rpc("kpi_by_seller", args),
    supabase.rpc("kpi_service_weekly", args),
    supabase.rpc("kpi_coffee_weekly", args),
  ]);

  for (const r of [summary, prev, daily, hourly, top, mix, sellers, service, coffee]) {
    if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    range: { from, to, shift },
    summary: summary.data?.[0] ?? null,
    prev_summary: prev.data?.[0] ?? null,
    daily: daily.data,
    hourly: hourly.data,
    top_products: top.data,
    category_mix: mix.data,
    sellers: sellers.data,
    service_weekly: service.data,
    coffee_weekly: coffee.data,
  });
}