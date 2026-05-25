import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const data = await relbaseFetch(`/vendedores`);
  const sellers = data?.data?.sellers ?? [];
  const rows = sellers.map((s: any) => ({
    id: s.id,
    name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
  }));
  const { error } = await supabase.from("sellers").upsert(rows);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, imported: rows.length });
}