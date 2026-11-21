import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Syringe,
  Users,
  Calendar,
  ShieldAlert,
  Radiation,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

// Límites y restricciones I-131 — DS 3/1985 · IAEA Safety Reports No. 63
const I131_THRESHOLDS = {
  THERAPEUTIC_MIN_MBQ: 400,         // ≥ 400 MBq → terapéutica (hipertiroidismo/cáncer tiroides)
  HOSPITALIZATION_MBQ: 1110,         // ≥ 1110 MBq (30 mCi) → requiere hospitalización (NS-06.0)
  DIAGNOSTIC_MAX_MBQ: 400,           // < 400 MBq → diagnóstica
  POST_THERAPY_RESTRICTION_DAYS: 10, // Restricción contacto público post-terapia
  POST_DIAG_RESTRICTION_DAYS: 2,     // Restricción contacto post-diagnóstica
};

type AdminType = "diagnostic" | "therapeutic" | "post_surgery";
type AdminStatus = "scheduled" | "completed" | "cancelled" | "hospitalized";

interface AdminRow {
  id: number;
  patient_id: string;
  patient_name: string;
  rut: string;
  admin_type: AdminType;
  indication: string;
  activity_mbq: number;
  admin_date: string;
  status: AdminStatus;
  hospitalized: boolean;
  discharge_date: string | null;
  physician: string;
  technologist: string | null;
  notes: string | null;
}

const TYPE_LABEL: Record<AdminType, { label: string; cls: string }> = {
  diagnostic:   { label: "Diagnóstica",    cls: "text-blue-700 bg-blue-50" },
  therapeutic:  { label: "Terapéutica",    cls: "text-purple-700 bg-purple-50" },
  post_surgery: { label: "Post-quirúrgica", cls: "text-indigo-700 bg-indigo-50" },
};

const STATUS_LABEL: Record<AdminStatus, { label: string; cls: string }> = {
  scheduled:    { label: "Programada",    cls: "text-amber-700 bg-amber-50" },
  completed:    { label: "Completada",    cls: "text-green-700 bg-green-50" },
  cancelled:    { label: "Cancelada",     cls: "text-gray-500 bg-gray-50" },
  hospitalized: { label: "Hospitalizado", cls: "text-red-700 bg-red-50" },
};

