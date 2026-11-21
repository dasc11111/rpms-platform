import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Award,
  Calendar,
  GraduationCap,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

// Requisitos de capacitación radiológica — NS-06.0 §16, DS 133/1984 Art. 23
const TRAINING_REQUIREMENTS = {
  ANNUAL_HOURS_OCC: 8,          // horas mínimas anuales para trabajador ocupacionalmente expuesto
  REFRESHER_MONTHS: 12,         // meses entre cursos de actualización
  BASIC_RADIATION_PROTECTION: true, // obligatorio para todo TOE
  EMERGENCY_DRILLS_ANNUAL: 1,   // simulacros anuales mínimos
};

type TrainingStatus = "scheduled" | "in_progress" | "completed" | "failed" | "cancelled";
type TrainingCategory = "basic_rp" | "advanced_rp" | "emergency" | "equipment" | "regulatory" | "clinical";
type ParticipantStatus = "registered" | "attended" | "passed" | "failed" | "absent";

interface TrainingRow {
  id: number;
  course_code: string;
  course_name: string;
  category: TrainingCategory;
  instructor: string | null;
  scheduled_date: string;
  duration_hours: number;
  status: TrainingStatus;
  participants_registered: number;
  participants_attended: number;
  participants_passed: number;
  regulatory_basis: string | null;
  certificate_valid_months: number;
  notes: string | null;
}

interface WorkerTrainingRow {
  worker_name: string;
  worker_rut: string;
  courses_completed: number;
  hours_total: number;
  last_training: string | null;
  next_due: string | null;
  compliant: boolean;
}

const CAT_LABEL: Record<TrainingCategory, { label: string; cls: string }> = {
  basic_rp:   { label: "Protección radiológica básica", cls: "text-blue-700 bg-blue-50" },
  advanced_rp:{ label: "Protección radiológica avanzada", cls: "text-purple-700 bg-purple-50" },
  emergency:  { label: "Emergencias radiológicas",        cls: "text-red-700 bg-red-50" },
  equipment:  { label: "Equipamiento y dosimetría",       cls: "text-amber-700 bg-amber-50" },
  regulatory: { label: "Marco regulatorio",               cls: "text-green-700 bg-green-50" },
  clinical:   { label: "Procedimientos clínicos",         cls: "text-cyan-700 bg-cyan-50" },
};

const STATUS_LABEL: Record<TrainingStatus, { label: string; cls: string }> = {
  scheduled:   { label: "Programado",   cls: "text-blue-700 bg-blue-50" },
  in_progress: { label: "En curso",     cls: "text-amber-700 bg-amber-50" },
  completed:   { label: "Completado",   cls: "text-green-700 bg-green-50" },
  failed:      { label: "Reprobado",    cls: "text-red-700 bg-red-50" },
  cancelled:   { label: "Cancelado",    cls: "text-gray-500 bg-gray-50" },
};

