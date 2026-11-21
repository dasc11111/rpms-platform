import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const active = searchParams.get("active");

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS system_users (
        id SERIAL PRIMARY KEY,
        rut VARCHAR(12) UNIQUE NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE,
        role VARCHAR(50) NOT NULL DEFAULT 'readonly',
        department VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Seed demo users if empty
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM system_users`;
    if ((cnt[0] as { n: number }).n === 0) {
      await sql`
        INSERT INTO system_users (rut, full_name, email, role, department)
        VALUES
          ('16397583-1', 'Diego Armando Solís Catalán', 'diego.solis@hospital.cl', 'opr', 'Prevención de Riesgos'),
          ('12345678-9', 'María González López', 'maria.gonzalez@hospital.cl', 'medico_nuclear', 'Medicina Nuclear'),
          ('98765432-1', 'Carlos Muñoz Pérez', 'carlos.munoz@hospital.cl', 'tm', 'Medicina Nuclear'),
          ('11111111-1', 'Ana Torres Vidal', 'ana.torres@hospital.cl', 'readonly', 'Administración')
      `;
    }

    if (role) {
      const { rows } = await sql`
        SELECT id, rut, full_name, email, role, department, is_active,
               last_login::text, created_at::text
        FROM system_users
        WHERE role = ${role}
        ORDER BY full_name ASC
      `;
      return NextResponse.json({ users: rows });
    }

    if (active !== null) {
      const isActive = active === "true";
      const { rows } = await sql`
        SELECT id, rut, full_name, email, role, department, is_active,
               last_login::text, created_at::text
        FROM system_users
        WHERE is_active = ${isActive}
        ORDER BY full_name ASC
      `;
      return NextResponse.json({ users: rows });
    }

    const { rows } = await sql`
      SELECT id, rut, full_name, email, role, department, is_active,
             last_login::text, created_at::text
      FROM system_users
      ORDER BY role ASC, full_name ASC
    `;
    return NextResponse.json({ users: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rut: string;
      full_name: string;
      email?: string;
      role: string;
      department?: string;
    };

    const { rows } = await sql`
      INSERT INTO system_users (rut, full_name, email, role, department)
      VALUES (${body.rut}, ${body.full_name}, ${body.email ?? null}, ${body.role}, ${body.department ?? null})
      RETURNING id, rut, full_name, email, role, department, is_active, created_at::text
    `;
    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id: number;
      role?: string;
      is_active?: boolean;
      department?: string;
      email?: string;
    };

    if (body.role !== undefined) {
      await sql`UPDATE system_users SET role = ${body.role}, updated_at = NOW() WHERE id = ${body.id}`;
    }
    if (body.is_active !== undefined) {
      await sql`UPDATE system_users SET is_active = ${body.is_active}, updated_at = NOW() WHERE id = ${body.id}`;
    }
    if (body.department !== undefined) {
      await sql`UPDATE system_users SET department = ${body.department}, updated_at = NOW() WHERE id = ${body.id}`;
    }
    if (body.email !== undefined) {
      await sql`UPDATE system_users SET email = ${body.email}, updated_at = NOW() WHERE id = ${body.id}`;
    }

    const { rows } = await sql`
      SELECT id, rut, full_name, email, role, department, is_active, updated_at::text
      FROM system_users WHERE id = ${body.id}
    `;
    return NextResponse.json({ user: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
