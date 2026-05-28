import { NextResponse } from "next/server";
import { relbaseV2Fetch } from "@/lib/relbase-v2";

interface Warehouse {
  id: number;
  name: string;
  address: string | null;
  priority: number | null;
  enabled: boolean;
  branch_id: number;
  is_fulfillment: boolean;
}

interface WarehousesResponse {
  data: { warehouses: Warehouse[] };
  meta: { code: number; message: string };
}

// Lista las bodegas habilitadas con control de inventario activo.
// Sirve como prueba de la conexión OAuth v2 y como fuente para el
// selector de bodega en el módulo de recepción.
export async function GET() {
  try {
    const data = await relbaseV2Fetch<WarehousesResponse>("/bodegas");
    // Solo las habilitadas, ordenadas por nombre para el selector
    const warehouses = (data.data?.warehouses ?? [])
      .filter((w) => w.enabled)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return NextResponse.json({ ok: true, warehouses });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}