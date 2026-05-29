import { NextRequest, NextResponse } from "next/server";

const EASYOCR_KEYS = [
  process.env.EASYOCR_KEY_1,
  process.env.EASYOCR_KEY_2,
  process.env.EASYOCR_KEY_3,
  process.env.EASYOCR_KEY_4,
].filter(Boolean) as string[];

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

    console.log("[parse] Archivo:", file.name, file.type, file.size);

    const form = new FormData();
    form.append("file", file);
    form.append("structure", "true");

    console.log("[parse] Llamando a EasyOCR...");

    const res = await fetch("https://app.easyocr.es/api/v1/ocr/file", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
      },
      body: form,
    });

    console.log("[parse] EasyOCR status:", res.status);

    if (!res.ok) {
      const detail = await res.text();
      console.error("[parse] EasyOCR error:", detail);
      return NextResponse.json({ error: `EasyOCR error ${res.status}: ${detail}` }, { status: 500 });
    }

    const raw = await res.json();
    console.log("[parse] EasyOCR raw:", JSON.stringify(raw).slice(0, 1000));

    const structured = raw.structured_data ?? raw;

    const data = {
      proveedor: structured.supplier?.name ?? "",
      rut_proveedor: structured.supplier?.tax_id ?? "",
      folio: structured.document_number ?? "",
      fecha: structured.issue_date ?? "",
      subtotal: structured.totals?.subtotal ?? 0,
      iva: structured.totals?.tax ?? 0,
      total: structured.totals?.total ?? 0,
      lineas: (structured.items ?? []).map((item: {
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
    console.error("[parse] error detalle:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error procesando archivo", detalle: message }, { status: 500 });
  }
}