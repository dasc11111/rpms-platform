import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §80 — Gestión de Licencias de Operación CCHEN por Equipo/Área
// DS 3/1985 Art. 6-7 — NS-06.0 §3.1
// El establecimiento debe mantener vigentes todas las licencias y autorizaciones
// de operación emitidas por CCHEN para cada fuente, equipo y área radiológica.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS operating_licenses (
      id                SERIAL PRIMARY KEY,
      license_code      TEXT        NOT NULL UNIQUE,
      license_type      TEXT        NOT NULL DEFAULT 'radiation_source'
                        CHECK (license_type IN ('radiation_source','xray_equipment','nuclear_medicine','irradiator','radioactive_waste','area_authorization','other')),
      equipment_name    TEXT        NOT NULL,
      equipment_model   TEXT,
      equipment_serial  TEXT,
      manufacturer      TEXT,
      cchen_license_number TEXT,
      area              TEXT,
      location          TEXT,
      radiation_type    TEXT,
      activity_or_kvp   TEXT,
      issue_date        DATE,
      expiry_date       DATE        NOT NULL,
      renewal_lead_days INTEGER     DEFAULT 90,
      status            TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','expired','suspended','cancelled','pending_renewal','in_process')),
      responsible       TEXT,
      cchen_contact     TEXT,
      renewal_submitted_date DATE,
      renewal_notes     TEXT,
      conditions        TEXT,
      last_inspection_date DATE,
      notes             TEXT,
      active            BOOLEAN     DEFAULT true,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS license_renewals (
      id                SERIAL PRIMARY KEY,
      license_id        INTEGER     REFERENCES operating_licenses(id) ON DELETE CASCADE,
      renewal_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
      previous_expiry   DATE,
      new_expiry        DATE        NOT NULL,
      submitted_by      TEXT,
      cchen_reference   TEXT,
      documents         TEXT,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function nextCode(type: string): Promise<string> {
  const prefix: Record<string, string> = {
    radiation_source: "LIC-FTE", xray_equipment: "LIC-RX",
    nuclear_medicine: "LIC-MN", irradiator: "LIC-IRR",
    radioactive_waste: "LIC-RES", area_authorization: "LIC-AREA", other: "LIC-OTR"
  };
  const p = prefix[type] ?? "LIC";
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*)::int AS n FROM operating_licenses WHERE license_type=$1`, [type]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `${p}-${String(n).padStart(3, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM operating_licenses`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();

  const licenses = [
    {
      license_code: "LIC-FTE-001",
      license_type: "radiation_source",
      equipment_name: "Fuente Sellada Tc-99m — Generador Gamma",
      equipment_model: "GEN-TC99M-30",
      cchen_license_number: `CCH-FS-${year}-0012`,
      area: "Medicina Nuclear — Sala de Preparación",
      location: "2° Piso, Bloque D",
      radiation_type: "Gamma (140 keV)",
      activity_or_kvp: "30 GBq (actividad máxima)",
      issue_date: `${year}-01-10`,
      expiry_date: `${year + 1}-01-09`,
      status: "active",
      responsible: "TM. Diego Solís C.",
      conditions: "Uso exclusivo para diagnóstico en medicina nuclear. Verificación de blindaje semestral.",
      notes: "Licencia de uso de fuente radiactiva para generador Tc-99m.",
    },
    {
      license_code: "LIC-RX-001",
      license_type: "xray_equipment",
      equipment_name: "Equipo de RX Digital — Sala 1",
      equipment_model: "Siemens MULTIX Impact",
      equipment_serial: "SIM-2019-7843",
      manufacturer: "Siemens Healthineers",
      cchen_license_number: `CCH-RX-${year - 1}-0245`,
      area: "Radiología — Sala 1",
      location: "1° Piso, Bloque C",
      radiation_type: "RX (Bremsstrahlung)",
      activity_or_kvp: "150 kVp máximo",
      issue_date: `${year - 1}-04-15`,
      expiry_date: `${year + 1}-04-14`,
      status: "active",
      responsible: "Jefe de Radiología",
      cchen_contact: "Ing. Carlos Méndez CCHEN RM",
      conditions: "Control de calidad trimestral obligatorio. Área controlada señalizada.",
      last_inspection_date: `${year}-03-20`,
    },
    {
      license_code: "LIC-RX-002",
      license_type: "xray_equipment",
      equipment_name: "Equipo Dental Panorámico",
      equipment_model: "Planmeca ProMax",
      equipment_serial: "PMX-2020-4521",
      manufacturer: "Planmeca",
      cchen_license_number: `CCH-RX-${year - 2}-0178`,
      area: "Dental — Radiología Oral",
      location: "3° Piso, Bloque A",
      radiation_type: "RX dental (Panorámico)",
      activity_or_kvp: "90 kVp máximo",
      issue_date: `${year - 2}-09-01`,
      expiry_date: `${year}-09-01`,
      status: "expired",
      responsible: "Jefe de Dental",
      renewal_notes: "Renovación atrasada. Equipo en espera de visita CCHEN para inspección previa a renovación.",
    },
    {
      license_code: "LIC-MN-001",
      license_type: "nuclear_medicine",
      equipment_name: "Gamma Cámara — SPECT",
      equipment_model: "Siemens Symbia T2",
      equipment_serial: "SYM-2018-1123",
      manufacturer: "Siemens Healthineers",
      cchen_license_number: `CCH-MN-${year}-0034`,
      area: "Medicina Nuclear — Sala de Adquisición",
      location: "2° Piso, Bloque D",
      radiation_type: "Gamma (detección)",
      issue_date: `${year}-02-01`,
      expiry_date: `${year + 1}-01-31`,
      status: "active",
      responsible: "TM. Diego Solís C.",
      conditions: "CQ diario antes de primer estudio. Calibración semestral de colimadores.",
      last_inspection_date: `${year}-03-20`,
    },
    {
      license_code: "LIC-RES-001",
      license_type: "radioactive_waste",
      equipment_name: "Área de Almacenamiento Transitorio de Residuos Radiactivos",
      cchen_license_number: `CCH-RES-${year - 1}-0056`,
      area: "Medicina Nuclear — Área de Residuos",
      location: "2° Piso, Bloque D (sala interior)",
      radiation_type: "Gamma, Beta",
      issue_date: `${year - 1}-07-20`,
      expiry_date: `${year + 2}-07-19`,
      status: "active",
      responsible: "TM. Diego Solís C.",
      conditions: "Capacidad máxima: 50 Lt. Control de inventario mensual. Acceso restringido.",
      notes: "Autorización de almacenamiento transitorio para decaimiento de residuos de MN.",
    },
    {
      license_code: "LIC-AREA-001",
      license_type: "area_authorization",
      equipment_name: "Área Controlada — Medicina Nuclear Completa",
      cchen_license_number: `CCH-AREA-${year}-0007`,
      area: "Medicina Nuclear",
      location: "2° Piso, Bloque D (completo)",
      radiation_type: "Mixto",
      issue_date: `${year}-01-10`,
      expiry_date: `${year + 1}-01-09`,
      status: "active",
      responsible: "TM. Diego Solís C.",
      conditions: "Señalización de área controlada vigente. Monitoreo de área mensual. Plan de emergencia actualizado.",
    },
    {
      license_code: "LIC-RX-003",
      license_type: "xray_equipment",
      equipment_name: "Tomógrafo CT — Scanner Multicorte",
      equipment_model: "GE Revolution CT",
      equipment_serial: "GER-2021-9981",
      manufacturer: "GE Healthcare",
      cchen_license_number: `CCH-RX-${year}-0067`,
      area: "Radiología — Sala CT",
      location: "1° Piso, Bloque C",
      radiation_type: "RX (Tomografía)",
      activity_or_kvp: "140 kVp máximo",
      issue_date: `${year}-03-01`,
      expiry_date: `${year + 1}-02-28`,
      status: "active",
      responsible: "Jefe de Radiología",
      conditions: "CTDI mensual. Protocolo de optimización de dosis implementado.",
      last_inspection_date: `${year}-03-20`,
    },
    {
      license_code: "LIC-FTE-002",
      license_type: "radiation_source",
      equipment_name: "Fuente de Verificación Co-57 — Gamma Cámara",
      equipment_model: "Capintec CRC-55tR",
      cchen_license_number: `CCH-FS-${year - 1}-0089`,
      area: "Medicina Nuclear",
      location: "2° Piso, Bloque D",
      radiation_type: "Gamma (122 keV)",
      activity_or_kvp: "185 MBq (al date de manufactura)",
      issue_date: `${year - 1}-06-01`,
      expiry_date: `${year}-12-01`,
      status: "pending_renewal",
      responsible: "TM. Diego Solís C.",
      renewal_submitted_date: `${year}-09-15`,
      renewal_notes: "Solicitud de renovación enviada a CCHEN en sept. Fuente en límite de vida útil — evaluar reemplazo.",
    },
  ];

  for (const lic of licenses) {
    const keys = Object.keys(lic);
    const vals = Object.values(lic);
    await sql.unsafe(
      `INSERT INTO operating_licenses (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) ON CONFLICT (license_code) DO NOTHING`,
      vals
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const licId = sp.get("lic_id");
    const type = sp.get("type") ?? "";
    const status = sp.get("status") ?? "";
    const expiring = sp.get("expiring");

    if (licId) {
      const { rows } = await sql.unsafe(`SELECT * FROM license_renewals WHERE license_id=$1 ORDER BY renewal_date DESC`, [licId]);
      return NextResponse.json({ renewals: rows });
    }

    let where = "active=true";
    const params: unknown[] = [];
    if (type) { params.push(type); where += ` AND license_type=$${params.length}`; }
    if (status) { params.push(status); where += ` AND status=$${params.length}`; }
    if (expiring) {
      params.push(parseInt(expiring));
      where += ` AND expiry_date <= CURRENT_DATE + ($${params.length} || ' days')::interval AND status='active'`;
    }

    const { rows } = await sql.unsafe(
      `SELECT *,
        EXTRACT(DAY FROM expiry_date - CURRENT_DATE)::int AS days_to_expiry
       FROM operating_licenses WHERE ${where}
       ORDER BY expiry_date ASC`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='active')::int AS active,
          COUNT(*) FILTER (WHERE status='expired')::int AS expired,
          COUNT(*) FILTER (WHERE status='suspended')::int AS suspended,
          COUNT(*) FILTER (WHERE status='pending_renewal')::int AS pending_renewal,
          COUNT(*) FILTER (WHERE status='active' AND expiry_date <= CURRENT_DATE + INTERVAL '90 days')::int AS expiring_90d,
          COUNT(*) FILTER (WHERE status='active' AND expiry_date <= CURRENT_DATE + INTERVAL '30 days')::int AS expiring_30d
        FROM operating_licenses WHERE active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ licenses: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "renewal") {
      const { license_id, new_expiry, ...rest } = data;
      const keys = ["license_id", "new_expiry", ...Object.keys(rest)];
      const vals = [license_id, new_expiry, ...Object.values(rest)];
      const { rows } = await sql.unsafe(
        `INSERT INTO license_renewals (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
        vals
      );
      // Update the license expiry + status
      await sql.unsafe(
        `UPDATE operating_licenses SET expiry_date=$1, status='active', renewal_submitted_date=NULL, updated_at=now() WHERE id=$2`,
        [new_expiry, license_id]
      );
      return NextResponse.json({ renewal: rows[0] }, { status: 201 });
    }

    const code = data.license_code || await nextCode(data.license_type ?? "other");
    const fields = { license_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO operating_licenses (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ license: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);
    const { rows } = await sql.unsafe(
      `UPDATE operating_licenses SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ license: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql.unsafe(`UPDATE operating_licenses SET active=false, updated_at=now() WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
