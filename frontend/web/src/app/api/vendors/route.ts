import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gestión de proveedores autorizados para servicios de protección radiológica:
// calibración de instrumentos, mantenimiento de equipos, suministro de fuentes
// radiactivas, transporte especializado y servicios de dosimetría personal.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS vendors (
      id              SERIAL PRIMARY KEY,
      name            TEXT        NOT NULL,
      rut             TEXT,
      contact_name    TEXT,
      contact_email   TEXT,
      contact_phone   TEXT,
      address         TEXT,
      city            TEXT,
      services        TEXT[],
      cchen_authorized BOOLEAN    DEFAULT false,
      cchen_auth_number TEXT,
      cchen_expiry    DATE,
      quality_cert    TEXT,
      cert_expiry     DATE,
      active          BOOLEAN     DEFAULT true,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM vendors LIMIT 1`;
  if (rows.length === 0) {
    await sql`
      INSERT INTO vendors
        (name, rut, contact_name, contact_email, contact_phone, address, city,
         services, cchen_authorized, cchen_auth_number, quality_cert, active)
      VALUES
        ('Dositec Ltda.', '76.123.456-7', 'Pedro Soto', 'pedro@dositec.cl', '+56 2 2345 6789',
         'Av. Industrial 1234', 'Santiago',
         ARRAY['calibracion_instrumentos','dosimetria_personal'], true, 'CCHEN-CAL-0042',
         'ISO 17025', true),
        ('Radiaciones S.A.', '76.234.567-8', 'Laura Pérez', 'laura@rsa.cl', '+56 2 3456 7890',
         'Calle Ciencias 567', 'Santiago',
         ARRAY['suministro_fuentes','transporte_radiactivo'], true, 'CCHEN-OP-0117',
         null, true),
        ('Meditec Ltda.', '76.345.678-9', 'Juan Núñez', 'juan@meditec.cl', '+56 32 234 5678',
         'Av. Medicina 890', 'Valparaíso',
         ARRAY['mantenimiento_equipos','calibracion_instrumentos'], false,
         null, 'ISO 9001', true),
        ('Blindajes Chile SpA', '76.456.789-0', 'Ana Castro', 'ana@blindajeschile.cl', '+56 2 5678 9012',
         'Parque Industrial Oeste 234', 'Santiago',
         ARRAY['diseño_blindaje','construccion_blindaje'], false,
         null, null, true)
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const service  = searchParams.get("service");
  const cchen    = searchParams.get("cchen");
  const active   = searchParams.get("active");

  try {
    let rows;
    if (service && cchen === "true" && active !== "false") {
      ({ rows } = await sql`SELECT * FROM vendors WHERE ${service} = ANY(services) AND cchen_authorized=true AND active=true ORDER BY name`);
    } else if (service) {
      ({ rows } = await sql`SELECT * FROM vendors WHERE ${service} = ANY(services) AND active=true ORDER BY name`);
    } else if (cchen === "true") {
      ({ rows } = await sql`SELECT * FROM vendors WHERE cchen_authorized=true AND active=true ORDER BY name`);
    } else if (active === "false") {
      ({ rows } = await sql`SELECT * FROM vendors WHERE active=false ORDER BY name`);
    } else {
      ({ rows } = await sql`SELECT * FROM vendors ORDER BY active DESC, name`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE active=true) AS active,
        COUNT(*) FILTER (WHERE cchen_authorized=true AND active=true) AS cchen_auth,
        COUNT(*) FILTER (WHERE cchen_expiry < now() AND cchen_authorized=true) AS cchen_expired,
        COUNT(*) FILTER (WHERE cert_expiry < now() AND cert_expiry IS NOT NULL) AS cert_expired
      FROM vendors
    `;

    return NextResponse.json({ vendors: rows, stats: stats[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "name requerido" }, { status: 400 });
    const services = Array.isArray(body.services) ? body.services :
      (body.services ? body.services.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
    const { rows } = await sql`
      INSERT INTO vendors
        (name, rut, contact_name, contact_email, contact_phone, address, city,
         services, cchen_authorized, cchen_auth_number, cchen_expiry, quality_cert,
         cert_expiry, active, notes)
      VALUES
        (${body.name}, ${body.rut ?? null}, ${body.contact_name ?? null},
         ${body.contact_email ?? null}, ${body.contact_phone ?? null},
         ${body.address ?? null}, ${body.city ?? null},
         ${services}, ${body.cchen_authorized ?? false},
         ${body.cchen_auth_number ?? null}, ${body.cchen_expiry ?? null},
         ${body.quality_cert ?? null}, ${body.cert_expiry ?? null},
         ${body.active ?? true}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ vendor: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["name","rut","contact_name","contact_email","contact_phone","address","city",
      "cchen_authorized","cchen_auth_number","cchen_expiry","quality_cert","cert_expiry","active","notes"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length && !body.services) return NextResponse.json({ error: "Sin campos" }, { status: 400 });

    if (body.services !== undefined) {
      const services = Array.isArray(body.services) ? body.services :
        (body.services ? body.services.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
      const { rows } = await sql`UPDATE vendors SET services=${services}, updated_at=now() WHERE id=${id} RETURNING *`;
      if (fields.length === 0) return NextResponse.json({ vendor: rows[0] });
    }

    if (!fields.length) return NextResponse.json({ error: "Sin campos editables" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(`UPDATE vendors SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals);
    return NextResponse.json({ vendor: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    // Soft-delete
    const { rows } = await sql`UPDATE vendors SET active=false, updated_at=now() WHERE id=${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deactivated: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
