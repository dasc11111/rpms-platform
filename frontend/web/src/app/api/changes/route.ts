import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// §65 — Gestión de Cambios al Programa de Protección Radiológica
// CCHEN NS-06.0 — Evaluación radiológica previa a cambios en instalaciones o procesos
// IAEA GS-R-3 — Management System: control de cambios en el sistema de gestión
// Tipos: instalación, equipos, procedimiento, personal, fuentes, residuos, emergencia

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS program_changes (
      id               SERIAL PRIMARY KEY,
      change_code      VARCHAR(50) UNIQUE NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT,
      change_type      TEXT NOT NULL DEFAULT 'equipment',
      scope            TEXT DEFAULT 'local',
      requester        TEXT,
      responsible      TEXT,
      reviewer         TEXT,
      request_date     DATE NOT NULL,
      evaluation_date  DATE,
      approval_date    DATE,
      implementation_date DATE,
      closure_date     DATE,
      radiation_assessment TEXT,
      risk_level       TEXT DEFAULT 'low',
      requires_cchen_notification BOOLEAN DEFAULT FALSE,
      cchen_notification_date DATE,
      cchen_ref        TEXT,
      status           TEXT NOT NULL DEFAULT 'submitted',
      rejection_reason TEXT,
      corrective_actions TEXT,
      notes            TEXT,
      active           BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM program_changes`;
  if (parseInt(count[0]?.count ?? "0") === 0) {
    const today = new Date();
    const sub = (n:number) => { const d=new Date(today); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; };
    const add = (n:number) => { const d=new Date(today); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };

    await sql`
      INSERT INTO program_changes (change_code, title, description, change_type, scope, requester, responsible, reviewer, request_date, evaluation_date, approval_date, implementation_date, radiation_assessment, risk_level, requires_cchen_notification, status)
      VALUES
        ('MC-2026-001', 'Reemplazo cámara PET/CT — nueva unidad Siemens Biograph', 'Sustitución equipo PET/CT existente por nueva unidad. Implica re-evaluación blindajes, actualización procedimientos y nueva fuente sellada calibración.', 'equipment', 'facility', 'Jefe Medicina Nuclear', 'Encargado PR', 'Director Médico', ${sub(60)}, ${sub(45)}, ${sub(30)}, ${add(15)}, 'Se requiere evaluación de blindajes sala PET. Actividad fuente calibración <370 MBq F-18, categoría 5. Sin impacto significativo en dosis personal con procedimientos actuales.', 'medium', TRUE, 'approved'),
        ('MC-2026-002', 'Modificación procedimiento administración I-131 terapéutico', 'Actualización protocolo para aumentar actividades terapéuticas hasta 7,4 GBq. Requiere evaluación dosis habitación hospitalización y tiempo ocupación.', 'procedure', 'local', 'Médico Nuclear', 'Encargado PR', 'Jefe Servicio', ${sub(30)}, ${sub(15)}, ${sub(5)}, null, 'Cálculo dosis personal: 0,3 mSv/administración estimado con distancias actuales. Dosis habitación: revisar blindaje puerta. Recomendación: aumentar distancia de trabajo y tiempo máx. visita 15 min.', 'medium', FALSE, 'approved'),
        ('MC-2026-003', 'Incorporación nuevo personal técnico — 2 Tecnólogos Médicos', 'Contratación 2 TM nuevos para Medicina Nuclear. Requiere evaluación dosimétrica inicial, capacitación PR, asignación dosímetros y clasificación categoría.', 'personnel', 'local', 'RRHH Hospital', 'Encargado PR', null, ${sub(10)}, null, null, null, null, 'low', FALSE, 'submitted'),
        ('MC-2026-004', 'Remodelación sala de residuos radiactivos', 'Obras físicas en almacén de residuos: ampliación y mejora ventilación. Durante obras, residuos en almacenamiento temporal alternativo. Duración estimada 45 días.', 'facility', 'facility', 'Infraestructura', 'Encargado PR', 'Director', ${sub(5)}, null, null, null, null, 'high', TRUE, 'under_review'),
        ('MC-2025-010', 'Actualización Plan de Contingencia Radiológica', 'Revisión anual plan de contingencia. Actualización contactos, cadena de notificación y procedimiento fuga fuente sellada según lecciones aprendidas simulacro.', 'emergency', 'facility', 'Encargado PR', 'Encargado PR', 'Comité PR', ${sub(120)}, ${sub(100)}, ${sub(90)}, ${sub(80)}, 'Sin impacto dosimétrico. Mejora en tiempos respuesta.', 'low', FALSE, 'closed')
    `;
  }
}

// Auto-code generator
async function nextCode() {
  const year = new Date().getFullYear();
  const rows = await sql`
    SELECT change_code FROM program_changes
    WHERE change_code LIKE ${'MC-' + year + '-%'}
    ORDER BY change_code DESC LIMIT 1
  `;
  const last = rows[0]?.change_code;
  const n = last ? parseInt(last.split("-")[2]) + 1 : 1;
  return `MC-${year}-${String(n).padStart(3,"0")}`;
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const status    = searchParams.get("status") ?? "";
  const type      = searchParams.get("type") ?? "";
  const risk      = searchParams.get("risk") ?? "";

  const rows = await sql`
    SELECT *,
      CASE
        WHEN status IN ('approved','submitted','under_review')
          AND request_date < now() - INTERVAL '30 days'
          AND status != 'approved' THEN TRUE
        ELSE FALSE
      END AS is_delayed
    FROM program_changes
    WHERE active = TRUE
      AND (${status} = '' OR status = ${status})
      AND (${type}   = '' OR change_type = ${type})
      AND (${risk}   = '' OR risk_level = ${risk})
    ORDER BY
      CASE status
        WHEN 'under_review' THEN 0 WHEN 'submitted' THEN 1 WHEN 'approved' THEN 2
        WHEN 'implementing' THEN 3 WHEN 'closed' THEN 4 WHEN 'rejected' THEN 5
        ELSE 6 END,
      request_date DESC
  `;

  const stats = await sql`
    SELECT
      COUNT(*)::int                                            AS total,
      COUNT(*) FILTER (WHERE status='submitted')::int             AS pending_review,
      COUNT(*) FILTER (WHERE status='under_review')::int          AS under_review,
      COUNT(*) FILTER (WHERE status='approved')::int              AS approved,
      COUNT(*) FILTER (WHERE status='implementing')::int          AS implementing,
      COUNT(*) FILTER (WHERE status='closed')::int                AS closed,
      COUNT(*) FILTER (WHERE status='rejected')::int              AS rejected,
      COUNT(*) FILTER (WHERE requires_cchen_notification AND status NOT IN ('closed','rejected')
        AND cchen_notification_date IS NULL)::int                 AS pending_cchen_notif,
      COUNT(*) FILTER (WHERE risk_level='high')::int              AS high_risk
    FROM program_changes WHERE active = TRUE
  `;

  return NextResponse.json({ rows, stats: stats[0] });
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const code = await nextCode();
  const { title, description, change_type, scope, requester, responsible, request_date, risk_level, requires_cchen_notification, notes } = body;
  const inserted = await sql`
    INSERT INTO program_changes (change_code, title, description, change_type, scope, requester, responsible, request_date, risk_level, requires_cchen_notification, notes)
    VALUES (${code}, ${title}, ${description??null}, ${change_type??'equipment'}, ${scope??'local'}, ${requester??null}, ${responsible??null}, ${request_date}, ${risk_level??'low'}, ${requires_cchen_notification??false}, ${notes??null})
    RETURNING *
  `;
  return NextResponse.json(inserted[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error:"Missing id" }, { status:400 });
  const allowed = ["title","description","change_type","scope","requester","responsible","reviewer","request_date","evaluation_date","approval_date","implementation_date","closure_date","radiation_assessment","risk_level","requires_cchen_notification","cchen_notification_date","cchen_ref","status","rejection_reason","corrective_actions","notes"];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in fields) { setClauses.push(`${key} = $${idx++}`); values.push(fields[key]); }
  }
  if (!setClauses.length) return NextResponse.json({ error:"No fields" }, { status:400 });
  setClauses.push(`updated_at = now()`);
  values.push(id);
  const updated = await sql.unsafe(`UPDATE program_changes SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`, values);
  return NextResponse.json(updated[0]);
}

export async function DELETE(req: NextRequest) {
  await ensureTable();
  const { id } = await req.json();
  await sql`UPDATE program_changes SET active = FALSE WHERE id = ${id}`;
  return NextResponse.json({ ok:true });
}
