/**
 * RPMS – Módulo Cumplimiento Normativo (Compliance)
 * Referencia: DS 133/1984, DS 3/1985 MINSAL, Ley 18.302,
 *             NCh 2764, CCHEN Resoluciones vigentes
 *
 * OPR: Verificar periodos y artículos contra autorización CCHEN vigente.
 */

import { sql } from "@/lib/db";

// ─── Constantes ────────────────────────────────────────────

export const COMPLIANCE_CATEGORIES = [
  "dosimetria",
  "equipos",
  "blindaje",
  "residuos",
  "capacitacion",
  "autorizacion",
  "procedimientos",
  "auditorias",
  "emergencias",
] as const;
export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number];

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  dosimetria: "Dosimetría Personal",
  equipos: "Equipos e Instrumentos",
  blindaje: "Blindaje y Diseño",
  residuos: "Residuos Radiactivos",
  capacitacion: "Capacitación y Entrenamiento",
  autorizacion: "Autorizaciones y Licencias",
  procedimientos: "Procedimientos y Documentos",
  auditorias: "Auditorías",
  emergencias: "Plan de Emergencia",
};

export const COMPLIANCE_STATUSES = [
  "ok",
  "pendiente",
  "vencido",
  "programado",
  "no_aplica",
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  ok: "Al día",
  pendiente: "Pendiente",
  vencido: "Vencido",
  programado: "Programado",
  no_aplica: "No aplica",
};

export const COMPLIANCE_PRIORITIES = ["critica", "alta", "media", "baja"] as const;
export type CompliancePriority = (typeof COMPLIANCE_PRIORITIES)[number];

export const COMPLIANCE_PRIORITY_LABELS: Record<CompliancePriority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const REVIEW_FREQUENCIES = [
  "mensual",
  "trimestral",
  "semestral",
  "anual",
  "bienal",
  "segun_evento",
] as const;
export type ReviewFrequency = (typeof REVIEW_FREQUENCIES)[number];

export const REVIEW_FREQUENCY_LABELS: Record<ReviewFrequency, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  bienal: "Bienal",
  segun_evento: "Según evento",
};

