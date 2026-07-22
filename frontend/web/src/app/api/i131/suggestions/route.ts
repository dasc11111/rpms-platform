import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { I131_SUGGESTION_FIELDS } from "@/lib/i131";

export const dynamic = "force-dynamic";

// Autocompletado inteligente: devuelve los valores mas usados para un campo,
// opcionalmente filtrados por texto parcial (q). Se alimenta automaticamente
// de la tabla i131_field_suggestions, que crece con cada registro nuevo o
// editado (ver /api/i131 y /api/i131/[id]).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const field = searchParams.get("field") ?? "";
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "8")));

  if (!(I131_SUGGESTION_FIELDS as readonly string[]).includes(field)) {
    return NextResponse.json({ error: "Campo no soportado para sugerencias" }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT value, usage_count, last_used_at
    FROM i131_field_suggestions
    WHERE field_name = ${field}
      AND (${q} = '' OR value ILIKE ${"%" + q + "%"})
    ORDER BY usage_count DESC, last_used_at DESC
    LIMIT ${limit}
  `;

  return NextResponse.json({ values: rows.map((r) => r.value), rows });
}
