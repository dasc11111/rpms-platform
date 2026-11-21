import { sql } from "@/lib/db";
import { AlertTriangle, CheckCircle2, Clock, FileWarning, Zap } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface IncidentRow {
  id: number;
  title: string;
  description: string | null;
  incident_date: string;
  service: string | null;
  severity: string;
  status: string;
  ines_level: number | null;
  reference_code: string | null;
  workers_involved: number | null;
  location: string | null;
  reported_by: string | null;
  closed_at: string | null;
}

interface ActionRow {
  id: number;
  incident_id: number;
  action_type: string;
  description: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: string;
}

const SEVERITY_LABEL: Record<string, { label: string; cls: string }> = {
  high:   { label: "Alta",  cls: "text-red-700 bg-red-50" },
  medium: { label: "Media", cls: "text-amber-700 bg-amber-50" },
  low:    { label: "Baja",  cls: "text-muted-foreground bg-muted" },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:          { label: "Abierto",         cls: "text-red-700 bg-red-50" },
  investigating: { label: "En investigación", cls: "text-amber-700 bg-amber-50" },
  closed:        { label: "Cerrado",          cls: "text-emerald-700 bg-emerald-50" },
};

const ACTION_STATUS: Record<string, { label: string; cls: string }> = {
  open:      { label: "Pendiente",   cls: "text-amber-700 bg-amber-50" },
  in_progress: { label: "En curso",  cls: "text-blue-700 bg-blue-50" },
  completed: { label: "Completada",  cls: "text-emerald-700 bg-emerald-50" },
};

function inesColor(level: number | null): string {
  if (level === null) return "text-muted-foreground bg-muted";
  if (level === 0) return "text-muted-foreground bg-muted";
  if (level <= 2) return "text-amber-700 bg-amber-50";
  if (level <= 4) return "text-orange-700 bg-orange-50";
  return "text-red-700 bg-red-50";
}