export interface ComplianceRequirement {
  id: string;
  code: string;
  requirement: string;
  regulation: string;
  article_ref: string | null;
  category: ComplianceCategory;
  priority: CompliancePriority;
  owner: string;
  review_frequency: ReviewFrequency;
  last_review_date: string | null;
  next_review_date: string | null;
  status: ComplianceStatus;
  evidence_description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceFormInput {
  code: string;
  requirement: string;
  regulation: string;
  article_ref: string | null;
  category: ComplianceCategory;
  priority: CompliancePriority;
  owner: string;
  review_frequency: ReviewFrequency;
  last_review_date: string | null;
  next_review_date: string | null;
  status: ComplianceStatus;
  evidence_description: string | null;
  notes: string | null;
}

export interface ComplianceDerived {
  days_until_review: number | null;
  is_overdue: boolean;
  urgency: "critica" | "alta" | "normal" | "ok";
  urgency_label: string;
}

export function calcComplianceDerived(req: ComplianceRequirement): ComplianceDerived {
  if (!req.next_review_date || req.status === "no_aplica") {
    return { days_until_review: null, is_overdue: false, urgency: "ok", urgency_label: "No aplica" };
  }
  const now = new Date();
  const next = new Date(req.next_review_date);
  const days_until_review = Math.ceil((next.getTime() - now.getTime()) / (1000 * 86400));
  const is_overdue = days_until_review < 0;
  let urgency: "critica" | "alta" | "normal" | "ok";
  let urgency_label: string;
  if (is_overdue) {
    urgency = "critica";
    urgency_label = "Vencido hace " + Math.abs(days_until_review) + " días";
  } else if (days_until_review <= 15) {
    urgency = "alta";
    urgency_label = "Vence en " + days_until_review + " días";
  } else if (days_until_review <= 60) {
    urgency = "normal";
    urgency_label = "Vence en " + days_until_review + " días";
  } else {
    urgency = "ok";
    urgency_label = "Vence en " + days_until_review + " días";
  }
  return { days_until_review, is_overdue, urgency, urgency_label };
}

export async function ensureComplianceTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_requirements (
      id            BIGSERIAL PRIMARY KEY,
      code          TEXT NOT NULL UNIQUE,
      requirement   TEXT NOT NULL,
      regulation    TEXT NOT NULL,
      article_ref   TEXT,
      category      TEXT NOT NULL DEFAULT 'procedimientos',
      priority      TEXT NOT NULL DEFAULT 'media',
      owner         TEXT NOT NULL DEFAULT 'OPR',
      review_frequency TEXT NOT NULL DEFAULT 'anual',
      last_review_date  TIMESTAMPTZ,
      next_review_date  TIMESTAMPTZ,
      status        TEXT NOT NULL DEFAULT 'pendiente',
      evidence_description TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const { rows } = await sql`SELECT COUNT(*) AS n FROM compliance_requirements`;
  if (Number(rows[0]?.n ?? 0) === 0) {
    await sql`
      INSERT INTO compliance_requirements
        (code, requirement, regulation, article_ref, category, priority, owner, review_frequency, next_review_date, status)
      VALUES
        ('COMP-001','Dosimetría personal TLD – lectura mensual','DS 133/1984','Art. 62','dosimetria','critica','OPR','mensual', NOW() + INTERVAL '25 days','ok'),
        ('COMP-002','Calibración dosímetros ambientales','DS 133/1984','Art. 54','equipos','alta','OPR','semestral', NOW() + INTERVAL '45 days','ok'),
        ('COMP-003','Licencia operacional CCHEN – equipo SPECT','Ley 18.302','Art. 28','autorizacion','critica','Jefe Unidad','anual', NOW() + INTERVAL '60 days','programado'),
        ('COMP-004','Licencia operacional CCHEN – equipo PET/CT','Ley 18.302','Art. 28','autorizacion','critica','Jefe Unidad','anual', NOW() + INTERVAL '55 days','programado'),
        ('COMP-005','Autorización manejo de I-131','DS 133/1984','Art. 77','autorizacion','critica','OPR','anual', NOW() + INTERVAL '30 days','ok'),
        ('COMP-006','Inspección blindaje Sala de Cámaras','DS 3/1985 MINSAL','Art. 4','blindaje','alta','OPR','bienal', NOW() + INTERVAL '380 days','ok'),
        ('COMP-007','Inspección blindaje Sala I-131','NCRP Report 151','—','blindaje','alta','OPR','bienal', NOW() + INTERVAL '200 days','ok'),
        ('COMP-008','Control de contaminación superficial – mensual','DS 133/1984','Art. 86','dosimetria','alta','TM Senior','mensual', NOW() + INTERVAL '5 days','pendiente'),
        ('COMP-009','Registro de residuos radiactivos (libro CCHEN)','DS 133/1984','Art. 54','residuos','critica','OPR','mensual', NOW() + INTERVAL '8 days','pendiente'),
        ('COMP-010','Disposición residuos – transferencia CCHEN','CCHEN Res. 432/2019','—','residuos','alta','OPR','segun_evento', NULL,'ok'),
        ('COMP-011','Capacitación anual OPR – CCHEN','Ley 18.302','Art. 45','capacitacion','alta','Dirección','anual', NOW() + INTERVAL '90 days','ok'),
        ('COMP-012','Capacitación radioproteción tecnólogos','DS 133/1984','Art. 47','capacitacion','media','OPR','anual', NOW() + INTERVAL '120 days','programado'),
        ('COMP-013','Plan de emergencia radiológica vigente','DS 133/1984','Art. 92','emergencias','critica','OPR','anual', NOW() - INTERVAL '5 days','vencido'),
        ('COMP-014','Simulacro emergencia radiológica','OIEA GSG-2','—','emergencias','alta','OPR','anual', NOW() + INTERVAL '150 days','programado'),
        ('COMP-015','Auditoría interna programa ALARA','Política RPMS','—','auditorias','media','Comité RP','semestral', NOW() + INTERVAL '75 days','programado'),
        ('COMP-016','PRO-RP-004 Protocolo I-131 – revisión','ISO 9001:2015','§4.2','procedimientos','alta','OPR','anual', NOW() + INTERVAL '200 days','ok'),
        ('COMP-017','PRO-RP-007 Gestión residuos – revisión','ISO 9001:2015','§4.2','procedimientos','media','OPR','anual', NOW() + INTERVAL '220 days','ok'),
        ('COMP-018','Control de calidad activímetro – diario','NCh 2764','§5.3','equipos','critica','TM Senior','mensual', NOW() + INTERVAL '2 days','pendiente'),
        ('COMP-019','Verificación SPECT – QC semanal','IAEA TECDOC-1110','Tabla 6-1','equipos','alta','TM Senior','mensual', NOW() + INTERVAL '3 days','pendiente'),
        ('COMP-020','Verificación PET/CT – QC semanal','AAPM TG-108','§4','equipos','alta','TM Senior','mensual', NOW() + INTERVAL '4 days','pendiente')
      ON CONFLICT (code) DO NOTHING
    `;
  }
}

export async function listComplianceRequirements(opts: {
  category?: string;
  status?: string;
  priority?: string;
  limit?: number;
}): Promise<ComplianceRequirement[]> {
  await ensureComplianceTables();
  const limit = opts.limit ?? 200;
  let query = "SELECT * FROM compliance_requirements WHERE TRUE";
  const params: unknown[] = [];
  let idx = 1;
  if (opts.category) { query += " AND category = $" + idx++; params.push(opts.category); }
  if (opts.status) { query += " AND status = $" + idx++; params.push(opts.status); }
  if (opts.priority) { query += " AND priority = $" + idx++; params.push(opts.priority); }
  query += " ORDER BY CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, next_review_date ASC NULLS LAST LIMIT $" + idx;
  params.push(limit);
  const { rows } = await sql.query(query, params);
  return rows as ComplianceRequirement[];
}
