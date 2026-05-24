import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/relbase-tokens";

const API_BASE = process.env.RELBASE_API_BASE!;
const CANDIDATES = [
  "/dtes/47899368?type_document=39",
  "/dtes/47899368",
];

export async function GET() {
  const token = await getValidToken();
  const results: unknown[] = [];

  for (const path of CANDIDATES) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(body);
      } catch {}
      results.push({ path, status: res.status, body: parsed ?? body.slice(0, 500) });
    } catch (e) {
      results.push({ path, error: (e as Error).message });
    }
  }

  return NextResponse.json({ results });
}