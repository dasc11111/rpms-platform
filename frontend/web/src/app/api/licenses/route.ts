import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985, DS 133/1984, Ley 18.302: toda instalación radiactiva o nuclear debe
// contar con autorización CCHEN vigente. Este módulo registra y controla las
// autorizaciones, licencias y permisos del establecimiento.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_licenses (
      id              SERIAL PRIMARY KEY,
      license_number  TEXT        NOT NULL,
      license_type    TEXT        NOT NULL DEFAULT 'operation',
      description     TEXT,
      issuing_body    TEXT        NOT NULL DEFAULT 'CCHEN',
      issue_date      DATE        NOT NULL,
      expiry_date     DATE,
      indefinite      BOOLEAN     DEFAULT false,
      scope           TEXT,
      conditions      TEXT,
      status          TEXT        NOT NULL DEFAULT 'active',
      renewal_date    DATE,
      renewal_ref     TEXT,
      document_ref    TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS license_renewals (
      id            SERIAL PRIMARY KEY,
      license_id    INTEGER REFERENCES cchen_licenses(id) ON DELETE CASCADE,
      renewal_date  DATE NOT NULL,
      new_expiry    DATE,
      submitted_by  TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM cchen_licenses LIMIT 1`;
  if (rows.length === 0) {
    const today = new Date();
    const y = today.getFullYear();
    await sql`
      INSERT INTO cchen_licenses (license_number, license_type, description, issuing_body, issue_date, expiry_date, scope, status)
      VALUES
        ('RA-' || ${y-2} || '-00142', 'operation',    'Autorización de Operación — Sala de Captación PET y Medicina Nuclear', 'CCHEN',
         ${`${y-2}-03-15`}, ${`${y+1}-03-14`}, 'Uso de radiofármacos F-18, I-131, Tc-99m en procedimientos diagnósticos y terapéuticos', 'active'),
        ('RA-' || ${y-1} || '-00089', 'sealed_source', 'Autorización Uso Fuente Sellada — Acelerador Linac Varian TrueBeam', 'CCHEN',
         ${`${y-1}-06-01`}, ${`${y+2}-05-31`}, 'Haz de electrones y fotones para radioterapia conformacional y IMRT', 'active'),
        ('RA-' || ${y-3} || '-00031', 'waste',         'Autorización Almacenamiento Transitorio Residuos Radiactivos', 'CCHEN',
         ${`${y-3}-09-20`}, ${`${y}-09-19`}, 'Almacenamiento transitorio de residuos Categoría A, B y C según IAEA GSG-1', 'expiring'),
        ('CP-' || ${y-4} || '-00007', 'personnel',     'Certificación Personal Ocupacionalmente Expuesto — Encargado PR', 'CCHEN',
         ${`${y-4}-01-10`}, null, 'Certificación vigente de Encargado de Protección Radiológica (Tecnólogo Médico)', 'active'),
        ('LI-' || ${y-2} || '-00019', 'installation',  'Licencia de Instalación — Remodelación Sala PET/CT', 'CCHEN',
         ${`${y-2}-11-05`}, ${`${y-1}-05-04`}, 'Modificaciones estructurales en Medicina Nuclear para incorporación equipo PET/CT', 'expired')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type");
  const status = searchParams.get("status");

  try {
    let rows;
    if (type && status) {
      ({ rows } = await sql`
        SELECT * FROM cchen_licenses WHERE license_type = ${type} AND status = ${status}
        ORDER BY expiry_date ASC NULLS LAST`);
    } else if (type) {
      ({ rows } = await sql`
        SELECT * FROM cchen_licenses WHERE license_type = ${type}
        ORDER BY expiry_date ASC NULLS LAST`);
    } else if (status) {
      ({ rows } = await sql`
        SELECT * FROM cchen_licenses WHERE status = ${status}
        ORDER BY expiry_date ASC NULLS LAST`);
    } else {
      ({ rows } = await sql`
        SELECT * FROM cchen_licenses ORDER BY expiry_date ASC NULLS LAST`);
    }

    // Auto-update expiring/expired status based on dates
    const now = new Date().toISOString().slice(0, 10);
    for (const lic of rows) {
      if (!lic.indefinite && lic.expiry_date) {
        const exp = new Date(lic.expiry_date);
        const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
        (lic as Record<string, unknown>).days_left = daysLeft;
        if (daysLeft < 0 && lic.status === "active") {
          await sql`UPDATE cchen_licenses SET status='expired', updated_at=now() WHERE id=${lic.id}`;
          lic.status = "expired";
        } else if (daysLeft <= 90 && daysLeft >= 0 && lic.status === "active") {
          await sql`UPDATE cchen_licenses SET status='expiring', updated_at=now() WHERE id=${lic.id}`;
          lic.status = "expiring";
        }
      }
    }

    // Stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active')   AS active,
        COUNT(*) FILTER (WHERE status = 'expiring') AS expiring,
        COUNT(*) FILTER (WHERE status = 'expired')  AS expired,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
        COUNT(*) FILTER (WHERE indefinite = true)   AS indefinite_count,
        MIN(expiry_date) FILTER (WHERE status IN ('active','expiring') AND indefinite = false) AS next_expiry
      FROM cchen_licenses
    `;

    // Renewals
    const { rows: renewals } = await sql`
      SELECT r.*, l.license_number FROM license_renewals r
      JOIN cchen_licenses l ON l.id = r.license_id
      ORDER BY r.renewal_date DESC LIMIT 20
    `;

    return NextResponse.json({ licenses: rows, stats: stats[0], renewals });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (body.renewal_for) {
      // Add renewal record
      const { rows } = await sql`
        INSERT INTO license_renewals (license_id, renewal_date, new_expiry, submitted_by, notes)
        VALUES (${body.renewal_for}, ${body.renewal_date}, ${body.new_expiry ?? null},
                ${body.submitted_by ?? null}, ${body.notes ?? null})
        RETURNING *
      `;
      if (body.new_expiry) {
        await sql`
          UPDATE cchen_licenses SET expiry_date=${body.new_expiry}, status='active', updated_at=now()
          WHERE id=${body.renewal_for}
        `;
      }
      return NextResponse.json({ renewal: rows[0] }, { status: 201 });
    }

    if (!body.license_number || !body.license_type || !body.issue_date) {
      return NextResponse.json({ error: "license_number, license_type e issue_date son obligatorios" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO cchen_licenses
        (license_number, license_type, description, issuing_body, issue_date, expiry_date,
         indefinite, scope, conditions, status, document_ref, notes)
      VALUES
        (${body.license_number}, ${body.license_type}, ${body.description ?? null},
         ${body.issuing_body ?? "CCHEN"}, ${body.issue_date}, ${body.expiry_date ?? null},
         ${body.indefinite ?? false}, ${body.scope ?? null}, ${body.conditions ?? null},
         ${body.status ?? "active"}, ${body.document_ref ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ license: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["license_number","license_type","description","issuing_body","issue_date",
      "expiry_date","indefinite","scope","conditions","status","document_ref","notes"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(
      `UPDATE cchen_licenses SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals
    );
    return NextResponse.json({ license: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM cchen_licenses WHERE id=${parseInt(id)} RETURNING id, license_number`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
