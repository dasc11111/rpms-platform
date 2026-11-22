import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §77 — Proveedores de Servicios de Dosimetría y Calibración Externa
// NS-06.0 §5.3: Todo proveedor de servicios de PR (dosimetría, calibración,
// evaluación radiológica) debe contar con acreditación vigente y ser
// supervisado por el Encargado PR.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS service_providers (
      id                SERIAL PRIMARY KEY,
      provider_code     TEXT        NOT NULL UNIQUE,
      name              TEXT        NOT NULL,
      rut               TEXT,
      service_type      TEXT        NOT NULL DEFAULT 'dosimetry'
                        CHECK (service_type IN (
                          'dosimetry','calibration','radioactive_waste',
                          'radiation_survey','training','equipment_maintenance',
                          'radiological_assessment','cchen_services','other'
                        )),
      contact_name      TEXT,
      contact_phone     TEXT,
      contact_email     TEXT,
      address           TEXT,
      city              TEXT,
      region            TEXT,
      accreditation_body TEXT,
      accreditation_number TEXT,
      accreditation_start DATE,
      accreditation_expiry DATE,
      cchen_authorization TEXT,
      cchen_auth_expiry   DATE,
      iso_certification   TEXT,
      iso_cert_expiry     DATE,
      contract_start    DATE,
      contract_expiry   DATE,
      contract_number   TEXT,
      last_service_date DATE,
      next_service_date DATE,
      service_frequency TEXT        DEFAULT 'annual'
                        CHECK (service_frequency IN ('monthly','quarterly','biannual','annual','on_demand')),
      status            TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','expired','suspended')),
      evaluation_score  NUMERIC(3,1),
      evaluation_date   DATE,
      notes             TEXT,
      active            BOOLEAN     DEFAULT true,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS provider_evaluations (
      id              SERIAL PRIMARY KEY,
      provider_id     INTEGER     REFERENCES service_providers(id) ON DELETE CASCADE,
      eval_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
      evaluator       TEXT,
      score           NUMERIC(3,1) CHECK (score BETWEEN 1 AND 5),
      criteria_quality     INTEGER CHECK (criteria_quality BETWEEN 1 AND 5),
      criteria_timeliness  INTEGER CHECK (criteria_timeliness BETWEEN 1 AND 5),
      criteria_compliance  INTEGER CHECK (criteria_compliance BETWEEN 1 AND 5),
      criteria_support     INTEGER CHECK (criteria_support BETWEEN 1 AND 5),
      comments        TEXT,
      action_required TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function nextCode(type: string): Promise<string> {
  const prefix = {
    dosimetry: "PROV-DOS",
    calibration: "PROV-CAL",
    radioactive_waste: "PROV-RES",
    radiation_survey: "PROV-INS",
    training: "PROV-CAP",
    equipment_maintenance: "PROV-MAN",
    radiological_assessment: "PROV-EVA",
    cchen_services: "PROV-CCH",
    other: "PROV-OTR",
  }[type] ?? "PROV-OTR";
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*) AS n FROM service_providers WHERE service_type=$1`,
    [type]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `${prefix}-${String(n).padStart(2, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM service_providers`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const seeds = [
    {
      provider_code: "PROV-DOS-01",
      name: "Comisión Chilena de Energía Nuclear (CCHEN) — Dosimetría Personal",
      rut: "61.207.000-6",
      service_type: "dosimetry",
      contact_name: "Departamento de Protección Radiológica CCHEN",
      contact_phone: "+56 2 2965 0000",
      contact_email: "proteccion@cchen.cl",
      address: "Amunátegui 95",
      city: "Santiago",
      region: "Metropolitana",
      accreditation_body: "CCHEN",
      accreditation_number: "CCHEN-DOS-001",
      accreditation_start: "2024-01-01",
      accreditation_expiry: "2026-12-31",
      cchen_authorization: "CCHEN-AUTH-PR-2024-001",
      cchen_auth_expiry: "2026-12-31",
      contract_start: "2024-01-01",
      contract_expiry: "2026-12-31",
      contract_number: "CTR-PR-2024-001",
      last_service_date: "2026-10-31",
      next_service_date: "2026-11-30",
      service_frequency: "monthly",
      status: "active",
      evaluation_score: 4.8,
      evaluation_date: "2026-06-30",
      notes: "Proveedor oficial de dosimetría TLD para todo el personal POE del Hospital",
    },
    {
      provider_code: "PROV-CAL-01",
      name: "INDEG — Instituto de Desarrollo y Control de Calidad",
      rut: "77.123.456-7",
      service_type: "calibration",
      contact_name: "Ing. Jorge Fuentes",
      contact_phone: "+56 2 2345 6789",
      contact_email: "calibracion@indeg.cl",
      address: "Av. Vitacura 2909",
      city: "Santiago",
      region: "Metropolitana",
      accreditation_body: "Instituto Nacional de Normalización (INN)",
      accreditation_number: "INN-CAL-2345",
      accreditation_start: "2025-03-01",
      accreditation_expiry: "2027-02-28",
      iso_certification: "ISO/IEC 17025:2017",
      iso_cert_expiry: "2027-02-28",
      contract_start: "2025-03-01",
      contract_expiry: "2027-02-28",
      contract_number: "CTR-CAL-2025-003",
      last_service_date: "2026-04-15",
      next_service_date: "2027-04-15",
      service_frequency: "annual",
      status: "active",
      evaluation_score: 4.5,
      evaluation_date: "2026-04-15",
      notes: "Calibración anual de Geiger-Müller, contadores proporcionales e instrumentos de medición de dosis",
    },
    {
      provider_code: "PROV-RES-01",
      name: "GEOTEC S.A. — Gestión de Residuos Radiactivos",
      rut: "88.234.567-8",
      service_type: "radioactive_waste",
      contact_name: "Dra. Carmen Rivas",
      contact_phone: "+56 9 8765 4321",
      contact_email: "residuos@geotec.cl",
      address: "Ruta 5 Norte Km 45",
      city: "Lampa",
      region: "Metropolitana",
      accreditation_body: "CCHEN",
      accreditation_number: "CCHEN-RES-2024-005",
      cchen_authorization: "CCHEN-RES-005",
      cchen_auth_expiry: "2026-06-30",
      contract_start: "2024-07-01",
      contract_expiry: "2026-06-30",
      contract_number: "CTR-RES-2024-007",
      last_service_date: "2026-09-01",
      next_service_date: "2027-03-01",
      service_frequency: "biannual",
      status: "expired",
      evaluation_score: 3.8,
      evaluation_date: "2026-09-01",
      notes: "ADVERTENCIA: Autorización CCHEN vencida el 30-JUN-2026. Gestión de retiro de fuentes selladas I-131 y Tc-99m residuos en mora.",
    },
    {
      provider_code: "PROV-CAP-01",
      name: "Instituto de Salud Pública de Chile (ISP) — Capacitación PR",
      rut: "61.502.000-5",
      service_type: "training",
      contact_name: "Departamento de Radiaciones Ionizantes ISP",
      contact_phone: "+56 2 2575 5000",
      contact_email: "radiaciones@ispch.cl",
      address: "Marathon 1000",
      city: "Ñuñoa",
      region: "Metropolitana",
      accreditation_body: "ISP — MINSAL",
      accreditation_number: "ISP-CAP-2025-012",
      accreditation_start: "2025-01-01",
      accreditation_expiry: "2027-12-31",
      contract_start: "2025-01-01",
      contract_expiry: "2027-12-31",
      last_service_date: "2026-05-20",
      next_service_date: "2027-05-01",
      service_frequency: "annual",
      status: "active",
      evaluation_score: 4.6,
      evaluation_date: "2026-05-20",
      notes: "Cursos de Radioprotección para personal de Medicina Nuclear y Radiología. Incluye habilitación para Encargado PR.",
    },
    {
      provider_code: "PROV-MAN-01",
      name: "Siemens Healthineers Chile — Mantenimiento Equipos",
      rut: "78.567.890-1",
      service_type: "equipment_maintenance",
      contact_name: "Ing. Roberto Castro",
      contact_phone: "+56 2 2456 7890",
      contact_email: "service.chile@siemens-healthineers.com",
      address: "Av. Apoquindo 4800",
      city: "Las Condes",
      region: "Metropolitana",
      accreditation_body: "Siemens International",
      accreditation_number: "SH-CL-MAN-2024",
      accreditation_start: "2024-01-01",
      accreditation_expiry: "2027-12-31",
      contract_start: "2024-01-01",
      contract_expiry: "2027-12-31",
      contract_number: "CTR-SIE-2024-MED",
      last_service_date: "2026-10-01",
      next_service_date: "2027-04-01",
      service_frequency: "biannual",
      status: "active",
      evaluation_score: 4.3,
      evaluation_date: "2026-10-01",
      notes: "Mantenimiento preventivo y correctivo equipos gamma cámara, PET y detectores de radiación de Medicina Nuclear",
    },
  ];

  for (const s of seeds) {
    const keys = Object.keys(s);
    const vals = Object.values(s);
    await sql.unsafe(
      `INSERT INTO service_providers (${keys.join(",")})
       VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})
       ON CONFLICT (provider_code) DO NOTHING`,
      vals
    );
  }
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const providerId = sp.get("provider_id");

    if (providerId) {
      const { rows } = await sql.unsafe(
        `SELECT * FROM provider_evaluations WHERE provider_id=$1 ORDER BY eval_date DESC`,
        [parseInt(providerId)]
      );
      return NextResponse.json({ evaluations: rows });
    }

    const type    = sp.get("type") ?? "";
    const status  = sp.get("status") ?? "";
    const expiring = sp.get("expiring") === "1";

    const conditions: string[] = [`active=true`];
    const params: unknown[] = [];

    if (type)   { params.push(type);   conditions.push(`service_type=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`status=$${params.length}`); }
    if (expiring) {
      conditions.push(`(accreditation_expiry <= CURRENT_DATE + INTERVAL '90 days' OR cchen_auth_expiry <= CURRENT_DATE + INTERVAL '90 days' OR contract_expiry <= CURRENT_DATE + INTERVAL '90 days')`);
    }

    const { rows } = await sql.unsafe(
      `SELECT p.*,
        (SELECT COUNT(*) FROM provider_evaluations e WHERE e.provider_id=p.id)::int AS eval_count,
        (SELECT MAX(eval_date) FROM provider_evaluations e WHERE e.provider_id=p.id) AS last_eval_date
       FROM service_providers p
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE p.status WHEN 'expired' THEN 1 WHEN 'suspended' THEN 2 WHEN 'active' THEN 3 ELSE 4 END,
         p.service_type, p.name`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='active')::int AS active,
          COUNT(*) FILTER (WHERE status='expired' OR status='suspended')::int AS critical,
          COUNT(*) FILTER (WHERE accreditation_expiry <= CURRENT_DATE + INTERVAL '90 days' AND status='active')::int AS accreditation_expiring,
          COUNT(*) FILTER (WHERE cchen_auth_expiry <= CURRENT_DATE + INTERVAL '90 days' AND status='active')::int AS cchen_expiring,
          COUNT(*) FILTER (WHERE contract_expiry <= CURRENT_DATE + INTERVAL '90 days' AND status='active')::int AS contract_expiring,
          ROUND(AVG(evaluation_score), 1)::float AS avg_score
        FROM service_providers WHERE active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ providers: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "evaluation") {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      // Update provider evaluation_score
      if (data.score && data.provider_id) {
        await sql.unsafe(
          `UPDATE service_providers SET evaluation_score=$1, evaluation_date=$2, updated_at=now() WHERE id=$3`,
          [data.score, data.eval_date || new Date().toISOString().split("T")[0], data.provider_id]
        );
      }
      const { rows } = await sql.unsafe(
        `INSERT INTO provider_evaluations (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
        vals
      );
      return NextResponse.json({ evaluation: rows[0] }, { status: 201 });
    }

    const code = data.provider_code || await nextCode(data.service_type ?? "other");
    const fields = { provider_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO service_providers (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ provider: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { _type, id, ...rest } = body;
    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);

    if (_type === "evaluation") {
      const { rows } = await sql.unsafe(
        `UPDATE provider_evaluations SET ${set} WHERE id=$${values.length} RETURNING *`,
        values
      );
      return NextResponse.json({ evaluation: rows[0] });
    }

    const { rows } = await sql.unsafe(
      `UPDATE service_providers SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ provider: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql.unsafe(`UPDATE service_providers SET active=false, updated_at=now() WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
