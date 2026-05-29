import { NextRequest, NextResponse } from "next/server";

const EASYOCR_KEYS = [
  process.env.EASYOCR_KEY_1,
  process.env.EASYOCR_KEY_2,
  process.env.EASYOCR_KEY_3,
  process.env.EASYOCR_KEY_4,
].filter(Boolean) as string[];

// Rota entre las keys disponibles según el día del mes
function getApiKey(): string {
  const keyIndex = new Date().getDate() % EASYOCR_KEYS.length;
  return EASYOCR_KEYS[keyIndex];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "No hay API key configurada" }, { status: 500 });
    }

    // Enviar a EasyOCR
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("https://api.easyocr.es/v1/extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `EasyOCR error ${res.status}: ${detail}` }, { status: 500 });
    }

    const raw = await res.json();
    console.log("[parse] EasyOCR raw:", JSON.stringify(raw).slice(0, 1000));

    // Mapear respuesta de EasyOCR a nuestro formato
    const data = {
      proveedor: raw.supplier?.name ?? raw.structured_data?.supplier?.name ?? "",
      rut_proveedor: raw.supplier?.tax_id ?? raw.structured_data?.supplier?.tax_id ?? "",
      folio: raw.document_number ?? raw.structured_data?.document_number ?? "",
      fecha: raw.issue_date ?? raw.structured_data?.issue_date ?? "",
      subtotal: raw.totals?.subtotal ?? raw.structured_data?.totals?.subtotal ?? 0,
      iva: raw.totals?.tax ?? raw.structured_data?.totals?.tax ?? 0,
      total: raw.totals?.total ?? raw.structured_data?.totals?.total ?? 0,
      lineas: (raw.items ?? raw.structured_data?.items ?? []).map((item: {
        description: string;
        quantity: number;
        unit_price: number;
        total: number;
      }) => ({
        descripcion: item.description ?? "",
        cantidad: item.quantity ?? 1,
        precio_unitario: item.unit_price ?? 0,
        total_linea: item.total ?? 0,
      })),
    };

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[parse] error:", err);
    return NextResponse.json({ error: "Error procesando archivo" }, { status: 500 });
  }
}