import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const objectiveId = searchParams.get("objective_id");
  if (!objectiveId) return NextResponse.json([], { status: 200 });
  try {
    const rows = await sql`SELECT * FROM alara_measures WHERE objective_id = ${objectiveId} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
