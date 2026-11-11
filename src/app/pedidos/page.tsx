"use client";

// src/app/pedidos/page.tsx
// Sistema de pedidos a proveedores: calcula cuánto pedir de cada SKU según
// la venta histórica, el stock actual, el tiempo de entrega del proveedor,
// los días que se quieren cubrir y un % de seguridad.

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Cov = {
  product_id: number; name: string; category: string;
  stock: number; units_sold: number; units_per_day: number;
  days_coverage: number | null; last_sold: string | null;
  days_since: number | null; stock_value: number;
};
type Setting = { provider_name: string; lead_days: number; contact: string | null };
type Config = {
  category_map: { category_name: string; provider_name: string }[];
  settings: Setting[];
  product_overrides: { product_id: number; provider_name: string }[];
};

const SIN = "__sin__";
const TODOS = "__todos__";
const HORIZONTES = [5, 7, 14, 21, 30];

const clp = (n: unknown) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const num = (n: unknown, d = 0) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: d }).format(Number(n) || 0);
const hoy = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

export default function Pedidos() {
  const [tab, setTab] = useState<"pedido" | "config">("pedido");
  const [cfg, setCfg] = useState<Config>({ category_map: [], settings: [], product_overrides: [] });
  const [cov, setCov] = useState<Cov[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [win, setWin] = useState(30);          // días de historia para el ritmo de venta
  const [horizonte, setHorizonte] = useState(7); // días a cubrir después de que llega el pedido
  const [seg, setSeg] = useState(20);          // % de seguridad
  const [prov, setProv] = useState("");        // proveedor seleccionado
  const [soloPedir, setSoloPedir] = useState(false);
  const [solo7, setSolo7] = useState(false);   // solo productos vendidos en los últimos 7 días
  const [busca, setBusca] = useState("");
  const [qtyEdit, setQtyEdit] = useState<Record<number, number>>({});
  const [copiado, setCopiado] = useState(false);

  const loadConfig = () =>
    fetch("/api/pedidos/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCfg({ category_map: d.category_map ?? [], settings: d.settings ?? [], product_overrides: d.product_overrides ?? [] });
        else setError(d.error);
      })
      .catch((e) => setError(String(e)));

  useEffect(() => { loadConfig(); }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stock-coverage?window=${win}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCov(d.products ?? []); else setError(d.error); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [win]);

  // Si cambian los parámetros, se descartan las cantidades editadas a mano
  useEffect(() => { setQtyEdit({}); }, [prov, horizonte, seg, win]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/pedidos/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!d.ok) { alert(`No se pudo guardar: ${d.error}`); return; }
    await loadConfig();
  };

  // ── Resolución SKU → proveedor (excepción por SKU > categoría) ──
  const catMap = useMemo(() => new Map(cfg.category_map.map((c) => [c.category_name, c.provider_name])), [cfg]);
  const prodMap = useMemo(() => new Map(cfg.product_overrides.map((p) => [Number(p.product_id), p.provider_name])), [cfg]);
  const leadMap = useMemo(() => new Map(cfg.settings.map((s) => [s.provider_name, Number(s.lead_days) || 0])), [cfg]);
  const provOf = (c: Cov) => prodMap.get(Number(c.product_id)) ?? catMap.get(c.category) ?? null;

  const proveedores = useMemo(() => {
    const s = new Set<string>([...cfg.category_map.map((c) => c.provider_name), ...cfg.settings.map((x) => x.provider_name), ...cfg.product_overrides.map((p) => p.provider_name)]);
    return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [cfg]);

  // Por defecto: todos los proveedores
  useEffect(() => { if (!prov && proveedores.length) setProv(TODOS); }, [proveedores, prov]);

  const esTodos = prov === TODOS;
  const lead = prov === SIN || esTodos ? 0 : (leadMap.get(prov) ?? 0);
  const leadConfigurado = prov === SIN || esTodos || leadMap.has(prov);
  const diasObjetivo = lead + horizonte;

  const filas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cov
      .filter((c) => (esTodos ? true : prov === SIN ? provOf(c) === null : provOf(c) === prov))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .filter((c) => !solo7 || (c.days_since !== null && c.days_since !== undefined && Number(c.days_since) <= 7))
      .map((c) => {
        const p = provOf(c);
        // Cada producto usa el tiempo de entrega de SU proveedor
        const leadRow = p ? (leadMap.get(p) ?? 0) : 0;
        const objRow = leadRow + horizonte;
        const vd = Number(c.units_per_day) || 0;
        const stockReal = Number(c.stock) || 0;
        const stock = Math.max(stockReal, 0);
        const necesidad = vd * objRow * (1 + seg / 100);
        const sugerido = vd > 0 ? Math.max(0, Math.ceil(necesidad - stock)) : 0;
        const pedir = qtyEdit[c.product_id] ?? sugerido;
        const cobActual = vd > 0 ? stock / vd : null;
        const cobPost = vd > 0 ? (stock + pedir) / vd : null;
        const quiebraAntes = cobActual !== null && cobActual < leadRow;
        const alcanza = cobPost !== null && cobPost >= objRow;
        const costoUnit = stockReal > 0 ? Number(c.stock_value) / stockReal : null;
        return { c, p, leadRow, objRow, vd, stock: stockReal, sugerido, pedir, cobActual, cobPost, quiebraAntes, alcanza, costoUnit };
      })
      .filter((r) => prov === SIN || !soloPedir || r.pedir > 0)
      .sort((a, b) => (a.cobActual ?? 1e9) - (b.cobActual ?? 1e9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cov, prov, busca, horizonte, seg, qtyEdit, soloPedir, solo7, catMap, prodMap, leadMap]);

  const totUnidades = filas.reduce((a, r) => a + r.pedir, 0);
  const totCosto = filas.reduce((a, r) => a + (r.costoUnit !== null ? r.costoUnit * r.pedir : 0), 0);
  const sinCosto = filas.filter((r) => r.pedir > 0 && r.costoUnit === null).length;
  const enRiesgo = filas.filter((r) => r.quiebraAntes).length;
  const sinProveedor = useMemo(() => cov.filter((c) => provOf(c) === null && Number(c.units_per_day) > 0).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cov, catMap, prodMap]);

  const exportar = () => {
    const rows = filas.filter((r) => r.pedir > 0).map((r) => ({
      Proveedor: r.p ?? "Sin proveedor",
      Producto: r.c.name, "Categoría": r.c.category, Stock: r.stock,
      "Venta/día": Math.round(r.vd * 100) / 100, "Pedir": r.pedir,
      "Costo unit. aprox": r.costoUnit !== null ? Math.round(r.costoUnit) : "",
      "Costo total aprox": r.costoUnit !== null ? Math.round(r.costoUnit * r.pedir) : "",
    }));
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");
    const nombre = esTodos ? "todos" : prov.replace(/[^\w]+/g, "-").toLowerCase();
    XLSX.writeFile(wb, `pedido-${nombre}-${hoy()}.xlsx`);
  };

  const copiar = async () => {
    const conPedido = filas.filter((r) => r.pedir > 0);
    if (!conPedido.length) return;
    let texto: string;
    if (esTodos) {
      // Agrupado por proveedor, listo para mandar a cada uno
      const grupos = new Map<string, string[]>();
      for (const r of conPedido) {
        const k = r.p ?? "Sin proveedor";
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(`• ${r.pedir} x ${r.c.name}`);
      }
      const bloques = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, l]) => `*${k}*\n${l.join("\n")}`);
      texto = `Pedido La Taba · ${hoy()}\n\n${bloques.join("\n\n")}\n\nTotal: ${num(totUnidades)} unidades`;
    } else {
      texto = `Pedido La Taba · ${prov} · ${hoy()}\n\n${conPedido.map((r) => `• ${r.pedir} x ${r.c.name}`).join("\n")}\n\nTotal: ${num(totUnidades)} unidades`;
    }
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { alert(texto); }
  };

  const chip = (activo: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${activo ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo-lataba.png" alt="La Taba" className="h-10 w-auto rounded-md sm:h-12" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">La Taba · Pedidos a proveedores</h1>
          </div>
          <div className="flex gap-2">
            <a href="/dashboard/mantenedor" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">⚙ Mapeo proveedores</a>
            <a href="/dashboard" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← Dashboard</a>
          </div>
        </div>

        <div className="mt-5 flex gap-1.5 border-b border-slate-200">
          {([["pedido", "Armar pedido"], ["config", "Tiempos de entrega"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${tab === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>

        {error && <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Error: {error}</div>}

        {/* ===================== ARMAR PEDIDO ===================== */}
        {tab === "pedido" && (
          <>
            <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Proveedor</p>
                <select value={prov} onChange={(e) => setProv(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value={TODOS}>Todos los proveedores</option>
                  {proveedores.map((p) => (
                    <option key={p} value={p}>{p}{leadMap.has(p) ? ` · entrega ${leadMap.get(p)} d` : " · sin tiempo de entrega"}</option>
                  ))}
                  <option value={SIN}>⚠ Productos sin proveedor ({sinProveedor})</option>
                </select>
                {prov !== SIN && !leadConfigurado && (
                  <p className="mt-1.5 text-xs text-amber-600">Este proveedor no tiene tiempo de entrega configurado; se asume 0 días. Configúralo en "Tiempos de entrega".</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Quiero abastecerme por</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {HORIZONTES.map((h) => (
                    <button key={h} onClick={() => setHorizonte(h)} className={chip(horizonte === h)}>
                      {h === 7 ? "1 semana" : h === 14 ? "2 semanas" : h === 21 ? "3 semanas" : h === 30 ? "1 mes" : `${h} días`}
                    </button>
                  ))}
                  <input type="number" min={1} value={horizonte} onChange={(e) => setHorizonte(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" aria-label="Días a cubrir" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Margen de seguridad</p>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={50} step={5} value={seg} onChange={(e) => setSeg(Number(e.target.value))} className="w-full accent-indigo-600" />
                  <span className="w-12 text-right text-sm font-semibold tabular-nums">+{seg}%</span>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Ritmo de venta calculado con</p>
                <div className="flex flex-wrap gap-1.5">
                  {[15, 30, 60].map((w) => (
                    <button key={w} onClick={() => setWin(w)} className={chip(win === w)}>Últimos {w} días</button>
                  ))}
                </div>
              </div>
            </div>

            {prov !== SIN && (
              <p className="mt-3 text-xs text-slate-500">
                {esTodos ? (
                  <>Pedido = venta diaria × (días de entrega de su proveedor + {horizonte} días a cubrir) × (1 + {seg}%) − stock actual.</>
                ) : (
                  <>Pedido = venta diaria × ({lead} días de entrega + {horizonte} días a cubrir) × (1 + {seg}%) − stock actual.
                  El pedido debe cubrir <span className="font-semibold text-slate-700">{diasObjetivo} días</span> desde hoy.</>
                )}
              </p>
            )}

            {prov !== SIN && (
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Kpi title="Productos a pedir" value={num(filas.filter((r) => r.pedir > 0).length)} />
                <Kpi title="Unidades totales" value={num(totUnidades)} />
                <Kpi title="Costo estimado" value={clp(totCosto)} sub={sinCosto ? `${sinCosto} SKU sin costo (stock 0)` : "según costo de inventario"} />
                <Kpi title="Quiebran antes de llegar" value={num(enRiesgo)} sub={esTodos ? "stock dura menos que la entrega" : `stock dura menos de ${lead} días`} alert={enRiesgo > 0} />
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-sm font-semibold text-slate-700">
                  {prov === SIN ? "Productos que se venden y no tienen proveedor asignado" : `Pedido sugerido · ${esTodos ? "Todos los proveedores" : prov}`}
                  <span className="ml-2 text-xs font-normal text-slate-400">{filas.length} productos</span>
                </h2>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar producto…"
                  className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs" />
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={solo7} onChange={(e) => setSolo7(e.target.checked)} /> Vendidos últimos 7 días
                </label>
                {prov !== SIN && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={soloPedir} onChange={(e) => setSoloPedir(e.target.checked)} /> Solo lo que hay que pedir
                    </label>
                    <button onClick={copiar} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {copiado ? "✓ Copiado" : "📋 Copiar pedido"}
                    </button>
                    <button onClick={exportar} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">↓ Excel</button>
                  </>
                )}
              </div>

              {loading ? (
                <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>
              ) : filas.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  {prov === SIN ? "Todos los productos con venta tienen proveedor asignado." : "No hay nada que pedir a este proveedor con estos parámetros."}
                </p>
              ) : prov === SIN ? (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Producto</th>
                        <th className="pb-2 px-4 font-medium">Categoría</th>
                        <th className="pb-2 px-4 text-right font-medium">Venta/día</th>
                        <th className="pb-2 pl-4 font-medium">Asignar a</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.filter((r) => r.vd > 0).map((r) => (
                        <tr key={r.c.product_id} className="border-t border-slate-100">
                          <td className="py-1.5 pr-4">{r.c.name}</td>
                          <td className="py-1.5 px-4 text-slate-500 whitespace-nowrap">{r.c.category ?? "—"}</td>
                          <td className="py-1.5 px-4 text-right tabular-nums">{num(r.vd, 1)}</td>
                          <td className="py-1.5 pl-4">
                            <select defaultValue="" onChange={(e) => e.target.value && post({ action: "set_product", product_id: r.c.product_id, provider_name: e.target.value })}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                              <option value="">Elegir…</option>
                              {proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-slate-500">Si toda una categoría falta, es más rápido asignarla en "⚙ Mapeo proveedores".</p>
                </div>
              ) : (
                <div className="max-h-[620px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Producto</th>
                        {esTodos && <th className="pb-2 px-3 font-medium">Proveedor</th>}
                        <th className="pb-2 px-3 text-right font-medium">Stock</th>
                        <th className="pb-2 px-3 text-right font-medium">Venta/día</th>
                        <th className="pb-2 px-3 text-right font-medium">Dura hoy</th>
                        <th className="pb-2 px-3 text-right font-medium">Pedir</th>
                        <th className="pb-2 pl-3 font-medium">Con el pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((r) => (
                        <tr key={r.c.product_id} className="border-t border-slate-100">
                          <td className="py-1.5 pr-4">
                            {r.c.name}
                            {prodMap.has(Number(r.c.product_id)) && <span className="ml-1.5 rounded bg-indigo-50 px-1.5 text-[10px] text-indigo-600">SKU asignado</span>}
                          </td>
                          {esTodos && (
                            <td className="py-1.5 px-3 text-xs whitespace-nowrap">
                              {r.p ? (
                                <span className="text-slate-600">{r.p} <span className="text-slate-400">· {r.leadRow} d</span></span>
                              ) : (
                                <span className="text-amber-600">Sin proveedor</span>
                              )}
                            </td>
                          )}
                          <td className={`py-1.5 px-3 text-right tabular-nums ${r.stock <= 0 ? "font-semibold text-rose-600" : ""}`}>{num(r.stock)}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">{num(r.vd, 1)}</td>
                          <td className={`py-1.5 px-3 text-right tabular-nums whitespace-nowrap ${r.quiebraAntes ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                            {r.cobActual === null ? "—" : `${num(r.cobActual, 1)} d`}
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input type="number" min={0} value={r.pedir}
                              onChange={(e) => setQtyEdit((q) => ({ ...q, [r.c.product_id]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                              className={`w-20 rounded-md border px-2 py-1 text-right tabular-nums ${qtyEdit[r.c.product_id] !== undefined ? "border-indigo-400 bg-indigo-50" : "border-slate-200"}`} />
                          </td>
                          <td className="py-1.5 pl-3 whitespace-nowrap text-xs">
                            {r.quiebraAntes ? (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">⚠ Se agota antes de que llegue</span>
                            ) : r.alcanza ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Cubre {num(r.cobPost, 0)} d</span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Cubre {num(r.cobPost, 0)} de {r.objRow} d</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-white">
                      <tr className="border-t-2 border-slate-300 font-bold">
                        <td className="py-2 pr-4" colSpan={esTodos ? 5 : 4}>Total</td>
                        <td className="py-2 px-3 text-right tabular-nums">{num(totUnidades)}</td>
                        <td className="py-2 pl-3 text-xs font-medium text-slate-500">{clp(totCosto)} aprox.</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== TIEMPOS DE ENTREGA ===================== */}
        {tab === "config" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-slate-700">Tiempo de entrega por proveedor</h2>
              <p className="mb-3 mt-1 text-xs text-slate-500">Días desde que haces el pedido hasta que llega a la tienda. Los proveedores salen del "Mapeo proveedores".</p>
              {proveedores.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No hay proveedores mapeados todavía.</p>
              ) : (
                <div className="space-y-2">
                  {proveedores.map((p) => (
                    <ProveedorRow key={p} nombre={p} setting={cfg.settings.find((s) => s.provider_name === p)}
                      onSave={(lead_days, contact) => post({ action: "set_lead", provider_name: p, lead_days, contact })} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-slate-700">SKU con proveedor distinto al de su categoría ({cfg.product_overrides.length})</h2>
              <p className="mb-3 mt-1 text-xs text-slate-500">Se asignan desde "Productos sin proveedor" en Armar pedido. Aquí puedes quitarlos.</p>
              {cfg.product_overrides.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin excepciones.</p>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {cfg.product_overrides.map((o) => {
                        const nombre = cov.find((c) => Number(c.product_id) === Number(o.product_id))?.name ?? `ID ${o.product_id}`;
                        return (
                          <tr key={o.product_id} className="border-t border-slate-100">
                            <td className="py-1.5 pr-3">{nombre}</td>
                            <td className="py-1.5 px-3 text-slate-500">{o.provider_name}</td>
                            <td className="py-1.5 pl-3 text-right">
                              <button onClick={() => post({ action: "set_product", product_id: o.product_id, provider_name: null })}
                                className="text-xs text-slate-400 hover:text-rose-600">Quitar</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ProveedorRow({ nombre, setting, onSave }: { nombre: string; setting?: Setting; onSave: (lead: number, contact: string) => Promise<void> }) {
  const [lead, setLead] = useState(String(setting?.lead_days ?? ""));
  const [contact, setContact] = useState(setting?.contact ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setLead(String(setting?.lead_days ?? "")); setContact(setting?.contact ?? ""); }, [setting]);
  const dirty = lead !== String(setting?.lead_days ?? "") || contact !== (setting?.contact ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
      <span className="min-w-0 flex-1 truncate text-sm" title={nombre}>{nombre}</span>
      <input type="number" min={0} value={lead} onChange={(e) => setLead(e.target.value)} placeholder="días"
        className={`w-16 rounded-md border px-2 py-1 text-right text-sm tabular-nums ${setting ? "border-slate-200" : "border-amber-300 bg-amber-50"}`} />
      <span className="text-xs text-slate-400">días</span>
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contacto (opcional)"
        className="w-40 rounded-md border border-slate-200 px-2 py-1 text-xs" />
      <button disabled={!dirty || lead === "" || saving}
        onClick={async () => { setSaving(true); await onSave(Number(lead), contact); setSaving(false); }}
        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:bg-slate-200 disabled:text-slate-400">
        {saving ? "…" : "Guardar"}
      </button>
    </div>
  );
}

function Kpi({ title, value, sub, alert }: { title: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${alert ? "border-rose-200" : "border-slate-200/70"}`}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className={`mt-1.5 text-lg font-bold tracking-tight sm:text-xl ${alert ? "text-rose-600" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
