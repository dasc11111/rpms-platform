import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gestión de Procedimientos de Trabajo con Radiaciones Ionizantes
// DS 3/1985 — Los procedimientos deben estar documentados, revisados y
// disponibles para los trabajadores. Control de versiones obligatorio.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS procedures (
      id              SERIAL PRIMARY KEY,
      code            TEXT        NOT NULL UNIQUE,
      title           TEXT        NOT NULL,
      category        TEXT        NOT NULL DEFAULT 'general',
      service         TEXT,
      version         TEXT        NOT NULL DEFAULT '1.0',
      status          TEXT        NOT NULL DEFAULT 'draft',
      description     TEXT,
      scope           TEXT,
      responsible     TEXT,
      reviewer        TEXT,
      approver        TEXT,
      effective_date  DATE,
      review_date     DATE,
      next_review     DATE,
      frequency_months INT        DEFAULT 24,
      location        TEXT,
      references_norm TEXT,
      notes           TEXT,
      active          BOOLEAN     DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM procedures LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO procedures
        (code, title, category, service, version, status, description, responsible,
         reviewer, approver, effective_date, next_review, frequency_months, references_norm)
      VALUES
        ('PRP-MN-001', 'Administración de radiofármacos a pacientes', 'clinical', 'Medicina Nuclear',
         '2.1', 'approved', 'Procedimiento para la administración segura de radiofármacos diagnósticos y terapéuticos en pacientes.',
         'Jefe Medicina Nuclear', 'Encargado PR', 'Director Médico',
         ${`${y}-01-15`}, ${`${y + 2}-01-15`}, 24, 'DS 3/1985 Art. 15; IAEA Safety Reports No. 40'),
        ('PRP-RF-001', 'Preparación y control de calidad de radiofármacos', 'radiopharmacy', 'Radiofarmacia',
         '1.3', 'approved', 'Preparación de radiofármacos bajo condiciones de asepsia y control dosimétrico en sala de calibración.',
         'Radiofarmacéutico', 'Encargado PR', 'Director Técnico',
         ${`${y}-02-01`}, ${`${y + 2}-02-01`}, 24, 'GFR N° 10/2010; USP <823>'),
        ('PRP-PR-001', 'Respuesta a emergencias radiológicas', 'emergency', null,
         '3.0', 'approved', 'Protocolo de respuesta ante derrames, exposiciones accidentales y emergencias con material radiactivo.',
         'Encargado PR', 'Jefe PABH', 'Director',
         ${`${y - 1}-06-01`}, ${`${y + 1}-06-01`}, 12, 'DS 3/1985 Art. 42; IAEA EPR-Medical 2020'),
        ('PRP-PR-002', 'Monitoreo de área y gestión de zonas clasificadas', 'monitoring', null,
         '1.0', 'review', 'Procedimiento para el monitoreo periódico de áreas de trabajo y actualización de clasificación de zonas.',
         'Encargado PR', null, null,
         null, ${`${y}-12-01`}, 12, 'DS 3/1985 Art. 25'),
        ('PRP-WM-001', 'Gestión de residuos radiactivos de vida corta', 'waste', null,
         '2.0', 'approved', 'Clasificación, almacenamiento temporal, decaimiento y disposición de residuos radiactivos de vida corta.',
         'Encargado PR', 'Jefe PABH', 'Director',
         ${`${y}-03-01`}, ${`${y + 2}-03-01`}, 24, 'DS 3/1985; IAEA GSG-1; DS 148/2004')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status   = searchParams.get("status");
  const service  = searchParams.get("service");

  try {
    let rows;
    if (category && status) {
      ({ rows } = await sql`SELECT * FROM procedures WHERE category=${category} AND status=${status} AND active=true ORDER BY code`);
    } else if (category) {
      ({ rows } = await sql`SELECT * FROM procedures WHERE category=${category} AND active=true ORDER BY code`);
    } else if (status) {
      ({ rows } = await sql`SELECT * FROM procedures WHERE status=${status} AND active=true ORDER BY code`);
    } else if (service) {
      ({ rows } = await sql`SELECT * FROM procedures WHERE (service=${service} OR service IS NULL) AND active=true ORDER BY code`);
    } else {
      ({ rows } = await sql`SELECT * FROM procedures WHERE active=true ORDER BY category, code`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft,
        COUNT(*) FILTER (WHERE status = 'review') AS review,
        COUNT(*) FILTER (WHERE next_review < now() AND status = 'approved') AS overdue_review,
        COUNT(*) FILTER (WHERE next_review BETWEEN now() AND now() + INTERVAL '90 days') AS upcoming_review
      FROM procedures WHERE active=true
    `;

    const { rows: cats } = await sql`
      SELECT category, COUNT(*)::int AS cnt FROM procedures WHERE active=true GROUP BY category ORDER BY category
    `;

    return NextResponse.json({ procedures: rows, stats: stats[0], categories: cats });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.code || !body.title) {
      return NextResponse.json({ error: "code y title requeridos" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO procedures
        (code, title, category, service, version, status, description, scope,
         responsible, reviewer, approver, effective_date, review_date, next_review,
         frequency_months, location, references_norm, notes)
      VALUES
        (${body.code}, ${body.title}, ${body.category ?? "general"}, ${body.service ?? null},
         ${body.version ?? "1.0"}, ${body.status ?? "draft"}, ${body.description ?? null},
         ${body.scope ?? null}, ${body.responsible ?? null}, ${body.reviewer ?? null},
         ${body.approver ?? null}, ${body.effective_date ?? null}, ${body.review_date ?? null},
         ${body.next_review ?? null}, ${body.frequency_months ?? 24}, ${body.location ?? null},
         ${body.references_norm ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ procedure: rows[0] }, { status: 201 });
  } catch (err) {
    if (String(err).includes("unique")) {
      return NextResponse.json({ error: "El código ya existe" }, { status: 409 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["title","category","service","version","status","description","scope",
      "responsible","reviewer","approver","effective_date","review_date","next_review",
      "frequency_months","location","references_norm","notes","active"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(`UPDATE procedures SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals);
    return NextResponse.json({ procedure: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`UPDATE procedures SET active=false, updated_at=now() WHERE id=${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deactivated: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
