import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS committee_meetings (
    id              SERIAL PRIMARY KEY,
    meeting_code    TEXT NOT NULL UNIQUE,
    meeting_type    TEXT DEFAULT 'ordinary',
    meeting_date    DATE NOT NULL,
    location        TEXT DEFAULT 'Sala de Reuniones Dpto. PR',
    chair           TEXT,
    secretary       TEXT,
    attendees       TEXT,
    quorum          BOOLEAN DEFAULT TRUE,
    agenda          TEXT,
    summary         TEXT,
    agreements      TEXT,
    pending_items   TEXT,
    next_meeting_date DATE,
    status          TEXT DEFAULT 'scheduled',
    document_path   TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS committee_agreements (
    id              SERIAL PRIMARY KEY,
    meeting_id      INTEGER REFERENCES committee_meetings(id),
    agreement_code  TEXT NOT NULL,
    description     TEXT NOT NULL,
    responsible     TEXT,
    deadline        DATE,
    priority        TEXT DEFAULT 'medium',
    status          TEXT DEFAULT 'pending',
    completion_date DATE,
    observations    TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`;

  const { rows } = await sql`SELECT COUNT(*) FROM committee_meetings WHERE active=TRUE`;
  if (Number(rows[0].count) === 0) {
    // Seed meetings
    const { rows: m1 } = await sql`INSERT INTO committee_meetings
      (meeting_code,meeting_type,meeting_date,location,chair,secretary,attendees,quorum,agenda,summary,status,next_meeting_date)
    VALUES ('CPR-2026-003','ordinary','2026-03-15','Sala de Reuniones Dpto. PR','Dr. Marcos Salinas (Director Médico)',
      'Fís. Med. Diego Solís (Encargado PR)',
      'Dr. Salinas (Director Médico), Fís. Med. Solís (Encargado PR), TM. Andrea López (Medicina Nuclear), TM. Carlos Rivas (Radiología), Enf. Carla Muñoz (IAAS)',
      TRUE,
      '1. Revisión dosis dosimetría Q1 2026\n2. Estado instrumentos calibración\n3. Incidentes periodo\n4. Plan capacitación 2026\n5. Varios',
      'Sesión ordinaria con quórum. Se revisaron dosis individuales Q1, todas dentro de límites. Discusión sobre calibración pendiente de 2 ionization chambers. No hubo incidentes en el periodo.',
      'completed','2026-06-15')
    RETURNING id`;

    await sql`INSERT INTO committee_meetings
      (meeting_code,meeting_type,meeting_date,location,chair,secretary,attendees,quorum,agenda,summary,status,next_meeting_date)
    VALUES ('CPR-2026-002','ordinary','2026-01-20','Sala de Reuniones Dpto. PR','Dr. Marcos Salinas (Director Médico)',
      'Fís. Med. Diego Solís (Encargado PR)',
      'Dr. Salinas, Fís. Med. Solís, TM. López, TM. Rivas',
      TRUE,
      '1. Balance anual 2025\n2. Plan PR 2026\n3. Objetivos ALARA 2026',
      'Sesión de inicio de año. Se aprobó el plan de trabajo 2026 y se establecieron objetivos ALARA.',
      'completed','2026-03-15')`;

    await sql`INSERT INTO committee_meetings
      (meeting_code,meeting_type,meeting_date,chair,secretary,attendees,quorum,status,next_meeting_date)
    VALUES ('CPR-2026-004','ordinary','2026-06-15','Dr. Marcos Salinas (Director Médico)',
      'Fís. Med. Diego Solís (Encargado PR)',
      'Por confirmar',TRUE,'scheduled','2026-09-15')`;

    await sql`INSERT INTO committee_meetings
      (meeting_code,meeting_type,meeting_date,chair,secretary,status)
    VALUES ('CPR-2025-004','ordinary','2025-10-18','Dr. Marcos Salinas','Fís. Med. Diego Solís','completed')`;

    // Seed agreements for CPR-2026-003
    if (m1.length) {
      const mid = m1[0].id;
      await sql`INSERT INTO committee_agreements
        (meeting_id,agreement_code,description,responsible,deadline,priority,status) VALUES
        (${mid},'CPR-2026-003-A01','Enviar dosímetros de ionization chambers a calibración CCHEN antes del 30 de abril',
         'Fís. Med. Diego Solís','2026-04-30','high','completed'),
        (${mid},'CPR-2026-003-A02','Actualizar procedimiento de monitoreo de área Medicina Nuclear (versión 2.1)',
         'TM. Andrea López','2026-05-15','medium','in_progress'),
        (${mid},'CPR-2026-003-A03','Programar capacitación en gestión de residuos radiactivos para todo el personal TOE',
         'Fís. Med. Diego Solís','2026-06-01','medium','pending'),
        (${mid},'CPR-2026-003-A04','Presentar informe de incidentes y no-conformidades al Director Médico',
         'Fís. Med. Diego Solís','2026-04-01','low','completed')
      `;
    }
  }
}

async function nextMeetingCode() {
  const year = new Date().getFullYear();
  const { rows } = await sql`SELECT meeting_code FROM committee_meetings WHERE meeting_code LIKE ${`CPR-${year}-%`} ORDER BY meeting_code DESC LIMIT 1`;
  if (!rows.length) return `CPR-${year}-001`;
  const last = rows[0].meeting_code as string;
  const n = parseInt(last.split("-").pop() ?? "0") + 1;
  return `CPR-${year}-${String(n).padStart(3,"0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const type   = sp.get("type");
    const withAgreements = sp.get("agreements") === "1";

    const { rows: meetings } = await sql`
      SELECT m.*,
        (SELECT COUNT(*) FROM committee_agreements a WHERE a.meeting_id=m.id AND a.active=TRUE) AS agreement_count,
        (SELECT COUNT(*) FROM committee_agreements a WHERE a.meeting_id=m.id AND a.status='pending' AND a.active=TRUE) AS pending_agreements,
        (SELECT COUNT(*) FROM committee_agreements a WHERE a.meeting_id=m.id AND a.deadline < NOW() AND a.status NOT IN ('completed','cancelled') AND a.active=TRUE) AS overdue_agreements
      FROM committee_meetings m
      WHERE m.active=TRUE
        AND (${status}::text IS NULL OR m.status=${status})
        AND (${type}::text IS NULL OR m.meeting_type=${type})
      ORDER BY m.meeting_date DESC
    `;

    let agreements: unknown[] = [];
    if (withAgreements) {
      const { rows: ag } = await sql`
        SELECT a.*, m.meeting_code, m.meeting_date
        FROM committee_agreements a
        JOIN committee_meetings m ON a.meeting_id=m.id
        WHERE a.active=TRUE
        ORDER BY a.deadline ASC NULLS LAST
      `;
      agreements = ag;
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE m.active=TRUE) AS total_meetings,
        COUNT(*) FILTER (WHERE m.status='completed' AND m.active=TRUE) AS completed,
        COUNT(*) FILTER (WHERE m.status='scheduled' AND m.active=TRUE) AS scheduled,
        COALESCE((SELECT COUNT(*) FROM committee_agreements WHERE active=TRUE),0) AS total_agreements,
        COALESCE((SELECT COUNT(*) FROM committee_agreements WHERE status='pending' AND active=TRUE),0) AS pending_agreements,
        COALESCE((SELECT COUNT(*) FROM committee_agreements WHERE status='completed' AND active=TRUE),0) AS completed_agreements,
        COALESCE((SELECT COUNT(*) FROM committee_agreements WHERE deadline < NOW() AND status NOT IN ('completed','cancelled') AND active=TRUE),0) AS overdue_agreements
      FROM committee_meetings m
    `;

    return NextResponse.json({ rows: meetings, agreements, stats: stats[0] });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const b = await req.json();

    if (b._type === "agreement") {
      const { rows } = await sql`
        INSERT INTO committee_agreements (meeting_id,agreement_code,description,responsible,deadline,priority,status,observations)
        VALUES (${b.meeting_id},${b.agreement_code},${b.description},${b.responsible??null},${b.deadline??null},${b.priority??"medium"},${b.status??"pending"},${b.observations??null})
        RETURNING *`;
      return NextResponse.json(rows[0], { status: 201 });
    }

    const code = await nextMeetingCode();
    const { rows } = await sql`
      INSERT INTO committee_meetings (meeting_code,meeting_type,meeting_date,location,chair,secretary,attendees,quorum,agenda,summary,agreements,pending_items,next_meeting_date,status,document_path)
      VALUES (${code},${b.meeting_type??"ordinary"},${b.meeting_date},${b.location??"Sala de Reuniones Dpto. PR"},
        ${b.chair??null},${b.secretary??null},${b.attendees??null},${b.quorum??true},
        ${b.agenda??null},${b.summary??null},${b.agreements??null},${b.pending_items??null},
        ${b.next_meeting_date??null},${b.status??"scheduled"},${b.document_path??null})
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

    if (b._type === "agreement") {
      const fields = Object.entries(b).filter(([k]) => !["id","_type"].includes(k));
      if (!fields.length) return NextResponse.json({ error: "no fields" }, { status: 400 });
      const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
      const { rows } = await sql.unsafe(
        `UPDATE committee_agreements SET ${sets} WHERE id=$1 RETURNING *`,
        [b.id, ...fields.map(([,v])=>v)]
      );
      return NextResponse.json(rows[0]);
    }

    const fields = Object.entries(b).filter(([k]) => k !== "id");
    if (!fields.length) return NextResponse.json({ error: "no fields" }, { status: 400 });
    const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    const { rows } = await sql.unsafe(
      `UPDATE committee_meetings SET ${sets}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [b.id, ...fields.map(([,v])=>v)]
    );
    return NextResponse.json(rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const b = await req.json();
    if (b._type === "agreement") {
      await sql`UPDATE committee_agreements SET active=FALSE WHERE id=${b.id}`;
    } else {
      await sql`UPDATE committee_meetings SET active=FALSE WHERE id=${b.id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
