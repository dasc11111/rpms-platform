"use client";


import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "warning" | "info";
type AlertType =
  | "uptake_overdue" | "discharge_overdue" | "exam_not_started"
  | "dose_rate_elevated" | "activity_error" | "qc_failure";

interface PetctAlert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  exam_id?: string;
  patient_id?: string;
  patient_name?: string | null;
  radiopharmaceutical?: string;
  message: string;
}

interface AlertsData {
  alerts: PetctAlert[];
  total: number;
  generated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALERT_LABELS: Record<AlertType, string> = {
  uptake_overdue:    "Captación vencida",
  discharge_overdue: "Alta retrasada",
  exam_not_started:  "Examen no iniciado",
  dose_rate_elevated:"Tasa de dosis elevada",
  activity_error:    "Error de actividad",
  qc_failure:        "Falla CC",
};

function SevIcon({ s }: { s: AlertSeverity }) {
  if (s === "critical") return <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />;
  if (s === "warning")  return <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

function sevBg(s: AlertSeverity) {
  return s === "critical" ? "bg-red-50 border-red-200" : s === "warning" ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200";
}

function sevText(s: AlertSeverity) {
  return s === "critical" ? "text-red-700" : s === "warning" ? "text-yellow-700" : "text-blue-700";
}

function sevBadge(s: AlertSeverity) {
  return s === "critical"
    ? "bg-red-100 text-red-700"
    : s === "warning"
    ? "bg-yellow-100 text-yellow-700"
    : "bg-blue-100 text-blue-700";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PetctAlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterSev, setFilterSev] = useState<"all" | AlertSeverity>("all");

  const fetchData = () => {
    setLoading(true);
    fetch("/api/petct/alerts")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const alerts = data?.alerts ?? [];
  const critical = alerts.filter(a => a.severity === "critical");
  const warning  = alerts.filter(a => a.severity === "warning");
  const info     = alerts.filter(a => a.severity === "info");
  const filtered = filterSev === "all" ? alerts : alerts.filter(a => a.severity === filterSev);

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Alertas PET/CT en Tiempo Real</h1>
              <p className="text-sm text-muted-foreground">
                Alertas radiológicas activas — generadas automáticamente según estado de exámenes
                {data?.generated_at && (
                  <span className="ml-2 text-muted-foreground">
                    (actualizado: {new Date(data.generated_at).toLocaleTimeString("es-CL")})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-muted-foreground hover:text-muted-foreground">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="text-center py-16 text-muted-foreground">Calculando alertas...</div>
        ) : !data ? (
          <div className="text-center py-16 text-red-500">Error al cargar alertas.</div>
        ) : (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Críticas",   count: critical.length, color: "red",    icon: AlertTriangle },
                { label: "Avisos",     count: warning.length,  color: "yellow", icon: AlertCircle },
                { label: "Informativas",count: info.length,    color: "blue",   icon: Info },
              ].map(({ label, count, color, icon: Icon }) => (
                <div key={label} className="bg-background rounded-xl border border-border px-5 py-4 shadow-sm">
                  <div className={`inline-flex p-2 rounded-lg bg-${color}-100 mb-2`}>
                    <Icon className={`h-4 w-4 text-${color}-600`} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{count}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {/* No alerts */}
            {alerts.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-6 flex items-center gap-3 text-green-700">
                <CheckCircle2 className="h-6 w-6 shrink-0" />
                <div>
                  <div className="font-semibold">Sin alertas activas</div>
                  <div className="text-sm text-green-600">Todos los exámenes PET/CT están dentro de los parámetros normales.</div>
                </div>
              </div>
            )}

            {alerts.length > 0 && (
              <>
                {/* Filters */}
                <div className="flex gap-2">
                  {(["all", "critical", "warning", "info"] as const).map(sev => (
                    <button
                      key={sev}
                      onClick={() => setFilterSev(sev)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filterSev === sev ? "bg-gray-800 text-white" : "bg-background border border-border text-muted-foreground hover:border-gray-400"
                      }`}
                    >
                      {sev === "all" ? `Todas (${alerts.length})` : sev === "critical" ? `Críticas (${critical.length})` : sev === "warning" ? `Avisos (${warning.length})` : `Info (${info.length})`}
                    </button>
                  ))}
                </div>

                {/* Alert cards */}
                <div className="space-y-3">
                  {filtered.map(a => (
                    <div key={a.id} className={`rounded-xl border px-5 py-4 ${sevBg(a.severity)}`}>
                      <div className="flex items-start gap-3">
                        <SevIcon s={a.severity} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`font-semibold text-sm ${sevText(a.severity)}`}>{a.message}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sevBadge(a.severity)}`}>{a.severity}</span>
                            <span className="text-xs bg-background/60 px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                              {ALERT_LABELS[a.type] ?? a.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {a.patient_name && <span>Paciente: <strong>{a.patient_name}</strong></span>}
                            {a.patient_id && <span>ID: {a.patient_id}</span>}
                            {a.radiopharmaceutical && <span>Radiofármaco: {a.radiopharmaceutical}</span>}
                            {a.exam_id && <span>Examen #{a.exam_id}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Regulatory footer */}
            <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-muted-foreground mb-1">Marco normativo aplicable</p>
              <p>
                Decreto Supremo N°3/1985 MINSAL Art. 32-38 — Procedimientos de trabajo con fuentes radiactivas no encapsuladas.
                IAEA Safety Reports Series No. 58 — Nuclear Medicine Resources Manual.
                ICRP Publication 128 — Radiation Dose to Patients from Radiopharmaceuticals (PET).
                CCHEN ORD. sobre procedimientos de alta de pacientes tratados con radioisótopos.
                NRC Regulatory Guide 8.39 — Release Criteria for Patients Administered Radioactive Materials.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
