/**
 * GET  /api/auth/me   — devuelve datos del usuario autenticado
 * PATCH /api/auth/me  — actualiza nombre y teléfono
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById, sanitizeUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function resolveUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  return getUserById(payload.uid);
}

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(sanitizeUser(user));
}

export async function PATCH(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;

  // Ensure phone column exists
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;

  const { rows } = await sql`
    UPDATE users
    SET
      name  = COALESCE(${name}, name),
      phone = COALESCE(${phone}, phone)
    WHERE id = ${user.id}
    RETURNING *
  `;
  return NextResponse.json(sanitizeUser(rows[0]));
}
