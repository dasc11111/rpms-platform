import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS vendors (
    id                SERIAL PRIMARY KEY,
    vendor_code       TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    rut               TEXT,
    contact_name      TEXT,
    contact_email     TEXT,
    contact_phone     TEXT,
    address           TEXT,
    vendor_type       TEXT DEFAULT 'service',
    services          TEXT,
    cchen_authorized  BOOLEAN DEFAULT FALSE,
    cchen_auth_number TEXT,
    cchen_auth_expiry DATE,
    iso_certified     BOOLEAN DEFAULT FALSE,
    iso_cert_number   TEXT,
    iso_cert_expiry   DATE,
    status            TEXT DEFAULT 'active',
    evaluation_score  INTEGER,
    last_evaluation   DATE,
    next_evaluation   DATE,
    observations      TEXT,
    active            BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vendor_services (
    id            SERIAL PRIMARY KEY,
    vendor_id     INTEGER REFERENCES vendors(id),
    service_code  TEXT NOT NULL,
    service_type  TEXT NOT NULL,
    description   TEXT,
    contract_date DATE,
    expiry_date   DATE,
    contract_value NUMERIC(14,2),
    status        TEXT DEFAULT 'active',
    last_service  DATE,
    next_service  DATE,
    documents     TEXT,
    observations  TEXT,
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )`;

  const { rows } = await sql`SELECT COUNT(*) FROM vendors WHERE active=TRUE`;
  if (Number(rows[0].count) === 0) {
    const { rows: v1 } = await sql`INSERT INTO vendors
      (vendor_code,name,rut,contact_name,contact_email,vendor_type,services,
       cchen_authorized,cchen_auth_number,cchen_auth_expiry,iso_certified,status,evaluation_score,last_evaluation,next_evaluation) VALUES
      ('PROV-001','CCHEN — Comisión Chilena de Energía Nuclear','61.806.000-6','Departamento de Protección Radiológica','dpr@cchen.cl',
       'regulatory','Calibración de instrumentos, dosimetría personal TLD/OSL, asesoría PR, aprobación licencias',
       TRUE,'AUTH-CCHEN-ORG','2030-12-31',FALSE,'active',100,'2026-01-15','2027-01-15')
    RETURNING id`;

    const { rows: v2 } = await sql`INSERT INTO vendors
      (vendor_code,name,rut,contact_name,contact_email,contact_phone,vendor_type,services,
       cchen_authorized,cchen_auth_number,cchen_auth_expiry,status,evaluation_score,last_evaluation,next_evaluation) VALUES
      ('PROV-002','Fluke Biomedical Chile','76.123.456-7','Carlos Mendoza','cmendoza@fluke.com','+56 2 2345 6789',
       'calibration','Calibración y mantenimiento de instrumentos de medida de radiación (ionization chambers, contadores Geiger)',
       TRUE,'CCHEN-CAL-2023-0045','2026-08-31',FALSE,'active',88,'2025-11-10','2026-11-10')
    RETURNING id`;

    await sql`INSERT INTO vendors
      (vendor_code,name,rut,contact_name,contact_email,vendor_type,services,
       cchen_authorized,cchen_auth_number,cchen_auth_expiry,status,evaluation_score,last_evaluation,next_evaluation) VALUES
      ('PROV-003','IBA Dosimetry GmbH (representante Chile)','55.234.567-8','Ana Morales','amorales@iba-group.cl',
       'calibration','Dosimetría para radioterapia, control de calidad Linac, software OmniPro',
       TRUE,'CCHEN-CAL-2022-0067','2026-12-31',TRUE,'active',92,'2026-02-20','2027-02-20')`;

    await sql`INSERT INTO vendors
      (vendor_code,name,rut,contact_name,contact_email,vendor_type,services,
       cchen_authorized,status,evaluation_score,last_evaluation) VALUES
      ('PROV-004','Siemens Healthineers Chile','76.345.678-9','Roberto Fuentes','rfuentes@siemens.cl',
       'equipment','Mantenimiento preventivo y correctivo PET/CT y gamma cámara, actualización de software',
       FALSE,'active',85,'2025-12-15')`;

    await sql`INSERT INTO vendors
      (vendor_code,name,rut,contact_name,vendor_type,services,
       cchen_authorized,cchen_auth_number,cchen_auth_expiry,status,evaluation_score) VALUES
      ('PROV-005','Empresa de Transporte Especializado RADSAFE','76.456.789-0','Patricia Lagos',
       'transport','Transporte de material radiactivo (Categorías I-III), gestión de residuos radiactivos',
       TRUE,'CCHEN-TRANS-2024-0012','2027-03-31','active',79)`;

    if (v1.length && v2.length) {
      await sql`INSERT INTO vendor_services
        (vendor_id,service_code,service_type,description,contract_date,expiry_date,status,last_service,next_service) VALUES
        (${v1[0].id},'SVC-CCHEN-001','dosimetry','Servicio de dosimetría personal TLD/OSL (25 dosímetros bimestrales)','2024-01-01','2026-12-31','active','2026-04-30','2026-06-30'),
        (${v1[0].id},'SVC-CCHEN-002','calibration','Calibración anual de ionization chambers (2 cámaras)','2024-01-01','2026-12-31','active','2026-01-15','2027-01-15'),
        (${v2[0].id},'SVC-FLK-001','calibration','Calibración anual de contadores Geiger-Müller (5 equipos)','2025-03-01','2026-02-28','expired','2025-11-10','2026-11-10')
      `;
    }
  }
}

async function nextVendorCode() {
  const { rows } = await sql`SELECT vendor_code FROM vendors WHERE vendor_code LIKE 'PROV-%' ORDER BY vendor_code DESC LIMIT 1`;
  if (!rows.length) return "PROV-001";
  const n = parseInt((rows[0].vendor_code as string).split("-")[1] ?? "0") + 1;
  return `PROV-${String(n).padStart(3,"0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const status   = sp.get("status");
    const type     = sp.get("type");
    const cchen    = sp.get("cchen");

    const { rows } = await sql`
      SELECT v.*,
        CASE WHEN v.cchen_auth_expiry < NOW() AND v.cchen_authorized THEN TRUE ELSE FALSE END AS cchen_expired,
        CASE WHEN v.next_evaluation < NOW() THEN TRUE ELSE FALSE END AS eval_overdue,
        COALESCE((SELECT json_agg(s ORDER BY s.expiry_date ASC) FROM vendor_services s WHERE s.vendor_id=v.id AND s.active=TRUE),'[]'::json) AS services_list
      FROM vendors v
      WHERE v.active=TRUE
        AND (${status}::text IS NULL OR v.status=${status})
        AND (${type}::text IS NULL OR v.vendor_type=${type})
        AND (${cchen}::text IS NULL OR v.cchen_authorized::text=${cchen})
      ORDER BY v.evaluation_score DESC NULLS LAST, v.name ASC
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active=TRUE) AS total,
        COUNT(*) FILTER (WHERE cchen_authorized=TRUE AND active=TRUE) AS cchen_authorized,
        COUNT(*) FILTER (WHERE cchen_auth_expiry < NOW() AND cchen_authorized=TRUE AND active=TRUE) AS cchen_expired,
        COUNT(*) FILTER (WHERE iso_certified=TRUE AND active=TRUE) AS iso_certified,
        COUNT(*) FILTER (WHERE next_evaluation < NOW() AND active=TRUE) AS eval_overdue,
        ROUND(AVG(evaluation_score) FILTER (WHERE active=TRUE))::int AS avg_score
      FROM vendors
    `;

    return NextResponse.json({ rows, stats: stats[0] });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const b = await req.json();
    const code = await nextVendorCode();
    const { rows } = await sql`
      INSERT INTO vendors (vendor_code,name,rut,contact_name,contact_email,contact_phone,address,
        vendor_type,services,cchen_authorized,cchen_auth_number,cchen_auth_expiry,
        iso_certified,iso_cert_number,iso_cert_expiry,status,evaluation_score,
        last_evaluation,next_evaluation,observations)
      VALUES (${code},${b.name},${b.rut??null},${b.contact_name??null},${b.contact_email??null},
        ${b.contact_phone??null},${b.address??null},${b.vendor_type??"service"},${b.services??null},
        ${b.cchen_authorized??false},${b.cchen_auth_number??null},${b.cchen_auth_expiry??null},
        ${b.iso_certified??false},${b.iso_cert_number??null},${b.iso_cert_expiry??null},
        ${b.status??"active"},${b.evaluation_score??null},
        ${b.last_evaluation??null},${b.next_evaluation??null},${b.observations??null})
      RETURNING *`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const fields = Object.entries(b).filter(([k]) => k !== "id");
    if (!fields.length) return NextResponse.json({ error: "no fields" }, { status: 400 });
    const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    const { rows } = await sql.unsafe(
      `UPDATE vendors SET ${sets}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [b.id, ...fields.map(([,v])=>v)]
    );
    return NextResponse.json(rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql`UPDATE vendors SET active=FALSE WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