export default async function IncidentsPage() {
  let incidents: IncidentRow[] = [];
  let actions: ActionRow[] = [];
  let openCount = 0;
  let investigatingCount = 0;
  let closedCount = 0;
  let highSeverity = 0;
  let actionsOpen = 0;

  try {
    const { rows } = await sql`
      SELECT id, title, description, incident_date::text, service, severity, status,
             ines_level, reference_code, workers_involved, location, reported_by,
             closed_at::text
      FROM incidents
      ORDER BY incident_date DESC
      LIMIT 100
    `;
    incidents = rows as IncidentRow[];
    openCount = incidents.filter((r) => r.status === "open").length;
    investigatingCount = incidents.filter((r) => r.status === "investigating").length;
    closedCount = incidents.filter((r) => r.status === "closed").length;
    highSeverity = incidents.filter((r) => r.severity === "high").length;
  } catch { /* tabla aún no existe */ }

  try {
    const { rows } = await sql`
      SELECT id, incident_id, action_type, description, assigned_to,
             due_date::text, completed_at::text, status
      FROM incident_actions
      ORDER BY due_date ASC NULLS LAST
      LIMIT 200
    `;
    actions = rows as ActionRow[];
    actionsOpen = actions.filter((a) => a.status !== "completed").length;
  } catch { /* tabla aún no existe */ }

  const incidentMap = new Map<number, ActionRow[]>();
  for (const a of actions) {
    const list = incidentMap.get(a.incident_id) ?? [];
    list.push(a);
    incidentMap.set(a.incident_id, list);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Incidentes Radiológicos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro y seguimiento según escala INES (IAEA). NS-06.0 §16 CCHEN — notificación inmediata de eventos INES ≥ 1.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPICard label="Abiertos" value={openCount} href="/incidents" icon={AlertTriangle} tone={openCount > 0 ? "danger" : "default"} />
        <KPICard label="En investigación" value={investigatingCount} href="/incidents" icon={Clock} tone={investigatingCount > 0 ? "warning" : "default"} />
        <KPICard label="Cerrados" value={closedCount} href="/incidents" icon={CheckCircle2} tone="default" />
        <KPICard label="Severidad alta" value={highSeverity} href="/incidents" icon={FileWarning} tone={highSeverity > 0 ? "danger" : "default"} />
        <KPICard label="Acciones pendientes" value={actionsOpen} href="/incidents" icon={Zap} tone={actionsOpen > 0 ? "warning" : "default"} />
      </div>

      {/* Alerta INES */}
      {incidents.some((i) => (i.ines_level ?? 0) >= 1) && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <strong>⚠ Incidente(s) con nivel INES ≥ 1.</strong>{" "}
          Revisar notificación a CCHEN y al Servicio de Salud según NS-06.0 §16 y DS 133/1984 Art. 72.
        </div>
      )}

      {/* Tabla de incidentes */}
      {incidents.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay incidentes registrados.</p>
          <p className="text-xs mt-1">Ejecuta <code className="font-mono">/api/init</code> para inicializar las tablas.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Incidente</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Servicio / Ubicación</th>
                <th className="px-4 py-3 text-left font-medium">INES</th>
                <th className="px-4 py-3 text-left font-medium">Trab.</th>
                <th className="px-4 py-3 text-left font-medium">Severidad</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const sev = SEVERITY_LABEL[inc.severity] ?? { label: inc.severity, cls: "text-muted-foreground bg-muted" };
                const st = STATUS_LABEL[inc.status] ?? { label: inc.status, cls: "text-muted-foreground bg-muted" };
                const incActions = incidentMap.get(inc.id) ?? [];
                const pendingActions = incActions.filter((a) => a.status !== "completed").length;
                return (
                  <tr key={inc.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {inc.reference_code ?? `INC-${String(inc.id).padStart(4, "0")}`}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{inc.title}</div>
                      {inc.reported_by && (
                        <div className="text-xs text-muted-foreground">Por: {inc.reported_by}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {inc.incident_date}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div>{inc.service ?? "—"}</div>
                      {inc.location && <div className="text-xs">{inc.location}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${inesColor(inc.ines_level)}`}>
                        {inc.ines_level ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {inc.workers_involved ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${sev.cls}`}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {pendingActions > 0 ? (
                        <span className="inline-flex text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {pendingActions} pendiente{pendingActions > 1 ? "s" : ""}
                        </span>
                      ) : incActions.length > 0 ? (
                        <span className="inline-flex text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Completas
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Acciones correctivas */}
      {actions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Acciones Correctivas / Preventivas</h2>
          <div className="rounded-xl border border-border bg-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Incidente</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Acción</th>
                  <th className="px-4 py-3 text-left font-medium">Responsable</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha límite</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => {
                  const st = ACTION_STATUS[a.status] ?? { label: a.status, cls: "text-muted-foreground bg-muted" };
                  const inc = incidents.find((i) => i.id === a.incident_id);
                  const isOverdue = a.due_date && !a.completed_at && new Date(a.due_date) < new Date();
                  return (
                    <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                        {inc?.reference_code ?? `INC-${String(a.incident_id).padStart(4, "0")}`}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize">{a.action_type.replace("_", " ")}</td>
                      <td className="px-4 py-2.5">{a.description}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{a.assigned_to ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {a.due_date ? (
                          <span className={isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {new Date(a.due_date).toLocaleDateString("es-CL")}
                            {isOverdue && " ⚠"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Marco regulatorio */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold mb-3">Marco Regulatorio — Incidentes Radiológicos</h3>
        <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
          {[
            { ref: "IAEA Safety Series No. 72 (INES)", desc: "Escala internacional de eventos nucleares y radiológicos" },
            { ref: "NS-06.0 §16 CCHEN", desc: "Notificación inmediata de eventos ≥ INES 1 a CCHEN" },
            { ref: "DS 133/1984 MINSAL Art. 72", desc: "Notificación de accidentes al Servicio de Salud" },
            { ref: "DS 3/1985 MINSAL", desc: "Protocolo de investigación de incidentes con exposición" },
            { ref: "IAEA-TECDOC-1540", desc: "Preparación y respuesta a emergencias radiológicas" },
            { ref: "NCRP Report No. 151", desc: "Respuesta médica en emergencias radiológicas" },
          ].map((item) => (
            <div key={item.ref} className="flex gap-2">
              <span className="font-mono text-accent shrink-0 mt-0.5">▸</span>
              <div>
                <span className="font-medium">{item.ref}</span>
                <span className="text-muted-foreground"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
