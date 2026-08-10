import { NextResponse } from "next/server";
import { validateInstrument } from "@/lib/linac-instrument-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || searchParams.get("instrument") || "").trim();
  const result = await validateInstrument(q);
  return NextResponse.json(result);
}
