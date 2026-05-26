"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from "recharts";

type Summary = { total: number; neto: number; exempt: number; transactions: number; avg_ticket: number; cost: number; profit: number };
type SlowMover = { product_id: number; name: string; category: string; stock: number; last_sold: string; days_since: number };
type Kpis = {
  range: { from: string; to: string; shift: string };
  summary: Summary;
  prev_summary: Summary;
  daily: { day: string; total: number; neto: number; transactions: number }[];
  hourly: { hour: number; total: number; transactions: number }[];
  top_products: { name: string; units: number; revenue: number }[];
  category_mix: { grupo: string; revenue: number }[];
  sellers: { seller_id: number; seller: string; total: number; transactions: number }[];
  service_weekly: { week: string; grupo: string; units: number; revenue: number }[];
  coffee_weekly: { week: string; units: number; revenue: number }[];
  categories: { category: string; units: number; revenue: number }[];
  purchases_summary: { purchased_neto: number; purchased_total: number; purchases_count: number; sales_neto: number };
  purchases_by_provider: { provider: string; docs: number; neto: number }[];
  purchases_vs_sales: { week: string; compras: number; ventas: number }[];
};

const clp = (n: unknown) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const num = (n: unknown) => new Intl.NumberFormat("es-CL").format(Number(n) || 0);

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function presetRange(preset: string) {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  if (preset === "mes") return { from: fmtDate(new Date(y, m, 1)), to: fmtDate(t) };
  if (preset === "mes_anterior") return { from: fmtDate(new Date(y, m - 1, 1)), to: fmtDate(new Date(y, m, 0)) };
  return { from: fmtDate(new Date(y, m - 2, 1)), to: fmtDate(t) };
}

// Dado "YYYY-MM-DD" devuelve la fecha del lunes de esa semana y el día (0=Lun..6=Dom)
function weekInfo(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0=Lun..6=Dom
  dt.setUTCDate(dt.getUTCDate() - dow);
  const weekKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  return { weekKey, dow };
}

const C = { indigo: "#4f46e5", emerald: "#10b981", amber: "#f59e0b", slate: "#cbd5e1" };
const MIX: Record<string, string> = { Servicio: "#4f46e5", "Café": "#f59e0b", Retail: "#94a3b8" };