export default async function I131Page() {
  // Lazy migration
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS i131_administrations (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(20) UNIQUE NOT NULL,
        patient_name VARCHAR(200) NOT NULL,
        rut VARCHAR(12) NOT NULL,
        admin_type VARCHAR(30) DEFAULT 'diagnostic',
        indication TEXT,
        activity_mbq NUMERIC(10,1) NOT NULL,
        admin_date TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'scheduled',
        hospitalized BOOLEAN DEFAULT false,
        discharge_date TIMESTAMPTZ,
        physician VARCHAR(200),
        technologist VARCHAR(200),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch { /* already exists */ }

  // Seed demo data
  let seeded = false;
  try {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM i131_administrations`;
    if (Number((cnt[0] as any)?.n ?? 0) === 0) {
      const demos = [
        { pid: "PAC-001", name: "Roberto Alvarado Muñoz", rut: "14523678-9", type: "therapeutic", mbq: 3700, ind: "Carcinoma papilar tiroides post-tiroidectomía", status: "completed", hosp: true },
        { pid: "PAC-002", name: "Carmen Flores Sepúlveda", rut: "17892345-6", type: "therapeutic", mbq: 925, ind: "Hipertiroidismo (Enfermedad de Graves)", status: "completed", hosp: true },
        { pid: "PAC-003", name: "Luis Morales Castro", rut: "11234567-8", type: "diagnostic", mbq: 185, ind: "Cintigrafía tiroidea diagnóstica", status: "completed", hosp: false },
        { pid: "PAC-004", name: "Ana Ramírez Torres", rut: "16789012-3", type: "post_surgery", mbq: 5550, ind: "Ablación remanente tiroideo post-tiroidectomía total", status: "hospitalized", hosp: true },
        { pid: "PAC-005", name: "Pedro Gutiérrez Silva", rut: "12345890-1", type: "diagnostic", mbq: 370, ind: "Cintigrama óseo con I-131 NaI", status: "scheduled", hosp: false },
        { pid: "PAC-006", name: "María González López", rut: "19876543-2", type: "therapeutic", mbq: 1850, ind: "Metástasis ganglionares carcinoma tiroideo", status: "completed", hosp: true },
      ];
      for (const d of demos) {
        await sql`
          INSERT INTO i131_administrations
            (patient_id, patient_name, rut, admin_type, indication,
             activity_mbq, admin_date, status, hospitalized, physician, technologist)
          VALUES
            (${d.pid}, ${d.name}, ${d.rut}, ${d.type}, ${d.ind},
             ${d.mbq}, now() - (random() * interval '30 days'), ${d.status}, ${d.hosp},
             'Dr. Javier Moreno Valdés', 'TM Diego Solís Catalán')
          ON CONFLICT DO NOTHING
        `;
      }
      seeded = true;
    }
  } catch { /* table doesn't exist */ }

  let rows: AdminRow[] = [];
  let totalAdmins = 0;
  let totalTherapeutic = 0;
  let totalDiagnostic = 0;
  let totalHospitalized = 0;
  let totalScheduled = 0;
  let totalMbqMonth = 0;

  try {
    const { rows: dbRows } = await sql`
      SELECT id, patient_id, patient_name, rut, admin_type, indication,
             activity_mbq::float, admin_date::text, status, hospitalized,
             discharge_date::text, physician, technologist, notes
      FROM i131_administrations
      ORDER BY admin_date DESC
      LIMIT 100
    `;
    rows = dbRows as AdminRow[];
    totalAdmins = rows.length;

    for (const r of rows) {
      if (r.admin_type === "therapeutic" || r.admin_type === "post_surgery") totalTherapeutic++;
      else totalDiagnostic++;
      if (r.hospitalized) totalHospitalized++;
      if (r.status === "scheduled") totalScheduled++;
    }

    // Actividad total mes actual
    const { rows: mbqRows } = await sql`
      SELECT COALESCE(SUM(activity_mbq), 0)::float AS total
      FROM i131_administrations
      WHERE admin_date >= DATE_TRUNC('month', now())
    `;
    totalMbqMonth = Number((mbqRows[0] as any)?.total ?? 0);
  } catch { /* tabla no existe */ }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Administración de I-131 — Medicina Nuclear</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de administraciones diagnósticas y terapéuticas de I-131
          {seeded && <span className="ml-2 text-accent">(datos demo inicializados)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          DS 3/1985 MINSAL · NS-06.0 CCHEN §13 · IAEA Safety Reports No. 63
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KPICard label="Total administ." value={totalAdmins} href="/i131" icon={Syringe as ComponentType<{ className?: string }>} />
        <KPICard label="Terapéuticas" value={totalTherapeutic} href="/i131" icon={Activity as ComponentType<{ className?: string }>} tone="default" />
        <KPICard label="Diagnósticas" value={totalDiagnostic} href="/i131" icon={CheckCircle2 as ComponentType<{ className?: string }>} tone="default" />
        <KPICard label="Hospitalizados" value={totalHospitalized} href="/i131" icon={Users as ComponentType<{ className?: string }>} tone={totalHospitalized > 0 ? "warning" : "default"} />
        <KPICard label="Programadas" value={totalScheduled} href="/i131" icon={Calendar as ComponentType<{ className?: string }>} tone={totalScheduled > 0 ? "info" : "default"} />
        <KPICard label="MBq mes actual" value={Math.round(totalMbqMonth)} href="/i131" icon={Radiation as ComponentType<{ className?: string }>} hint="MBq totales" />
      </div>

      {/* Alerta pacientes hospitalizados activos */}
      {rows.filter((r) => r.status === "hospitalized").length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>⚠ Pacientes en aislamiento radiológico:</strong>{" "}
          {rows.filter((r) => r.status === "hospitalized").length} paciente(s) actualmente hospitalizados.
          Verificar protocolo de visitas, restricciones de acceso y monitoreo de habitación.
          NS-06.0 §13 · IAEA Safety Reports No. 63 Cap. 7.
        </div>
      )}

      {/* Protocolos y umbrales */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Protocolos de Administración I-131</h2>
        </div>
        <div className="grid gap-3 text-xs md:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <h3 className="font-semibold text-blue-800 mb-1">Diagnóstica (&lt; {I131_THRESHOLDS.DIAGNOSTIC_MAX_MBQ} MBq)</h3>
            <ul className="space-y-0.5 text-blue-700">
              <li>• Cintigrafía tiroidea: 1–5 MBq</li>
              <li>• Barrido corporal: 185–370 MBq</li>
              <li>• Restricción contacto: {I131_THRESHOLDS.POST_DIAG_RESTRICTION_DAYS} días</li>
              <li>• No requiere hospitalización</li>
              <li>• Instrucciones escritas al paciente</li>
            </ul>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
            <h3 className="font-semibold text-purple-800 mb-1">Terapéutica ({I131_THRESHOLDS.THERAPEUTIC_MIN_MBQ}–{I131_THRESHOLDS.HOSPITALIZATION_MBQ} MBq)</h3>
            <ul className="space-y-0.5 text-purple-700">
              <li>• Hipertiroidismo: 400–925 MBq</li>
              <li>• Restricción contacto: {I131_THRESHOLDS.POST_THERAPY_RESTRICTION_DAYS} días</li>
              <li>• Puede no requerir hospitalización</li>
              <li>• Instrucciones escritas detalladas</li>
              <li>• Autorización OPR requerida</li>
            </ul>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
            <h3 className="font-semibold text-red-800 mb-1">Alta actividad (≥ {I131_THRESHOLDS.HOSPITALIZATION_MBQ} MBq)</h3>
            <ul className="space-y-0.5 text-red-700">
              <li>• Cáncer tiroideo: 1.1–7.4 GBq</li>
              <li>• <strong>Hospitalización obligatoria</strong></li>
              <li>• Habitación blindada/aislada</li>
              <li>• Alta cuando ≤ 1 mSv/h a 1m</li>
              <li>• Notificar a CCHEN (NS-06.0 §13)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tabla de administraciones */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Registro de Administraciones</h2>
          <a
            href="/api/reports/generate?type=worker_registry&format=csv"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            ↓ Exportar CSV
          </a>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin registros. Ejecute{" "}
            <a href="/api/init" className="text-accent underline">/api/init</a> para datos demo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Paciente</th>
                  <th className="px-3 py-2 font-medium">RUT</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Indicación</th>
                  <th className="px-3 py-2 font-medium text-right">Actividad (MBq)</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Médico</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Hosp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((r) => {
                  const tl = TYPE_LABEL[r.admin_type] ?? TYPE_LABEL.diagnostic;
                  const sl = STATUS_LABEL[r.status] ?? STATUS_LABEL.scheduled;
                  const highActivity = r.activity_mbq >= I131_THRESHOLDS.HOSPITALIZATION_MBQ;
                  return (
                    <tr
                      key={r.id}
                      className={
                        r.status === "hospitalized"
                          ? "bg-red-50/30"
                          : highActivity
                          ? "bg-amber-50/20"
                          : ""
                      }
                    >
                      <td className="px-4 py-1.5 font-medium">{r.patient_name}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.rut}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tl.cls}`}>
                          {tl.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate text-muted-foreground" title={r.indication ?? ""}>
                        {r.indication}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${highActivity ? "text-amber-700" : ""}`}>
                        {Number(r.activity_mbq).toLocaleString("es-CL")}
                        {highActivity && " ⚠"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {r.admin_date ? r.admin_date.slice(0, 10) : "—"}
                      </td>
                      <td className="px-3 py-1.5 max-w-[120px] truncate" title={r.physician ?? ""}>
                        {r.physician ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${sl.cls}`}>
                          {sl.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {r.hospitalized ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pie regulatorio */}
      <div className="rounded-xl border border-border bg-surface p-5 text-xs text-muted-foreground">
        <h3 className="font-semibold text-foreground mb-2">Base Regulatoria — Yodo-131</h3>
        <div className="grid gap-1 md:grid-cols-2">
          <div>• DS 3/1985 MINSAL: Límites dosis trabajadores y público, registro obligatorio</div>
          <div>• NS-06.0 §13 CCHEN: Protección radiológica en medicina nuclear</div>
          <div>• IAEA Safety Reports No. 63: Protección del paciente en terapia con I-131</div>
          <div>• DS 133/1984: Autorización de instalaciones y actividades nucleares</div>
          <div>• ICRP 94 (2004): Liberación de pacientes post-terapia con radionúclidos</div>
          <div>• OMS/IAEA: Criterios de hospitalización ≥ 1110 MBq (30 mCi)</div>
        </div>
      </div>
    </div>
  );
}
