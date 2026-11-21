import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS trainings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        training_type TEXT NOT NULL DEFAULT 'otro',
        regulation TEXT,
        instructor TEXT,
        training_date DATE,
        expiry_date DATE,
        duration_hours NUMERIC,
        participants_count INT,
        status TEXT NOT NULL DEFAULT 'draft',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const conditions: string[] = [];
    if (status) conditions.push(`status = '${status}'`);
    if (type) conditions.push(`training_type = '${type}'`);

    const { rows } = await sql`
      SELECT * FROM trainings
      ORDER BY training_date DESC NULLS LAST
      LIMIT ${limit}
    `;
    return NextResponse.json({ trainings: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title: string;
      training_type?: string;
      regulation?: string;
      instructor?: string;
      training_date?: string;
      expiry_date?: string;
      duration_hours?: number;
      participants_count?: number;
      status?: string;
      notes?: string;
    };

    const { rows } = await sql`
      INSERT INTO trainings (
        title, training_type, regulation, instructor, training_date,
        expiry_date, duration_hours, participants_count, status, notes
      ) VALUES (
        ${body.title}, ${body.training_type ?? "otro"}, ${body.regulation ?? null},
        ${body.instructor ?? null}, ${body.training_date ?? null},
        ${body.expiry_date ?? null}, ${body.duration_hours ?? null},
        ${body.participants_count ?? null}, ${body.status ?? "draft"}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ training: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