const DEMO_COURSES = [
  { code: "CAP-RP-001", name: "Protección Radiológica Básica NS-06.0", cat: "basic_rp",    h: 8,  status: "completed", reg: "NS-06.0 §16 / DS 133/1984 Art.23", months: 24, pReg: 12, pAtt: 11, pPass: 10 },
  { code: "CAP-RP-002", name: "Uso Seguro de Fuentes No Selladas",      cat: "advanced_rp", h: 4,  status: "completed", reg: "IAEA Safety Series No. 38",        months: 12, pReg: 6,  pAtt: 6,  pPass: 5  },
  { code: "CAP-EM-001", name: "Simulacro Emergencia Radiológica 2024",  cat: "emergency",   h: 3,  status: "completed", reg: "DS 133/1984 Art.47 / NS-06.0 §18", months: 12, pReg: 15, pAtt: 14, pPass: 14 },
  { code: "CAP-EQ-001", name: "Calibración Detector Geiger-Müller",     cat: "equipment",   h: 2,  status: "completed", reg: "IAEA-TECDOC-1683",                 months: 12, pReg: 5,  pAtt: 5,  pPass: 5  },
  { code: "CAP-REG-001","name": "Actualización Normativa CCHEN 2024",   cat: "regulatory",  h: 4,  status: "scheduled", reg: "NS-06.0 / RB-5.1 CCHEN",           months: 12, pReg: 10, pAtt: 0,  pPass: 0  },
  { code: "CAP-CL-001", name: "Protocolo I-131 Terapia Ambulatoria",    cat: "clinical",    h: 3,  status: "completed", reg: "NS-06.0 §13 / IAEA-TECDOC-1340",   months: 24, pReg: 8,  pAtt: 8,  pPass: 7  },
  { code: "CAP-RP-003", name: "Dosimetría Personal y Lectura TLD",      cat: "equipment",   h: 2,  status: "scheduled", reg: "DS 3/1985 / NS-06.0 §6",           months: 12, pReg: 20, pAtt: 0,  pPass: 0  },
  { code: "CAP-EM-002", name: "Respuesta Contaminación Radiactiva",      cat: "emergency",   h: 4,  status: "in_progress",reg: "IAEA EPR-2016",                   months: 12, pReg: 8,  pAtt: 8,  pPass: 0  },
];

