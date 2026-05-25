"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from "recharts";

type Summary = { total: number; neto: number; transactions: number; avg_ticket: number; cost: number; profit: number };
type Kpis = {
  range: { from: string; to: string; shift: string };
  summary: Summary;
  prev_summary: Summary;
  daily: { day: string; total: number; transactions: number }[];
  hourly: { hour: number; total: number; transactions: number }[];
  top_products: { name: string; units: number; revenue: number }[];
  category_mix: { grupo: string; revenue: number }[];
  sellers: { seller_id: number; total: number; transactions: number }[];
  service_weekly: { week: string; grupo: string; units: number; revenue: number }[];
  coffee_weekly: { week: string; units: number; revenue: number }[];
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

const C = { indigo: "#4f46e5", emerald: "#10b981", amber: "#f59e0b", slate: "#cbd5e1" };
const MIX: Record<string, string> = { Servicio: "#4f46e5", "Café": "#f59e0b", Retail: "#94a3b8" };

export default function Dashboard() {
  const [preset, setPreset] = useState("mes");
  const [range, setRange] = useState(presetRange("mes"));
  const [shift, setShift] = useState("all");
  const [prodMetric, setProdMetric] = useState<"revenue" | "units">("revenue");
  const [hourMetric, setHourMetric] = useState<"total" | "transactions">("total");
  const [coffeeMetric, setCoffeeMetric] = useState<"units" | "revenue">("units");
  const [serviceMetric, setServiceMetric] = useState<"units" | "revenue">("units");
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

  const applyPreset = (p: string) => { setPreset(p); setRange(presetRange(p)); };
  const applyCustom = (field: "from" | "to", v: string) => { setPreset("custom"); setRange((r) => ({ ...r, [field]: v })); };
  const delta = (cur: unknown, prev: unknown) => { const a = Number(cur), b = Number(prev); return b > 0 ? ((a - b) / b) * 100 : null; };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight">La Taba · Panel de KPIs</h1>
        <p className="mt-1 text-sm text-slate-500">
          {range.from} a {range.to}{shift !== "all" && ` · turno ${shift === "manana" ? "mañana" : "tarde"}`}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
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
          <div className="ml-auto flex gap-1.5">
            {[["all", "Todo el día"], ["manana", "Mañana"], ["tarde", "Tarde"]].map(([k, l]) => (
              <button key={k} onClick={() => setShift(k)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${shift === k ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{l}</button>
            ))}
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl bg-rose-50 p-4 text-rose-700">Error: {error}</div>}
        {loading && <div className="mt-6 text-slate-400">Cargando…</div>}

        {kpis && !loading && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi title="Ventas" value={clp(kpis.summary.total)} delta={delta(kpis.summary.total, kpis.prev_summary?.total)} />
              <Kpi title="Venta neta" value={clp(kpis.summary.neto)} delta={delta(kpis.summary.neto, kpis.prev_summary?.neto)} />
              <Kpi title="Utilidad" value={clp(kpis.summary.profit)} delta={delta(kpis.summary.profit, kpis.prev_summary?.profit)}
                sub={Number(kpis.summary.neto) > 0 ? `margen ${Math.round((Number(kpis.summary.profit) / Number(kpis.summary.neto)) * 100)}%` : undefined} />
              <Kpi title="Ticket promedio" value={clp(kpis.summary.avg_ticket)} delta={delta(kpis.summary.avg_ticket, kpis.prev_summary?.avg_ticket)} />
              <Kpi title="Transacciones" value={num(kpis.summary.transactions)} delta={delta(kpis.summary.transactions, kpis.prev_summary?.transactions)} />
            </div>

            <Card className="mt-4" title="Ventas por día">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={kpis.daily.map((d) => ({ label: d.day.slice(5), total: Number(d.total) }))}>
                  <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={0.25} /><stop offset="100%" stopColor={C.indigo} stopOpacity={0} />
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} />
                  <Tooltip formatter={(v) => clp(v)} />
                  <Area type="monotone" dataKey="total" stroke={C.indigo} strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title="Productos más vendidos" action={<Toggle value={prodMetric} onChange={(v) => setProdMetric(v as "revenue" | "units")} options={[["revenue", "Ingreso"], ["units", "Cantidad"]]} />}>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart layout="vertical" margin={{ left: 8 }}
                    data={[...kpis.top_products].sort((a, b) => Number(b[prodMetric]) - Number(a[prodMetric])).slice(0, 10).map((p) => ({ name: p.name, val: Number(p[prodMetric]) }))}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => prodMetric === "revenue" ? `$${Math.round(v / 1000)}K` : num(v)} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
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
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={kpis.coffee_weekly.map((c) => ({ week: `Sem. ${c.week.slice(5)}`, val: Number(c[coffeeMetric]) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => coffeeMetric === "revenue" ? `$${Math.round(v / 1000)}K` : num(v)} />
                    <Tooltip formatter={(v) => coffeeMetric === "revenue" ? clp(v) : num(v)} />
                    <Bar dataKey="val" fill={C.amber} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Ventas por vendedor">
                {(() => {
                  const max = Math.max(...kpis.sellers.map((s) => Number(s.total)), 1);
                  return (
                    <div className="space-y-3">
                      {kpis.sellers.map((s) => (
                        <div key={s.seller_id}>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Vendedor #{s.seller_id ?? "—"}</span>
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

            <Card className="mt-4" title="Servicio semana a semana" action={<Toggle value={serviceMetric} onChange={(v) => setServiceMetric(v as "units" | "revenue")} options={[["units", "Cantidad"], ["revenue", "Ingreso"]]} />}>
              {(() => {
                const weeks = [...new Set(kpis.service_weekly.map((r) => r.week))].sort();
                const cell = (w: string, g: string) => {
                  const row = kpis.service_weekly.find((r) => r.week === w && r.grupo === g);
                  return row ? Number(row[serviceMetric]) : 0;
                };
                const f = serviceMetric === "revenue" ? clp : num;
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
                              <td className="py-2">Sem. {w.slice(5)}</td>
                              <td className="py-2 text-right">{f(c)}</td>
                              <td className="py-2 text-right">{f(ch)}</td>
                              <td className="py-2 text-right">{f(sa)}</td>
                              <td className="py-2 text-right font-semibold">{f(c + ch + sa)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function Kpi({ title, value, delta, sub }: { title: string; value: string; delta: number | null; sub?: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight">{value}</p>
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
    <div className={`rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between">
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