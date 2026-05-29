"use client";

import { useState } from "react";

interface LineaFactura {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total_linea: number;
}

interface FacturaData {
  proveedor: string;
  rut_proveedor: string;
  folio: string;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  lineas: LineaFactura[];
}

export default function RecepcionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [factura, setFactura] = useState<FacturaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFactura(null);
    setError(null);

    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  async function handleParse() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/recepcion/parse", {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Error desconocido");
        return;
      }

      setFactura(json.data);
    } catch (err) {
      setError("Error conectando con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleLineaChange(index: number, field: keyof LineaFactura, value: string) {
    if (!factura) return;
    const lineas = [...factura.lineas];
    lineas[index] = {
      ...lineas[index],
      [field]: field === "descripcion" ? value : Number(value),
    };
    setFactura({ ...factura, lineas });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📦 Recepción de Facturas</h1>

        {/* Upload */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sube una foto o PDF de la factura
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <button
              onClick={handleParse}
              disabled={loading}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Extrayendo datos..." : "Extraer datos con IA"}
            </button>
          )}
          {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
        </div>

        {/* Layout lado a lado */}
        {(preview || factura) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Preview imagen */}
            {preview && (
              <div className="bg-white rounded-xl shadow p-4">
                <h2 className="text-sm font-medium text-gray-600 mb-3">Vista previa</h2>
                <img src={preview} alt="Factura" className="w-full rounded border" />
              </div>
            )}

            {/* Datos extraídos */}
            {factura && (
              <div className="bg-white rounded-xl shadow p-6 space-y-6">

                {/* Cabecera */}
                <div>
                  <h2 className="text-sm font-medium text-gray-600 mb-3">Datos de la factura</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Proveedor", field: "proveedor" },
                      { label: "RUT", field: "rut_proveedor" },
                      { label: "Folio", field: "folio" },
                      { label: "Fecha", field: "fecha" },
                    ].map(({ label, field }) => (
                      <div key={field}>
                        <label className="text-xs text-gray-500">{label}</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm mt-1"
                          value={String(factura[field as keyof FacturaData] ?? "")}
                          onChange={(e) => setFactura({ ...factura, [field]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totales */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Subtotal", field: "subtotal" },
                    { label: "IVA", field: "iva" },
                    { label: "Total", field: "total" },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label className="text-xs text-gray-500">{label}</label>
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm mt-1"
                        value={Number(factura[field as keyof FacturaData])}
                        onChange={(e) => setFactura({ ...factura, [field]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>

                {/* Líneas */}
                <div>
                  <h2 className="text-sm font-medium text-gray-600 mb-3">
                    Líneas ({factura.lineas.length})
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="text-left p-2">Descripción</th>
                          <th className="text-right p-2">Cant.</th>
                          <th className="text-right p-2">Precio Unit.</th>
                          <th className="text-right p-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {factura.lineas.map((linea, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-1">
                              <input
                                className="w-full border rounded px-2 py-1"
                                value={linea.descripcion}
                                onChange={(e) => handleLineaChange(i, "descripcion", e.target.value)}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                className="w-20 border rounded px-2 py-1 text-right"
                                value={linea.cantidad}
                                onChange={(e) => handleLineaChange(i, "cantidad", e.target.value)}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                className="w-28 border rounded px-2 py-1 text-right"
                                value={linea.precio_unitario}
                                onChange={(e) => handleLineaChange(i, "precio_unitario", e.target.value)}
                              />
                            </td>
                            <td className="p-1 text-right font-medium">
                              ${linea.total_linea.toLocaleString("es-CL")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Botón confirmar (placeholder por ahora) */}
                <button
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium"
                  onClick={() => alert("Próximamente: match con catálogo y envío a Relbase")}
                >
                  ✅ Confirmar recepción
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}