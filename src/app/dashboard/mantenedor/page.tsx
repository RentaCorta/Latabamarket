"use client";

import { useEffect, useState } from "react";

type Mapping = { category_name: string; provider_name: string | null };
type SaveState = "idle" | "saving" | "ok" | "error";

const PROVIDERS = [
  "AGROSUPER COMERCIALIZADORA DE ALIMENTOS LTDA.",
  "Almacen San José SpA",
  "BIDFOOD CHILE S.A.",
  "BUK SPA",
  "COMERCIAL BLM SPA",
  "COMERCIAL CCU S.A.",
  "COMERCIAL LA FRANCESA SPA",
  "COMERCIAL TRAPANANDA SPA",
  "CONSORCIO INDUSTRIAL DE ALIMENTOS S.A.",
  "COOPERATIVA AGRICOLA Y LECHERA DE LA UNION LTDA.",
  "DISEÑO MATIAS IGNACIO QUEZADA TORRES E.I.R.L.",
  "DISTRIBUIDORA DE ALIMENTOS ELPAC LIMITADA",
  "DISTRIBUIDORA HIMAX LIMITADA",
  "DISTRIBUIDORA LOS TEROS SPA",
  "DISTRIBUIDORA Y COMERCIAL DIMAK LIMITADA",
  "DUAL SOLUCIONES SPA",
  "Embotelladora Andina S.A.",
  "Empresa Eléctrica de Aysén S.A.",
  "Envasadora Aysén ltda",
  "Espol S.A.",
  "FERRETERIA Y MERCERIA SLAKO ZUÑÍGA SPA",
  "FOTOGRAFICA COYHAIQUE LIMITADA",
  "Fabrica de Bandejas Limitada",
  "GTD MANQUEHUE SA",
  "LA TRANQUERA SPA",
  "MYRIAM DEL CARMEN ADRIAZOLA GONGORA",
  "MercadoLibre Chile LTDA",
  "SOC DE INVERSIONES CORDILLERA LIMITADA",
  "SOCIEDAD COMERCIAL MULTIMIX LIMITADA",
  "SODIMAC S.A.",
  "Servicios Informáticos Relke SpA",
  "TONY GALLO SPA",
  "TRANSPORTES NAVIA AGUILAR MILLAPEL E.I.R.L.",
  "UOVA SPA",
  // Desde categorías de productos
  "AGROINDUSTRIA AYC SPA",
  "AGROSUPER",
  "ALIMENTOS DESHIDRATADOS VICTOR MANUEL ACEVEDO",
  "ANDINA",
  "BIDFOOD",
  "BLM",
  "CCU",
  "CIAL",
  "COLUN",
  "COMERCIAL EL CAPON LTDA.",
  "COMERCIAL GLORIA PATRICIA CARE URRUTIA E.I.R.L.",
  "COMERCIAL LA PALESTINA",
  "COMERCIAL VALLE PATAGONIA",
  "COMERCIALIZADORA Y DISTRIB. HENG FA LTDA.",
  "DIMAK",
  "DITAB CHILE SPA",
  "ELPAC",
  "Envasadora Aysén",
  "ESPOL",
  "FOTOGRAFICA COYHAIQUE LTDA.",
  "GASTRONOMICA GOLOSO LTDA.",
  "GASTRONOMICA TUPUNGATO SPA",
  "HIELO AUSTRAL",
  "HIMAX",
  "HOME COOKING SPA",
  "IMP. PROD. Y COMER. DE ENVASES PROD DE EMPAQUE HIG",
  "INSUMOS PACKAGING",
  "LA TABA",
  "Modinger Hermanos Sociedad Anonima",
  "Multimix",
  "PF",
  "SOC. COMERCIAL Y DISTRIBUIDORA HN LTDA.",
  "TONY GALLO",
  "Transp Navia Aguilar Millapel E.I.R.L.",
  "TRAPANANDA",
].filter((v, i, a) => a.indexOf(v) === i)
 .sort((a, b) => a.localeCompare(b, "es"));