export default async function TrainingPage() {
  // Lazy migration
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS training_courses (
        id SERIAL PRIMARY KEY,
        course_code VARCHAR(50) UNIQUE NOT NULL,
        course_name VARCHAR(300) NOT NULL,
        category VARCHAR(30) DEFAULT 'basic_rp',
        instructor VARCHAR(200),
        scheduled_date TIMESTAMPTZ NOT NULL,
        duration_hours NUMERIC(4,1) DEFAULT 1,
        status VARCHAR(20) DEFAULT 'scheduled',
        participants_registered INT DEFAULT 0,
        participants_attended INT DEFAULT 0,
        participants_passed INT DEFAULT 0,
        regulatory_basis VARCHAR(300),
        certificate_valid_months INT DEFAULT 12,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS training_worker_records (
        id SERIAL PRIMARY KEY,
        worker_rut VARCHAR(20) NOT NULL,
        worker_name VARCHAR(200) NOT NULL,
        course_id INT REFERENCES training_courses(id),
        status VARCHAR(20) DEFAULT 'registered',
        score NUMERIC(5,2),
        certificate_number VARCHAR(100),
        issued_date TIMESTAMPTZ,
        expiry_date TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(worker_rut, course_id)
      )
    `;
  } catch { /* already exists */ }

  // Seed
  let seeded = false;
  try {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM training_courses`;
    if (Number((cnt[0] as any)?.n ?? 0) === 0) {
      for (let i = 0; i < DEMO_COURSES.length; i++) {
        const c = DEMO_COURSES[i]!;
        const daysOffset = c.status === "completed" ? -(30 + i * 15) : c.status === "scheduled" ? (14 + i * 7) : -2;
        await sql`
          INSERT INTO training_courses
            (course_code, course_name, category, instructor, scheduled_date, duration_hours,
             status, participants_registered, participants_attended, participants_passed,
             regulatory_basis, certificate_valid_months)
          VALUES
            (${c.code}, ${c.name}, ${c.cat},
             'TM Diego Solís Catalán / Encargado PR',
             now() + (${daysOffset} || ' days')::interval, ${c.h},
             ${c.status}, ${c.pReg}, ${c.pAtt}, ${c.pPass},
             ${c.reg}, ${c.months})
          ON CONFLICT DO NOTHING
        `;
      }
      seeded = true;
    }
  } catch { /* table doesn't exist */ }

  let courses: TrainingRow[] = [];
  let totalCourses = 0, completed = 0, scheduled = 0, inProgress = 0;
  let totalParticipants = 0, totalPassed = 0;

  try {
    const { rows } = await sql`
      SELECT id, course_code, course_name, category, instructor,
             scheduled_date::text, duration_hours::float, status,
             participants_registered, participants_attended, participants_passed,
             regulatory_basis, certificate_valid_months, notes
      FROM training_courses
      ORDER BY
        CASE status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
        scheduled_date ASC
      LIMIT 50
    `;
    courses = rows as TrainingRow[];
    totalCourses = courses.length;
    for (const c of courses) {
      if (c.status === "completed") completed++;
      else if (c.status === "scheduled") scheduled++;
      else if (c.status === "in_progress") inProgress++;
      totalParticipants += c.participants_attended ?? 0;
      totalPassed += c.participants_passed ?? 0;
    }
  } catch { /* table doesn't exist */ }

  // Resumen de cumplimiento por trabajador (simplificado)
  const workerSummary: WorkerTrainingRow[] = [
    { worker_name: "Diego Solís Catalán",    worker_rut: "16.397.583-1", courses_completed: 4, hours_total: 17, last_training: "2024-09-15", next_due: "2025-09-15", compliant: true },
    { worker_name: "María González Prado",   worker_rut: "15.234.567-8", courses_completed: 3, hours_total: 14, last_training: "2024-07-20", next_due: "2025-07-20", compliant: true },
    { worker_name: "Carlos Muñoz Álvarez",   worker_rut: "14.876.543-2", courses_completed: 2, hours_total: 10, last_training: "2024-03-10", next_due: "2025-03-10", compliant: false },
    { worker_name: "Ana Ramírez Contreras",  worker_rut: "17.654.321-K", courses_completed: 5, hours_total: 23, last_training: "2024-10-05", next_due: "2025-10-05", compliant: true },
    { worker_name: "Roberto Vega Sepúlveda", worker_rut: "13.456.789-3", courses_completed: 1, hours_total: 8,  last_training: "2024-01-15", next_due: "2025-01-15", compliant: false },
  ];
  const compliant = workerSummary.filter(w => w.compliant).length;
  const nonCompliant = workerSummary.filter(w => !w.compliant).length;

  function fmtDate(dt: string) {
    try { return new Date(dt).toLocaleDateString("es-CL"); }
    catch { return dt; }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Capacitación en Protección Radiológica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro y seguimiento de capacitación del personal ocupacionalmente expuesto (TOE)
          {seeded && <span className="ml-2 text-accent">(datos demo inicializados)</span>}
        </p>
        <p className="text-xs text-muted-foreground">NS-06.0 §16 CCHEN · DS 133/1984 Art. 23 · IAEA Safety Series No. 38</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <KPICard label="Total cursos" value={totalCourses} href="/training" icon={BookOpen as ComponentType<{ className?: string }>} />
        <KPICard label="Completados" value={completed} href="/training" icon={CheckCircle2 as ComponentType<{ className?: string }>} tone="success" />
        <KPICard label="Programados" value={scheduled} href="/training" icon={Calendar as ComponentType<{ className?: string }>} tone="default" />
        <KPICard label="En curso" value={inProgress} href="/training" icon={Clock as ComponentType<{ className?: string }>} tone="warning" />
        <KPICard label="Participantes" value={totalParticipants} href="/training" icon={Users as ComponentType<{ className?: string }>} />
        <KPICard label="Certificados" value={totalPassed} href="/training" icon={Award as ComponentType<{ className?: string }>} tone="success" />
        <KPICard label="TOE al día" value={compliant} href="/training" icon={GraduationCap as ComponentType<{ className?: string }>} tone="success" />
        <KPICard label="TOE vencidos" value={nonCompliant} href="/training" icon={AlertTriangle as ComponentType<{ className?: string }>} tone={nonCompliant > 0 ? "danger" : "default"} />
      </div>

      {/* Requisitos mínimos */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-3">Requisitos Mínimos Anuales — NS-06.0 §16 / DS 133/1984 Art. 23</h2>
        <div className="grid gap-2 text-xs md:grid-cols-4">
          {[
            { label: "Horas mínimas anuales (TOE)", value: `${TRAINING_REQUIREMENTS.ANNUAL_HOURS_OCC} h`, ok: true },
            { label: "Actualización cada", value: `${TRAINING_REQUIREMENTS.REFRESHER_MONTHS} meses`, ok: true },
            { label: "Protección radiológica básica", value: "Obligatorio", ok: true },
            { label: "Simulacros anuales mínimos", value: `${TRAINING_REQUIREMENTS.EMERGENCY_DRILLS_ANNUAL} simulacro`, ok: true },
          ].map((req) => (
            <div key={req.label} className="rounded-lg border border-border bg-background p-3 flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
              <div>
                <div className="font-semibold">{req.value}</div>
                <div className="text-muted-foreground">{req.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de cursos */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            <h2 className="font-semibold">Registro de Capacitaciones</h2>
          </div>
        </div>
        {courses.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sin registros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Nombre del curso</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium text-right">Hrs</th>
                  <th className="px-3 py-2 font-medium text-right">Reg.</th>
                  <th className="px-3 py-2 font-medium text-right">Asist.</th>
                  <th className="px-3 py-2 font-medium text-right">Aprob.</th>
                  <th className="px-3 py-2 font-medium text-right">% Aprob.</th>
                  <th className="px-3 py-2 font-medium">Vigencia cert.</th>
                  <th className="px-3 py-2 font-medium">Base regulatoria</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {courses.map((c) => {
                  const cl = CAT_LABEL[c.category as TrainingCategory] ?? CAT_LABEL.basic_rp;
                  const sl = STATUS_LABEL[c.status] ?? STATUS_LABEL.scheduled;
                  const pctPass = c.participants_attended > 0
                    ? Math.round((c.participants_passed / c.participants_attended) * 100)
                    : 0;
                  return (
                    <tr
                      key={c.id}
                      className={
                        c.status === "in_progress"
                          ? "bg-amber-50/15"
                          : c.status === "scheduled"
                          ? "bg-blue-50/10"
                          : ""
                      }
                    >
                      <td className="px-4 py-1.5 font-mono text-[11px]">{c.course_code}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={c.course_name}>{c.course_name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cl.cls}`}>
                          {cl.label.split(" ").slice(0, 2).join(" ")}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">{fmtDate(c.scheduled_date)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.duration_hours}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.participants_registered}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.participants_attended}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.participants_passed}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${c.status === "completed" ? (pctPass >= 80 ? "text-green-600" : "text-red-600") : ""}`}>
                        {c.status === "completed" ? `${pctPass}%` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{c.certificate_valid_months} meses</td>
                      <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground text-[10px]" title={c.regulatory_basis ?? ""}>
                        {c.regulatory_basis}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${sl.cls}`}>
                          {sl.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen de cumplimiento por trabajador */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Cumplimiento de Capacitación — TOE</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Trabajador</th>
                <th className="px-3 py-2 font-medium">RUT</th>
                <th className="px-3 py-2 font-medium text-right">Cursos</th>
                <th className="px-3 py-2 font-medium text-right">Horas totales</th>
                <th className="px-3 py-2 font-medium">Última capacitación</th>
                <th className="px-3 py-2 font-medium">Próximo vencimiento</th>
                <th className="px-3 py-2 font-medium">Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {workerSummary.map((w) => (
                <tr key={w.worker_rut} className={!w.compliant ? "bg-red-50/20" : ""}>
                  <td className="px-4 py-1.5 font-medium">{w.worker_name}</td>
                  <td className="px-3 py-1.5 font-mono">{w.worker_rut}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{w.courses_completed}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{w.hours_total} h</td>
                  <td className="px-3 py-1.5">{w.last_training ? fmtDate(w.last_training) : "—"}</td>
                  <td className={`px-3 py-1.5 ${!w.compliant ? "text-red-600 font-semibold" : ""}`}>
                    {w.next_due ? fmtDate(w.next_due) : "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    {w.compliant
                      ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-[10px]"><CheckCircle2 className="h-3 w-3" /> Al día</span>
                      : <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[10px]"><AlertTriangle className="h-3 w-3" /> Vencido</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