export default function Dashboard() {
  const [tab, setTab] = useState("general");
  const [preset, setPreset] = useState("mes");
  const [range, setRange] = useState(presetRange("mes"));
  const [shift, setShift] = useState("all");
  const [prodMetric, setProdMetric] = useState<"revenue" | "units">("revenue");
  const [hourMetric, setHourMetric] = useState<"total" | "transactions">("total");
  const [coffeeMetric, setCoffeeMetric] = useState<"units" | "revenue">("units");
  const [serviceMetric, setServiceMetric] = useState<"units" | "revenue">("units");
  const [dowMetric, setDowMetric] = useState<"total" | "neto">("total");
  const [prodSearch, setProdSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [slowDays, setSlowDays] = useState(15);
  const [slowCat, setSlowCat] = useState("todas");
  const [slowMovers, setSlowMovers] = useState<SlowMover[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ from: range.from, to: range.to, shift });
    fetch(`/api/kpis?${q}`)
      .then((r) => r.json())
      .then((d) => { d.ok ? setKpis(d) : setError(d.error); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [range, shift]);

  useEffect(() => {
    fetch(`/api/slow-movers?days=${slowDays}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSlowMovers(d.slow_movers ?? []); })
      .catch(() => {});
  }, [slowDays]);

  const applyPreset = (p: string) => { setPreset(p); setRange(presetRange(p)); };
  const applyCustom = (field: "from" | "to", v: string) => { setPreset("custom"); setRange((r) => ({ ...r, [field]: v })); };
  const delta = (cur: unknown, prev: unknown) => { const a = Number(cur), b = Number(prev); return b > 0 ? ((a - b) / b) * 100 : null; };

  const exportServiceExcel = () => {
    if (!kpis) return;
    const weeks = [...new Set(kpis.service_weekly.map((r) => r.week))].sort();
    const val = (w: string, g: string, k: "units" | "revenue") => {
      const row = kpis.service_weekly.find((r) => r.week === w && r.grupo === g);
      return row ? Number(row[k]) : 0;
    };
    const rows = weeks.map((w) => ({
      Semana: `Sem. ${w.slice(5)}`,
      "Completos (cant)": val(w, "Completos", "units"), "Completos ($)": val(w, "Completos", "revenue"),
      "Churrascos (cant)": val(w, "Churrascos", "units"), "Churrascos ($)": val(w, "Churrascos", "revenue"),
      "Sandwiches (cant)": val(w, "Sandwiches", "units"), "Sandwiches ($)": val(w, "Sandwiches", "revenue"),
      "Total (cant)": val(w, "Completos", "units") + val(w, "Churrascos", "units") + val(w, "Sandwiches", "units"),
      "Total ($)": val(w, "Completos", "revenue") + val(w, "Churrascos", "revenue") + val(w, "Sandwiches", "revenue"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Servicio");
    XLSX.writeFile(wb, `servicio-${kpis.range.from}-a-${kpis.range.to}.xlsx`);
  };

  const exportSlowExcel = () => {
    const filtered = slowMovers.filter((s) => slowCat === "todas" || s.category === slowCat);
    const rows = filtered.map((s) => ({
      Producto: s.name, "Categoría": s.category, Stock: Number(s.stock),
      "Última venta": s.last_sold, "Días sin vender": Number(s.days_since),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sin rotación");
    XLSX.writeFile(wb, `sin-rotacion-${slowDays}dias.xlsx`);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 md:px-8">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">La Taba · Panel de KPIs</h1>
        <p className="mt-1 text-sm text-slate-500">
          {range.from} a {range.to}{shift !== "all" && tab !== "compras" && ` · turno ${shift === "manana" ? "mañana" : "tarde"}`}
        </p>

        {/* Pestañas */}
        <div className="mt-5 flex gap-1.5 overflow-x-auto border-b border-slate-200">
          {[["general", "General"], ["productos", "Productos y categorías"], ["compras", "Compras"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${tab === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{l}</button>
          ))}
        </div>

        {/* Filtros (aplican a todas las pestañas) */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[["mes", "Este mes"], ["mes_anterior", "Mes anterior"], ["3meses", "Últimos 3 meses"]].map(([k, l]) => (
              <button key={k} onClick={() => applyPreset(k)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${preset === k ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <input type="date" value={range.from} onChange={(e) => applyCustom("from", e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5" />
            <span className="text-slate-400">→</span>
            <input type="date" value={range.to} onChange={(e) => applyCustom("to", e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5" />
          </div>
          {tab !== "compras" && (
            <div className="flex gap-1.5 sm:ml-auto">
              {[["all", "Todo el día"], ["manana", "Mañana"], ["tarde", "Tarde"]].map(([k, l]) => (
                <button key={k} onClick={() => setShift(k)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${shift === k ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="mt-6 rounded-xl bg-rose-50 p-4 text-rose-700">Error: {error}</div>}
        {loading && <div className="mt-6 text-slate-400">Cargando…</div>}

        {/* ===== PESTAÑA GENERAL ===== */}
        {kpis && !loading && tab === "general" && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <Kpi title="Ventas" value={clp(kpis.summary.total)} delta={delta(kpis.summary.total, kpis.prev_summary?.total)} />
              <Kpi title="Venta neta" value={clp(kpis.summary.neto)} delta={delta(kpis.summary.neto, kpis.prev_summary?.neto)} />
              <Kpi title="Venta exenta" value={clp(kpis.summary.exempt)} delta={delta(kpis.summary.exempt, kpis.prev_summary?.exempt)} />
              <Kpi title="Costo total productos" value={clp(kpis.summary.cost)} delta={delta(kpis.summary.cost, kpis.prev_summary?.cost)} />
              <Kpi title="Utilidad" value={clp(kpis.summary.profit)} delta={delta(kpis.summary.profit, kpis.prev_summary?.profit)}
                sub={Number(kpis.summary.neto) > 0 ? `margen ${Math.round((Number(kpis.summary.profit) / Number(kpis.summary.neto)) * 100)}%` : undefined} />
              <Kpi title="Ticket promedio" value={clp(kpis.summary.avg_ticket)} delta={delta(kpis.summary.avg_ticket, kpis.prev_summary?.avg_ticket)} />
              <Kpi title="Transacciones" value={num(kpis.summary.transactions)} delta={delta(kpis.summary.transactions, kpis.prev_summary?.transactions)} />
            </div>

            <Card className="mt-4" title="Ventas por día">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={kpis.daily.map((d) => ({ label: d.day.slice(5), total: Number(d.total), neto: Number(d.neto) }))}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.indigo} stopOpacity={0.25} /><stop offset="100%" stopColor={C.indigo} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g1b" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.emerald} stopOpacity={0.2} /><stop offset="100%" stopColor={C.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
                  <Tooltip formatter={(v) => clp(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="total" name="Ventas" stroke={C.indigo} strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="neto" name="Venta neta" stroke={C.emerald} strokeWidth={2} fill="url(#g1b)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title="Productos más vendidos" action={<Toggle value={prodMetric} onChange={(v) => setProdMetric(v as "revenue" | "units")} options={[["revenue", "Ingreso"], ["units", "Cantidad"]]} />}>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart layout="vertical" margin={{ left: 8 }}
                    data={[...kpis.top_products].sort((a, b) => Number(b[prodMetric]) - Number(a[prodMetric])).slice(0, 10).map((p) => ({ name: p.name, val: Number(p[prodMetric]) }))}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => prodMetric === "revenue" ? `$${Math.round(v / 1000)}K` : num(v)} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => prodMetric === "revenue" ? clp(v) : num(v)} />
                    <Bar dataKey="val" fill={C.emerald} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Ventas por hora" action={<Toggle value={hourMetric} onChange={(v) => setHourMetric(v as "total" | "transactions")} options={[["total", "Ingreso"], ["transactions", "Cantidad"]]} />}>
                {(() => {
                  const data = kpis.hourly.map((h) => ({ hour: `${h.hour}h`, val: Number(h[hourMetric]) }));
                  const max = Math.max(...data.map((d) => d.val), 0);
                  return (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => hourMetric === "total" ? `$${Math.round(v / 1000)}K` : num(v)} />
                        <Tooltip formatter={(v) => hourMetric === "total" ? clp(v) : num(v)} />
                        <Bar dataKey="val" radius={[4, 4, 0, 0]}>{data.map((d, i) => <Cell key={i} fill={d.val === max ? C.amber : C.slate} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title="Café de máquina semana a semana" action={<Toggle value={coffeeMetric} onChange={(v) => setCoffeeMetric(v as "units" | "revenue")} options={[["units", "Cantidad"], ["revenue", "Ingreso"]]} />}>
                {(() => {
                  const total = kpis.coffee_weekly.reduce((a, c) => a + Number(c[coffeeMetric]), 0);
                  return (
                    <>
                      <p className="mb-3 text-sm text-slate-500">
                        Total del período: <span className="font-bold text-slate-900">{coffeeMetric === "revenue" ? clp(total) : `${num(total)} cafés`}</span>
                      </p>
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={kpis.coffee_weekly.map((c) => ({ week: `Sem. ${c.week.slice(5)}`, val: Number(c[coffeeMetric]) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => coffeeMetric === "revenue" ? `$${Math.round(v / 1000)}K` : num(v)} />
                          <Tooltip formatter={(v) => coffeeMetric === "revenue" ? clp(v) : num(v)} />
                          <Bar dataKey="val" fill={C.amber} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  );
                })()}
              </Card>

              <Card title="Ventas por vendedor">
                {(() => {
                  const max = Math.max(...kpis.sellers.map((s) => Number(s.total)), 1);
                  return (
                    <div className="space-y-3">
                      {kpis.sellers.map((s) => (
                        <div key={s.seller_id ?? s.seller}>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{s.seller}</span>
                            <span className="font-semibold">{clp(s.total)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(Number(s.total) / max) * 100}%` }} />
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">{num(s.transactions)} transacciones</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>
            </div>

            <Card className="mt-4" title="Servicio semana a semana"
              action={
                <div className="flex items-center gap-2">
                  <button onClick={exportServiceExcel} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">↓ Excel</button>
                  <Toggle value={serviceMetric} onChange={(v) => setServiceMetric(v as "units" | "revenue")} options={[["units", "Cantidad"], ["revenue", "Ingreso"]]} />
                </div>
              }>
              {(() => {
                const weeks = [...new Set(kpis.service_weekly.map((r) => r.week))].sort();
                const cell = (w: string, g: string) => {
                  const row = kpis.service_weekly.find((r) => r.week === w && r.grupo === g);
                  return row ? Number(row[serviceMetric]) : 0;
                };
                const f = serviceMetric === "revenue" ? clp : num;
                const totC = weeks.reduce((a, w) => a + cell(w, "Completos"), 0);
                const totCh = weeks.reduce((a, w) => a + cell(w, "Churrascos"), 0);
                const totSa = weeks.reduce((a, w) => a + cell(w, "Sandwiches"), 0);
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="pb-2 font-medium">Semana</th>
                          <th className="pb-2 text-right font-medium">Completos</th>
                          <th className="pb-2 text-right font-medium">Churrascos</th>
                          <th className="pb-2 text-right font-medium">Sandwiches</th>
                          <th className="pb-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeks.map((w) => {
                          const c = cell(w, "Completos"), ch = cell(w, "Churrascos"), sa = cell(w, "Sandwiches");
                          return (
                            <tr key={w} className="border-t border-slate-100">
                              <td className="py-2 whitespace-nowrap">Sem. {w.slice(5)}</td>
                              <td className="py-2 text-right">{f(c)}</td>
                              <td className="py-2 text-right">{f(ch)}</td>
                              <td className="py-2 text-right">{f(sa)}</td>
                              <td className="py-2 text-right font-semibold">{f(c + ch + sa)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 font-bold">
                          <td className="py-2">Total</td>
                          <td className="py-2 text-right">{f(totC)}</td>
                          <td className="py-2 text-right">{f(totCh)}</td>
                          <td className="py-2 text-right">{f(totSa)}</td>
                          <td className="py-2 text-right">{f(totC + totCh + totSa)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </Card>

            <Card className="mt-4" title="Ventas por semana y día"
              action={<Toggle value={dowMetric} onChange={(v) => setDowMetric(v as "total" | "neto")} options={[["total", "Ventas"], ["neto", "Venta neta"]]} />}>
              <p className="mb-3 text-xs text-slate-500">Cada fila es una semana; las columnas son los días, para comparar el mismo día entre semanas.</p>
              {(() => {
                const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
                const rows: Record<string, number[]> = {};
                for (const d of kpis.daily) {
                  const { weekKey, dow } = weekInfo(d.day);
                  if (!rows[weekKey]) rows[weekKey] = [0, 0, 0, 0, 0, 0, 0];
                  rows[weekKey][dow] += Number(dowMetric === "neto" ? d.neto : d.total);
                }
                const weekKeys = Object.keys(rows).sort();
                const colTot = [0, 0, 0, 0, 0, 0, 0];
                weekKeys.forEach((w) => rows[w].forEach((v, i) => { colTot[i] += v; }));
                const grand = colTot.reduce((a, b) => a + b, 0);
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="pb-2 pr-2 font-medium">Semana</th>
                          {DOW.map((d) => <th key={d} className="pb-2 px-2 text-right font-medium">{d}</th>)}
                          <th className="pb-2 pl-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekKeys.map((w) => {
                          const vals = rows[w];
                          const tot = vals.reduce((a, b) => a + b, 0);
                          return (
                            <tr key={w} className="border-t border-slate-100">
                              <td className="py-2 pr-2 whitespace-nowrap">Sem. {w.slice(5)}</td>
                              {vals.map((v, i) => <td key={i} className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{clp(v)}</td>)}
                              <td className="py-2 pl-2 text-right font-semibold tabular-nums whitespace-nowrap">{clp(tot)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 font-bold">
                          <td className="py-2 pr-2">Total</td>
                          {colTot.map((v, i) => <td key={i} className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{clp(v)}</td>)}
                          <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{clp(grand)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </Card>

            <Card className="mt-4" title="Mix de venta por grupo">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={kpis.category_mix.map((c) => ({ name: c.grupo, value: Number(c.revenue) }))} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {kpis.category_mix.map((c, i) => <Cell key={i} fill={MIX[c.grupo] ?? "#94a3b8"} />)}
                  </Pie>
                  <Tooltip formatter={(v) => clp(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {/* ===== PESTAÑA PRODUCTOS Y CATEGORÍAS ===== */}
        {kpis && !loading && tab === "productos" && (() => {
          const prodFiltered = [...kpis.top_products].filter((p) => p.name.toLowerCase().includes(prodSearch.toLowerCase())).sort((a, b) => Number(b.revenue) - Number(a.revenue));
          const catFiltered = [...kpis.categories].filter((c) => c.category.toLowerCase().includes(catSearch.toLowerCase())).sort((a, b) => Number(b.revenue) - Number(a.revenue));
          const slowCats = [...new Set(slowMovers.map((s) => s.category).filter(Boolean))].sort();
          const slowFiltered = slowMovers.filter((s) => slowCat === "todas" || s.category === slowCat);
          return (
            <>
              <Card className="mt-6" title="Productos con stock sin venta">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <select value={slowDays} onChange={(e) => { setSlowDays(Number(e.target.value)); setSlowCat("todas"); }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                    <option value={7}>7+ días sin venta</option>
                    <option value={15}>15+ días sin venta</option>
                    <option value={30}>30+ días sin venta</option>
                    <option value={60}>60+ días sin venta</option>
                  </select>
                  <select value={slowCat} onChange={(e) => setSlowCat(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                    <option value="todas">Todas las categorías</option>
                    {slowCats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={exportSlowExcel} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">↓ Excel</button>
                  <span className="ml-auto text-xs text-slate-400">{slowFiltered.length} productos</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Productos con stock disponible que se vendían pero llevan tiempo sin venderse — candidatos a oferta para rotarlos rápido.</p>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Producto</th>
                        <th className="pb-2 px-4 font-medium">Categoría</th>
                        <th className="pb-2 px-4 text-right font-medium">Stock</th>
                        <th className="pb-2 px-4 text-right font-medium">Última venta</th>
                        <th className="pb-2 pl-6 text-right font-medium">Días sin vender</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowFiltered.map((s) => (
                        <tr key={s.product_id} className="border-t border-slate-100">
                          <td className="py-1.5 pr-4">{s.name}</td>
                          <td className="py-1.5 px-4 text-slate-500 whitespace-nowrap">{s.category ?? "—"}</td>
                          <td className="py-1.5 px-4 text-right tabular-nums">{num(s.stock)}</td>
                          <td className="py-1.5 px-4 text-right tabular-nums whitespace-nowrap">{s.last_sold}</td>
                          <td className="py-1.5 pl-6 text-right font-semibold tabular-nums">{num(s.days_since)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card title={`Productos vendidos (${prodFiltered.length})`}
                  action={<input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Buscar producto…" className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs sm:w-40" />}>
                  <div className="max-h-[560px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-slate-500">
                          <th className="pb-2 pr-4 font-medium">Producto</th>
                          <th className="pb-2 px-4 text-right font-medium">Cantidad</th>
                          <th className="pb-2 pl-6 text-right font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prodFiltered.map((p, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-1.5 pr-4">{p.name}</td>
                            <td className="py-1.5 px-4 text-right tabular-nums whitespace-nowrap">{num(p.units)}</td>
                            <td className="py-1.5 pl-6 text-right tabular-nums whitespace-nowrap">{clp(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title={`Categorías (${catFiltered.length})`}
                  action={<input value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Buscar categoría…" className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs sm:w-40" />}>
                  <div className="max-h-[560px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-slate-500">
                          <th className="pb-2 pr-4 font-medium">Categoría</th>
                          <th className="pb-2 px-4 text-right font-medium">Cantidad</th>
                          <th className="pb-2 pl-6 text-right font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catFiltered.map((c, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-1.5 pr-4">{c.category}</td>
                            <td className="py-1.5 px-4 text-right tabular-nums whitespace-nowrap">{num(c.units)}</td>
                            <td className="py-1.5 pl-6 text-right tabular-nums whitespace-nowrap">{clp(c.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          );
        })()}

        {/* ===== PESTAÑA COMPRAS ===== */}
        {kpis && !loading && tab === "compras" && (() => {
          const ps = kpis.purchases_summary;
          const ratio = ps && Number(ps.sales_neto) > 0 ? (Number(ps.purchased_neto) / Number(ps.sales_neto)) * 100 : null;
          return (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Kpi title="Total comprado (neto)" value={clp(ps?.purchased_neto)} delta={null} sub="facturas de compra" />
                <Kpi title="Total vendido (neto)" value={clp(ps?.sales_neto)} delta={null} sub="en el período" />
                <Kpi title="Compras / Ventas" value={ratio !== null ? `${ratio.toFixed(0)}%` : "—"} delta={null} sub="cuánto compras por venta" />
                <Kpi title="N° de compras" value={num(ps?.purchases_count)} delta={null} sub="facturas" />
              </div>

              <Card className="mt-4" title="Compras vs Ventas por semana">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={kpis.purchases_vs_sales.map((r) => ({ week: `Sem. ${r.week.slice(5)}`, Compras: Number(r.compras), Ventas: Number(r.ventas) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => clp(v)} />
                    <Legend />
                    <Bar dataKey="Ventas" fill={C.indigo} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Compras" fill={C.amber} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="mt-4" title={`Compras por proveedor (${kpis.purchases_by_provider.length})`}>
                <div className="max-h-[460px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Proveedor</th>
                        <th className="pb-2 px-4 text-right font-medium">N° docs</th>
                        <th className="pb-2 pl-6 text-right font-medium">Monto (neto)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.purchases_by_provider.map((p, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 pr-4">{p.provider}</td>
                          <td className="py-1.5 px-4 text-right tabular-nums">{num(p.docs)}</td>
                          <td className="py-1.5 pl-6 text-right tabular-nums whitespace-nowrap">{clp(p.neto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          );
        })()}
      </div>
    </main>
  );
}

function Kpi({ title, value, delta, sub }: { title: string; value: string; delta: number | null; sub?: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {delta !== null && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        <span className="text-slate-400">{sub ?? "vs período anterior"}</span>
      </div>
    </div>
  );
}

function Card({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${value === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{l}</button>
      ))}
    </div>
  );
}
