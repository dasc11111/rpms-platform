import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    const { rows } = await sql`
        SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order,
                   COUNT(d.id)::int AS document_count
                       FROM document_categories c
                           LEFT JOIN documents d ON d.category_id = c.id
                               GROUP BY c.id, c.name, c.slug, c.parent_id, c.sort_order
                                   ORDER BY c.sort_order, c.name
                                     `;
    return NextResponse.json({ categories: rows });
}
