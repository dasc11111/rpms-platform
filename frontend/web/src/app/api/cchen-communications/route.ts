import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §82 — Gestión de Comunicaciones y Correspondencia Oficial con CCHEN
// NS-06.0 §8.3 — DS 3/1985 Art. 10, 15
// Toda la correspondencia oficial entre el establecimiento y CCHEN debe ser
// registrada y archivada para garantizar la trazabilidad del cumplimiento regulatorio.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_communications (
      id                SERIAL PRIMARY KEY,
      comm_code         TEXT        NOT NULL UNIQUE,
      direction         TEXT        NOT NULL DEFAULT 'outgoing'
                        CHECK (direction IN ('outgoing','incoming','internal')),
      comm_type         TEXT        NOT NULL DEFAULT 'letter'
                        CHECK (comm_type IN ('letter','email','report','request','response','notification','inspection_report','license_response','annual_report','other')),
      subject           TEXT        NOT NULL,
      reference_number  TEXT,
      cchen_reference   TEXT,
      sender            TEXT,
      recipient         TEXT,
      comm_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
      received_date     DATE,
      response_due_date DATE,
      responded_date    DATE,
      status            TEXT        NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('draft','sent','received','acknowledged','response_pending','responded','archived','cancelled')),
      priority          TEXT        DEFAULT 'normal'
                        CHECK (priority IN ('urgent','high','normal','low')),
      summary           TEXT,
      content           TEXT,
      attachments       TEXT,
      related_module    TEXT,
      related_id        INTEGER,
      response_comm_id  INTEGER,
      tags              TEXT,
      notes             TEXT,
      active            BOOLEAN     DEFAULT true,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function nextCode(year: number, direction: string): Promise<string> {
  const prefix = direction === "incoming" ? "CCHEN-IN" : direction === "internal" ? "INT" : "CCHEN-OUT";
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*)::int AS n FROM cchen_communications WHERE direction=$1 AND EXTRACT(YEAR FROM comm_date)=$2`,
    [direction, year]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM cchen_communications`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();

  const comms = [
    // Incoming from CCHEN
    {
      comm_code: `CCHEN-IN-${year - 1}-001`,
      direction: "incoming",
      comm_type: "inspection_report",
      subject: "Informe de Inspección Radiológica Rutinaria — Hospital Dr. Hernán Henríquez Aravena",
      reference_number: `CCH-INS-${year - 1}-0234`,
      cchen_reference: `CCH-INS-${year - 1}-0234`,
      sender: "División de Seguridad Radiológica, CCHEN",
      recipient: "Encargado de Protección Radiológica — Hospital HHA",
      comm_date: `${year - 1}-06-30`,
      received_date: `${year - 1}-07-02`,
      response_due_date: `${year - 1}-09-30`,
      status: "responded",
      priority: "high",
      summary: "Informe oficial de la inspección rutinaria realizada el 15-Jun. Incluye 7 hallazgos (1 crítico). Plazo para subsanación: 90 días desde recepción.",
      attachments: `Informe_Inspeccion_CCH-INS-${year - 1}-0234.pdf (45 págs)`,
      related_module: "cchen_inspections",
      tags: "inspección,hallazgos,plazo",
    },
    {
      comm_code: `CCHEN-IN-${year - 1}-002`,
      direction: "incoming",
      comm_type: "license_response",
      subject: "Otorgamiento de Licencia de Operación — Equipo de RX Digital Sala 1 (Siemens MULTIX Impact)",
      reference_number: `CCH-LIC-${year - 1}-0245`,
      cchen_reference: `CCH-LIC-${year - 1}-0245`,
      sender: "División de Licenciamiento, CCHEN",
      recipient: "Encargado de Protección Radiológica — Hospital HHA",
      comm_date: `${year - 1}-04-15`,
      received_date: `${year - 1}-04-18`,
      status: "archived",
      priority: "normal",
      summary: "Licencia de operación otorgada para equipo RX digital Siemens MULTIX Impact, S/N SIM-2019-7843. Vigencia 2 años.",
      attachments: "Licencia_RX_CCH-LIC-2024-0245.pdf",
      related_module: "operating_licenses",
      tags: "licencia,RX,aprobación",
    },
    {
      comm_code: `CCHEN-IN-${year}-001`,
      direction: "incoming",
      comm_type: "inspection_report",
      subject: "Informe de Inspección de Seguimiento — Hospital Dr. Hernán Henríquez Aravena",
      reference_number: `CCH-INS-${year}-0089`,
      cchen_reference: `CCH-INS-${year}-0089`,
      sender: "División de Seguridad Radiológica, CCHEN",
      recipient: "Encargado de Protección Radiológica — Hospital HHA",
      comm_date: `${year}-03-25`,
      received_date: `${year}-03-27`,
      response_due_date: `${year}-06-25`,
      status: "response_pending",
      priority: "high",
      summary: "Informe de inspección de seguimiento (20-Mar). Calificación satisfactoria general. 2 recomendaciones pendientes (Plan de Emergencia, digitalización de dosis histórica).",
      attachments: `Informe_Seguimiento_CCH-INS-${year}-0089.pdf`,
      related_module: "cchen_inspections",
      tags: "seguimiento,inspección",
    },
    // Outgoing to CCHEN
    {
      comm_code: `CCHEN-OUT-${year - 1}-001`,
      direction: "outgoing",
      comm_type: "report",
      subject: `Declaración Anual de Dosis ante CCHEN — Año ${year - 1}`,
      reference_number: `DECL-CCHEN-${year - 1}-01`,
      sender: "TM. Diego Solís C. — Encargado PR, Hospital HHA",
      recipient: "División de Dosimetría, CCHEN",
      comm_date: `${year}-02-15`,
      status: "acknowledged",
      priority: "high",
      summary: `Declaración anual de dosis recibidas por POE durante ${year - 1}. Total POE: 12 trabajadores. Sin superaciones de límites de dosis.`,
      attachments: `Declaracion_Anual_${year - 1}.pdf, Anexo_Dosis_Individuales_${year - 1}.xlsx`,
      related_module: "cchen_declarations",
      responded_date: `${year}-03-10`,
      tags: "declaración,dosis,anual",
    },
    {
      comm_code: `CCHEN-OUT-${year - 1}-002`,
      direction: "outgoing",
      comm_type: "response",
      subject: `Respuesta a Informe de Inspección CCH-INS-${year - 1}-0234 — Plan de Subsanación`,
      reference_number: `RESP-CCH-INS-${year - 1}-0234`,
      cchen_reference: `CCH-INS-${year - 1}-0234`,
      sender: "TM. Diego Solís C. + Director Hospital HHA",
      recipient: "División de Seguridad Radiológica, CCHEN",
      comm_date: `${year - 1}-09-15`,
      status: "sent",
      priority: "high",
      summary: "Plan de subsanación completo para todos los hallazgos de la inspección Jun-2024. Se adjuntan evidencias de corrección del hallazgo crítico (certificado de calibración nuevo) y de los 6 hallazgos menores.",
      attachments: "Plan_Subsanacion_CCH-INS-2024-0234.pdf, Evidencias_Correccion.zip",
      related_module: "cchen_inspections",
      tags: "respuesta,subsanación,inspección",
    },
    {
      comm_code: `CCHEN-OUT-${year}-001`,
      direction: "outgoing",
      comm_type: "request",
      subject: "Solicitud de Renovación de Licencia — Equipo RX Dental Panorámico (Planmeca ProMax)",
      reference_number: "SOL-REN-RX-DEN-001",
      sender: "TM. Diego Solís C. — Encargado PR, Hospital HHA",
      recipient: "División de Licenciamiento, CCHEN",
      comm_date: `${year}-08-01`,
      response_due_date: `${year}-12-31`,
      status: "sent",
      priority: "urgent",
      summary: "Solicitud de renovación de licencia para equipo dental panorámico (CCH-RX-2023-0178, vencida Sep-2025). Se adjuntan todos los documentos requeridos y resultado de prueba de control de calidad.",
      attachments: "Formulario_Renovacion_Licencia.pdf, CQ_Equipo_Dental_2025.pdf, Certificado_Calibracion.pdf",
      related_module: "operating_licenses",
      tags: "solicitud,renovación,licencia,dental",
    },
    {
      comm_code: `CCHEN-OUT-${year}-002`,
      direction: "outgoing",
      comm_type: "notification",
      subject: `Notificación de Incidente Radiológico — Exposición accidental menor (Nivel 1 INES)`,
      sender: "TM. Diego Solís C. — Encargado PR, Hospital HHA",
      recipient: "División de Seguridad Radiológica, CCHEN",
      comm_date: `${year}-05-12`,
      status: "acknowledged",
      priority: "urgent",
      summary: "Notificación de incidente: funcionario no POE accedió temporalmente al área controlada sin dosímetro. Dosis recibida estimada en < 0.1 mSv (nivel 1 INES). Se adjunta informe de incidente y acciones correctivas.",
      attachments: "Informe_Incidente_2025-05-12.pdf",
      related_module: "incidents",
      tags: "incidente,notificación,INES",
      responded_date: `${year}-05-15`,
    },
    // Draft
    {
      comm_code: `CCHEN-OUT-${year}-003`,
      direction: "outgoing",
      comm_type: "response",
      subject: `Respuesta a Informe de Seguimiento CCH-INS-${year}-0089 — Plan de Subsanación`,
      cchen_reference: `CCH-INS-${year}-0089`,
      sender: "TM. Diego Solís C. — Encargado PR, Hospital HHA",
      recipient: "División de Seguridad Radiológica, CCHEN",
      comm_date: `${year}-06-20`,
      response_due_date: `${year}-06-25`,
      status: "draft",
      priority: "high",
      summary: "Borrador de respuesta al informe de seguimiento. Incluye evidencia de actualización del plan de emergencia (hallazgo 1) y propuesta de cronograma para digitalización de dosis histórica (hallazgo 2).",
      related_module: "cchen_inspections",
      tags: "borrador,respuesta,seguimiento",
    },
  ];

  for (const comm of comms) {
    const keys = Object.keys(comm);
    const vals = Object.values(comm);
    await sql.unsafe(
      `INSERT INTO cchen_communications (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) ON CONFLICT (comm_code) DO NOTHING`,
      vals
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const direction = sp.get("direction") ?? "";
    const status = sp.get("status") ?? "";
    const type = sp.get("type") ?? "";
    const q = sp.get("q") ?? "";

    let where = "active=true";
    const params: unknown[] = [];
    if (direction) { params.push(direction); where += ` AND direction=$${params.length}`; }
    if (status) { params.push(status); where += ` AND status=$${params.length}`; }
    if (type) { params.push(type); where += ` AND comm_type=$${params.length}`; }
    if (q) { params.push(`%${q}%`); where += ` AND (subject ILIKE $${params.length} OR summary ILIKE $${params.length} OR reference_number ILIKE $${params.length} OR cchen_reference ILIKE $${params.length})`; }

    const { rows } = await sql.unsafe(
      `SELECT * FROM cchen_communications WHERE ${where}
       ORDER BY
         CASE status WHEN 'draft' THEN 1 WHEN 'response_pending' THEN 2 ELSE 3 END,
         comm_date DESC`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE direction='outgoing')::int AS outgoing,
          COUNT(*) FILTER (WHERE direction='incoming')::int AS incoming,
          COUNT(*) FILTER (WHERE status='response_pending')::int AS response_pending,
          COUNT(*) FILTER (WHERE status='draft')::int AS drafts,
          COUNT(*) FILTER (WHERE priority='urgent' AND status NOT IN ('archived','cancelled'))::int AS urgent,
          COUNT(*) FILTER (WHERE status='response_pending' AND response_due_date < CURRENT_DATE)::int AS overdue_responses
        FROM cchen_communications WHERE active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ communications: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { ...data } = body;
    const dateYear = data.comm_date ? new Date(data.comm_date as string).getFullYear() : new Date().getFullYear();
    const code = data.comm_code || await nextCode(dateYear, data.direction ?? "outgoing");
    const fields = { comm_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO cchen_communications (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ communication: rows[0] }, { status: 201 });
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
      `UPDATE cchen_communications SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ communication: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql.unsafe(`UPDATE cchen_communications SET active=false, updated_at=now() WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
