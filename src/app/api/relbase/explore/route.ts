import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/relbase-tokens";

const API_BASE = process.env.RELBASE_API_BASE!;

export async function GET() {
  const token = await getValidToken();
  let page = 1;
  const all: any[] = [];

  while (true) {
    const res = await fetch(`${API_BASE}/compras?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    const arr = j?.data?.compras ?? [];
    all.push(...arr);
    const np = j?.meta?.next_page;
    if (!np || np === -1 || arr.length === 0) break;
    page = np;
    await new Promise((r) => setTimeout(r, 250));
  }

  const byMonth: Record<string, number> = {};
  for (const c of all) {
    const m = (c.start_date ?? "").slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + 1;
  }

  return NextResponse.json({ total: all.length, byMonth });
}