import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const PROMPT = `Eres un extractor de facturas chilenas. Analiza la imagen o PDF y extrae la información en formato JSON.
Responde SOLO con el JSON, sin texto adicional, sin markdown, sin backticks.

Formato esperado:
{
  "proveedor": "nombre del proveedor",
  "rut_proveedor": "RUT con formato XX.XXX.XXX-X",
  "folio": "número de folio",
  "fecha": "YYYY-MM-DD",
  "subtotal": número sin puntos,
  "iva": número sin puntos,
  "total": número sin puntos,
  "lineas": [
    {
      "descripcion": "nombre del producto tal como aparece en la factura",
      "cantidad": número,
      "precio_unitario": número sin puntos,
      "total_linea": número sin puntos
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type; // image/jpeg, image/png, application/pdf

    const body = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
    };

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Gemini error ${res.status}: ${detail}` }, { status: 500 });
    }

    const geminiData = await res.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Limpiar por si Gemini agrega backticks igual
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err) {
    console.error("[parse] error:", err);
    return NextResponse.json({ error: "Error procesando archivo" }, { status: 500 });
  }
}