import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/relbase-tokens";

const API_BASE = process.env.RELBASE_API_BASE!;

// Diagnóstico: muestra la estructura cruda de boletas con devolución
// y de una factura, para identificar los nombres de campos de montos reales.
// Uso: /api/relbase/inspect-dte
export async function GET() {
  const token = await getValidToken();

  // Trae la primera página de boletas afectas (type 39)
  const res = await fetch(`${API_BASE}/dtes?type_document=39&per_page=50&page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await res.json();
  const dtes = j?.data?.dtes ?? [];

  // Busca un DTE que parezca tener devolución (donde haya referencias o montos distintos)
  // y devuelve el objeto completo del primero + las keys de todos
  const sample = dtes[0] ?? null;
  const allKeys = sample ? Object.keys(sample) : [];

  // Intenta encontrar uno con folio 231312 (el de la devolución conocida)
  const withReturn = dtes.find((d: { folio?: number }) => d.folio === 231312) ?? null;

  return NextResponse.json({
    total_in_page: dtes.length,
    all_keys: allKeys,
    sample_full: sample,
    folio_231312: withReturn,
  });
}