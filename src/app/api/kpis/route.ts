import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [daily, monthly, hourly, topProducts] = await Promise.all([
    supabase.from("kpi_daily_sales").select("*").order("day", { ascending: true }),
    supabase.from("kpi_monthly_sales").select("*").order("month", { ascending: true }),
    supabase.from("kpi_hourly_sales").select("*").order("hour", { ascending: true }),
    supabase.from("kpi_top_products").select("*").order("revenue", { ascending: false }).limit(10),
  ]);

  for (const r of [daily, monthly, hourly, topProducts]) {
    if (r.error) {
      return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 });
    }
  }

  const dailyRows = daily.data ?? [];
  const totalSales = dailyRows.reduce((s, d) => s + Number(d.total), 0);
  const totalTx = dailyRows.reduce((s, d) => s + Number(d.transactions), 0);
  const avgTicket = totalTx > 0 ? Math.round(totalSales / totalTx) : 0;

  return NextResponse.json({
    ok: true,
    summary: { total_sales: totalSales, transactions: totalTx, avg_ticket: avgTicket },
    daily: dailyRows,
    monthly: monthly.data,
    hourly: hourly.data,
    top_products: topProducts.data,
  });
}