export default function MantenedorPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [newCat, setNewCat] = useState("");
  const [newProv, setNewProv] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/category-map")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setMappings(d.mappings); setCategories(d.categories ?? []); }
        else setError(d.error);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const mappedCats = new Set(mappings.map((m) => m.category_name));
  const availableCats = categories.filter((c) => !mappedCats.has(c));

  const usedProviders = (excludeCat?: string) =>
    new Set(mappings.filter((m) => m.provider_name && m.category_name !== excludeCat).map((m) => m.provider_name as string));

  const save = async (category_name: string, provider_name: string | null) => {
    setSaveState((s) => ({ ...s, [category_name]: "saving" }));
    try {
      const r = await fetch("/api/category-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_name, provider_name: provider_name || null }),
      });
      const d = await r.json();
      setSaveState((s) => ({ ...s, [category_name]: d.ok ? "ok" : "error" }));
      if (d.ok) setMappings((prev) => prev.map((m) => m.category_name === category_name ? { ...m, provider_name } : m));
      setTimeout(() => setSaveState((s) => ({ ...s, [category_name]: "idle" })), 2000);
    } catch {
      setSaveState((s) => ({ ...s, [category_name]: "error" }));
    }
  };

  const remove = async (category_name: string) => {
    if (!confirm(`¿Eliminar mapeo de "${category_name}"?`)) return;
    setSaveState((s) => ({ ...s, [category_name]: "saving" }));
    const r = await fetch("/api/category-map", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_name }),
    });
    const d = await r.json();
    if (d.ok) setMappings((prev) => prev.filter((m) => m.category_name !== category_name));
    setSaveState((s) => ({ ...s, [category_name]: "idle" }));
  };

  const addNew = async () => {
    if (!newCat) return;
    setAdding(true);
    const r = await fetch("/api/category-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_name: newCat, provider_name: newProv || null }),
    });
    const d = await r.json();
    if (d.ok) { setNewCat(""); setNewProv(""); load(); }
    setAdding(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <div className="mb-1">
          <a href="/dashboard" className="text-sm text-slate-400 hover:text-slate-600">← Panel</a>
        </div>
        <h1 className="text-xl font-bold tracking-tight">Mapeo Categoría → Proveedor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Asocia cada categoría de producto a un proveedor de compras para calcular las ventas por proveedor.
          Los cambios aplican al instante — no hay que redesplegar.
        </p>

        {error && <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Error: {error}</div>}

        <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_2fr_auto] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-400">
            <span>Categoría de producto</span>
            <span>Proveedor en compras</span>
            <span></span>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm text-slate-400">Cargando…</div>
          ) : mappings.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">Sin mapeos aún. Agrega uno abajo.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {mappings.map((m) => {
                const st = saveState[m.category_name] ?? "idle";
                const used = usedProviders(m.category_name);
                return (
                  <div key={m.category_name} className="grid grid-cols-[1fr_2fr_auto] items-center gap-4 px-5 py-3">
                    <span className="font-mono text-sm font-medium">{m.category_name}</span>
                    <select
                      value={m.provider_name ?? ""}
                      onChange={(e) => save(m.category_name, e.target.value || null)}
                      disabled={st === "saving"}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">— Sin asignar —</option>
                      {PROVIDERS.filter((p) => !used.has(p)).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      {m.provider_name && used.has(m.provider_name) && (
                        <option value={m.provider_name}>{m.provider_name}</option>
                      )}
                    </select>
                    <div className="flex items-center gap-2">
                      {st === "saving" && <span className="text-xs text-slate-400">Guardando…</span>}
                      {st === "ok" && <span className="text-xs text-emerald-600">✓ Guardado</span>}
                      {st === "error" && <span className="text-xs text-rose-600">Error</span>}
                      <button
                        onClick={() => remove(m.category_name)}
                        disabled={st === "saving"}
                        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <p className="mb-3 text-xs font-medium text-slate-500">Agregar categoría</p>
            {availableCats.length === 0 && !loading ? (
              <p className="text-xs text-slate-400">✓ Todas las categorías ya tienen un mapeo asignado.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Categoría</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">— Seleccionar —</option>
                    {availableCats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Proveedor</label>
                  <select
                    value={newProv}
                    onChange={(e) => setNewProv(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">— Sin asignar —</option>
                    {PROVIDERS.filter((p) => !usedProviders().has(p)).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addNew}
                  disabled={adding || !newCat}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adding ? "Agregando…" : "Agregar"}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          💡 Las categorías se cargan desde los productos del sistema. Si falta un proveedor en la lista, avisa para agregarlo.
        </p>
      </div>
    </main>
  );
}
