import { NextResponse } from "next/server";
import { resumenGastos } from "@/lib/sheets-gastos";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const periodo = url.searchParams.get("periodo") ?? undefined;
    const data = await resumenGastos(periodo);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}