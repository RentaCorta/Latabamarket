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

    // La respuesta viene en raw.data.structured_data
    const sd = raw.data?.structured_data ?? {};

    const data = {
      proveedor: sd.vendor ?? sd.supplier ?? sd.proveedor ?? "",
      rut_proveedor: sd.vendor_tax_id ?? sd.tax_id ?? sd.rut ?? "",
      folio: sd.invoice_number ?? sd.folio ?? sd.document_number ?? "",
      fecha: sd.date ?? sd.fecha ?? sd.issue_date ?? "",
      subtotal: sd.subtotal ?? sd.net_amount ?? 0,
      iva: sd.tax ?? sd.iva ?? sd.vat ?? 0,
      total: sd.total ?? 0,
      lineas: (sd.items ?? sd.line_items ?? sd.lineas ?? []).map((item: {
        description?: string; name?: string;
        quantity?: number; qty?: number;
        unit_price?: number; price?: number;
        total?: number; amount?: number;
      }) => ({
        descripcion: item.description ?? item.name ?? "",
        cantidad: item.quantity ?? item.qty ?? 1,
        precio_unitario: item.unit_price ?? item.price ?? 0,
        total_linea: item.total ?? item.amount ?? 0,
      })),
    };

    return NextResponse.json({ ok: true, data });

  } catch (err) {
    console.error("[parse] error detalle:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error procesando archivo", detalle: message }, { status: 500 });
  }
}