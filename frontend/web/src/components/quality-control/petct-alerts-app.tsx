"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 4 - PET/CT - FASE M / FASE N
 * UI del motor de inteligencia de alertas (seccion 29) y del motor de
 * decision (seccion 30 del prompt de mejora). Consume
 * /api/quality-control/petct/alerts, que ya cruza tolerancia/nivel de
 * accion, tendencia (Fase K), baseline (Fase A/I) y eventos de servicio
 * pendientes (Fase A/I) en un unico listado ordenado por severidad, y
 * ahora incluye ademas la accion recomendada textual (Fase N) para cada
 * alerta.
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type AlertSeverity = "alta" | "media" | "baja";
type DecisionUrgency = "inmediata" | "prioritaria" | "programada" | "informativa";

type RecommendedAction = {
  urgency: DecisionUrgency;
  action: string;
};

type Alert = {
  id: string;
  severity: AlertSeverity;
  type: string;
  equipment_id: number | null;
  equipment_label: string;
  test_code: string | null;
  test_name: string | null;
  title: string;
  description: string;
  href: string;
  recommended_action: RecommendedAction;
};

type AlertsResponse = {
  alerts: Alert[];
  summary: { alta: number; media: number; baja: number };
  checkedAt: string;
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  alta: "bg-red-100 text-red-800 border-red-300",
  media: "bg-yellow-100 text-yellow-800 border-yellow-300",
  baja: "bg-gray-100 text-gray-600 border-gray-300",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  alta: "ALTA",
  media: "MEDIA",
  baja: "BAJA",
};

const URGENCY_STYLES: Record<DecisionUrgency, string> = {
  inmediata: "bg-red-600 text-white",
  prioritaria: "bg-orange-500 text-white",
  programada: "bg-blue-500 text-white",
  informativa: "bg-slate-400 text-white",
};

const URGENCY_LABELS: Record<DecisionUrgency, string> = {
  inmediata: "Accion inmediata",
  prioritaria: "Accion prioritaria",
  programada: "Accion programada",
  informativa: "Informativa",
};

const TYPE_LABELS: Record<string, string> = {
  fuera_de_tolerancia: "Fuera de tolerancia",
  cercano_al_limite: "Cercano al limite",
  tendencia_progresiva: "Tendencia progresiva",
  cambio_brusco: "Cambio brusco",
  cambio_vs_baseline: "Cambio vs. baseline",
  prueba_vencida: "Prueba vencida",
  prueba_sin_registro: "Prueba sin registro",
  post_servicio_pendiente: "Post-servicio pendiente",
};

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${SEVERITY_STYLES[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: DecisionUrgency }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${URGENCY_STYLES[urgency]}`}>
      {URGENCY_LABELS[urgency]}
    </span>
  );
}

export default function PetCtAlertsApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("");

  async function loadAlerts() {
    setLoading(true);
    try {
      const url = equipmentId
        ? `/api/quality-control/petct/alerts?equipment_id=${equipmentId}`
        : "/api/quality-control/petct/alerts";
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  const visibleAlerts = data?.alerts.filter((a) => !typeFilter || a.type === typeFilter) ?? [];
  const typesPresent = Array.from(new Set(data?.alerts.map((a) => a.type) ?? []));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alertas PET/CT</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase M/N. Inteligencia de alertas (seccion 29 del prompt de mejora): cruza el estado de
          tolerancia/nivel de accion de cada prueba, el analisis de tendencia (Fase K), la comparacion contra
          el baseline vigente (Fase A/I) y los eventos de servicio tecnico pendientes (Fase A/I). Cada alerta
          incluye ademas una accion recomendada textual (motor de decision, seccion 30) que nunca reemplaza el
          criterio del Fisico Medico ni ejecuta ninguna decision clinica automatica.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end border rounded-lg p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Filtrar por equipo</label>
          <select
            className="border rounded px-2 py-1 text-sm min-w-[260px]"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Todos los equipos</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.manufacturer} {eq.model} ({eq.internal_code ?? "s/codigo"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Filtrar por tipo</label>
          <select
            className="border rounded px-2 py-1 text-sm min-w-[220px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {typesPresent.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 bg-red-50">
            <div className="text-xs text-gray-500">Severidad alta</div>
            <div className="text-2xl font-bold text-red-700">{data.summary.alta}</div>
          </div>
          <div className="border rounded-lg p-3 bg-yellow-50">
            <div className="text-xs text-gray-500">Severidad media</div>
            <div className="text-2xl font-bold text-yellow-700">{data.summary.media}</div>
          </div>
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="text-xs text-gray-500">Severidad baja</div>
            <div className="text-2xl font-bold text-gray-700">{data.summary.baja}</div>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Calculando...</p>}

      <div className="space-y-2">
        {!loading && visibleAlerts.length === 0 && (
          <p className="text-sm text-gray-500">No hay alertas activas para este filtro.</p>
        )}
        {visibleAlerts.map((a) => (
          <div key={a.id} className="block border rounded p-3 space-y-2 text-sm hover:bg-gray-50">
            <a href={a.href} className="block space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={a.severity} />
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-white">
                  {TYPE_LABELS[a.type] ?? a.type}
                </span>
                {a.test_code && <span className="font-mono text-xs text-gray-600">{a.test_code}</span>}
                <span className="font-medium">{a.title}</span>
              </div>
              <p className="text-xs text-gray-600">{a.description}</p>
              <div className="text-xs text-gray-400">{a.equipment_label}</div>
            </a>
            {a.recommended_action && (
              <div className="border-t pt-2 flex flex-wrap items-start gap-2">
                <UrgencyBadge urgency={a.recommended_action.urgency} />
                <p className="text-xs text-gray-700 flex-1">{a.recommended_action.action}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
