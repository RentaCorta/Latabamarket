import { NextResponse } from "next/server";
import { relbaseFetch } from "@/lib/relbase";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // Procesamos en lotes para no exceder el timeout.
  // Pasamos ?offset=0, luego ?offset=50, etc.
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const LIMIT = 40;

  // Traemos ventas de junio que aún tienen amount = real (sin corregir)
  const { data: ventas, error } = await supabase
    .from("sales")
    .select("id, folio")
    .gte("sold_at", "2026-06-01 00:00:00+00")
    .order("id", { ascending: true })
    .range(offset, offset + LIMIT - 1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }
  if (!ventas || ventas.length === 0) {
    return NextResponse.json({ ok: true, done: true, message: "No hay más ventas, terminado" });
  }

  let corregidas = 0;
  for (const v of ventas) {
    const detail = await relbaseFetch(`/dtes/${v.id}`);
    const det = detail?.data;
    if (!det) continue;

    await supabase.from("sales").update({
      real_amount_total: det.real_amount_total ?? det.amount_total,
      real_amount_neto: det.real_amount_neto ?? det.amount_neto,
      real_amount_iva: det.real_amount_iva ?? det.amount_iva,
      real_amount_exempt: det.real_amount_exempt ?? det.amount_exempt,
    }).eq("id", v.id);

    corregidas++;
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({
    ok: true,
    done: false,
    offset_procesado: offset,
    corregidas,
    siguiente_offset: offset + LIMIT,
    instruccion: `Ejecuta ahora con ?offset=${offset + LIMIT}`,
  });
}