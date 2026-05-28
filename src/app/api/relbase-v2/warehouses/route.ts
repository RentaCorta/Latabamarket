import { NextResponse } from "next/server";
import { relbaseV2Fetch } from "@/lib/relbase-v2";

export async function GET() {
  try {
    const data = await relbaseV2Fetch("/bodegas");
    return NextResponse.json({ ok: true, raw: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}