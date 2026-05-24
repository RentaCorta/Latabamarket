"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

type Kpis = {
  summary: { total_sales: number; transactions: number; avg_ticket: number };
  daily: { day: string; transactions: number; total: number }[];
  hourly: { hour: number; transactions: number; total: number }[];
  top_products: { name: string; units: number; revenue: number }[];
};

const clp = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kpis")
      .then((r) => r.json())
      .then((d) => (d.ok ? setKpis(d) : setError(d.error ?? "Error")))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!kpis) return <div className="p-8 text-gray-500">Cargando KPIs…</div>;

  const peak = kpis.hourly.reduce((a, b) => (Number(b.transactions) > Number(a.transactions) ? b : a), kpis.hourly[0]);
  const daily = kpis.daily.slice(-30).map((d) => ({
    label: new Date(d.day).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
    total: Number(d.total),
  }));
  const hourly = kpis.hourly.map((h) => ({ hour: h.hour, transactions: Number(h.transactions) }));
  const top = kpis.top_products.slice(0, 8).map((p) => ({ name: p.name, revenue: Number(p.revenue) }));

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold text-gray-900">Panel de KPIs · Minimarket</h1>
        <p className="mt-1 text-sm text-gray-500">Últimos 90 días · datos desde relBase</p>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card title="Ventas (90 días)" value={clp(kpis.summary.total_sales)} />
          <Card title="Ticket promedio" value={clp(kpis.summary.avg_ticket)} />
          <Card title="Transacciones" value={kpis.summary.transactions.toLocaleString("es-CL")} />
          <Card title="Hora pico" value={`${peak.hour}:00`} sub={`${peak.transactions} ventas`} />
        </div>

        <Section title="Ventas por día (últimos 30)">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => clp(Number(v))} />
              <Area type="monotone" dataKey="total" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Section title="Productos más vendidos (por ingreso)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => clp(Number(v))} />
                <Bar dataKey="revenue" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Ventas por hora">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="transactions" radius={[4, 4, 0, 0]}>
                  {hourly.map((h, i) => (
                    <Cell key={i} fill={h.hour === peak.hour ? "#f59e0b" : "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-gray-700">{title}</h2>
      {children}
    </div>
  );
}