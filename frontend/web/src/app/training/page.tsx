import { sql } from "@/lib/db";
import { AlertCircle, BookOpen, GraduationCap, Plus, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type Training = {
  id: number;
  title: string;
  training_type: string;
  regulation: string | null;
  instructor: string | null;
  training_date: string | null;
  expiry_date: string | null;
  duration_hours: string | null;
  participants_count: number | null;
  status: string;
  notes: string | null;
};

type TrainingWorker = {
  id: number;
  training_id: number;
  worker_rut: string;
  worker_name: string | null;
  passed: boolean | null;
  score: string | null;
  certificate_number: string | null;
};

export default async function TrainingPage() {
  let trainings: Training[] = [];
  let dbError = false;

  try {
    const { rows } = await sql<Training>`
      SELECT id, title, training_type, regulation, instructor,
             training_date::text, expiry_date::text, duration_hours::text,
             participants_count, status, notes
      FROM trainings
      ORDER BY training_date DESC NULLS LAST
      LIMIT 100
    `;
    trainings = rows;
  } catch {
    dbError = true;
  }

  const completed = trainings.filter((t) => t.status === "completed").length;
  const scheduled = trainings.filter((t) => t.status === "scheduled").length;
  const expired = trainings.filter((t) => {
    if (!t.expiry_date) return false;
    return new Date(t.expiry_date) < new Date();
  }).length;

  const statusColors: Record<string, string> = {
    completed: "text-emerald-400",
    scheduled: "text-blue-400",
    cancelled: "text-red-400",
    draft: "text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    completed: "Completada",
    scheduled: "Programada",
    cancelled: "Cancelada",
    draft: "Borrador",
  };

  const typeLabels: Record<string, string> = {
    curso_pr: "Curso Prot. Radiológica",
    induccion: "Inducción",
    emergencia: "Emergencias",
    procedimiento: "Procedimiento",
    actualizacion: "Actualización",
    simulacro: "Simulacro",
    otro: "Otro",
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Capacitación</h1>
          <p className="text-xs text-muted-foreground">
            Registros de capacitación — NS-06.0 §17 · DS 3/1985 MINSAL
          </p>
        </div>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Registrar capacitación
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total registros", value: trainings.length, color: "text-foreground" },
          { label: "Completadas", value: completed, color: "text-emerald-400" },
          { label: "Programadas", value: scheduled, color: "text-blue-400" },
          { label: "Vencidas", value: expired, color: expired > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {dbError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Base de datos no inicializada.{" "}
            <a href="/api/init" className="underline">
              Inicializar
            </a>
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Normativa</th>
              <th className="px-3 py-2">Instructor</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Vence</th>
              <th className="px-3 py-2 text-right">Hrs.</th>
              <th className="px-3 py-2 text-right">Part.</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {trainings.length === 0 && !dbError && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  No hay capacitaciones registradas
                </td>
              </tr>
            )}
            {trainings.map((t) => {
              const isExpired = t.expiry_date && new Date(t.expiry_date) < new Date();
              return (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate">{t.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {typeLabels[t.training_type] ?? t.training_type}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.regulation ?? "—"}</td>
                  <td className="px-3 py-2">{t.instructor ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.training_date ?? "—"}</td>
                  <td
                    className={`px-3 py-2 ${
                      isExpired ? "text-red-400 font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {t.expiry_date ?? "—"}
                    {isExpired && " ⚠"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {t.duration_hours ? parseFloat(t.duration_hours).toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {t.participants_count ?? "—"}
                  </td>
                  <td className={`px-3 py-2 font-medium ${statusColors[t.status] ?? ""}`}>
                    {statusLabels[t.status] ?? t.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panel informativo */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-accent" strokeWidth={2} />
          <h2 className="text-sm font-semibold">Requisitos regulatorios de capacitación</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="font-semibold text-foreground mb-1">NS-06.0 CCHEN §17</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>· Capacitación inicial en radioprotección</li>
              <li>· Actualización mínimo cada 2 años</li>
              <li>· Registro de asistencia y evaluación</li>
              <li>· Cobertura 100% del personal expuesto</li>
            </ul>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="font-semibold text-foreground mb-1">DS 3/1985 MINSAL</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>· Curso de Protección Radiológica (Curso PR)</li>
              <li>· Vigencia: 5 años desde emisión</li>
              <li>· Obligatorio para Cat. A y B</li>
              <li>· Institución autorizada por CCHEN</li>
            </ul>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="font-semibold text-foreground mb-1">Simulacros de emergencia</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>· Mínimo 1 por año por unidad</li>
              <li>· Incluye derrames y contaminación</li>
              <li>· Informe de ejercicio requerido</li>
              <li>· Participación del OPR obligatoria</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
