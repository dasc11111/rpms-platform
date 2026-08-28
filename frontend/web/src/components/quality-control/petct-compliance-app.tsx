"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 4 - PET/CT - FASE H
 * Panel de cumplimiento (vencimientos, seccion 25 del prompt de mejora) y
 * catalogo de pruebas de referencia (secciones 4 y 25). Consume el
 * catalogo configurable de la Fase A (/api/quality-control/petct/catalog)
 * y el nuevo endpoint de cumplimiento (/api/quality-control/petct/compliance),
 * que reemplaza en alcance al endpoint heredado /due-status (limitado a
 * las 2 pruebas originales de la Fase 22).
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type CatalogEntry = {
  id: number;
  test_code: string;
  test_name: string;
  modality: string;
  objective: string | null;
  responsible_level: string;
  freq_acceptance: boolean;
  freq_daily: boolean;
  freq_weekly: boolean;
  freq_monthly: boolean;
  freq_quarterly: boolean;
  freq_annual: boolean;
  freq_post_service: boolean;
  reference_bibliography: string;
  requires_tof: boolean;
  implemented: boolean;
};

type ComplianceRow = {
  equipment_id: number;
  equipment_label: string;
  test_code: string;
  test_name: string;
  modality: string;
  responsible_level: string;
  frequency_label: string;
  frequency_days: number;
  last_performed_at: string | null;
  next_due_date: string | null;
  days_until_due: number | null;
  status: "overdue" | "upcoming" | "ok" | "sin_registro";
};

type ComplianceResponse = {
  rows: ComplianceRow[];
  summary: { overdue: number; upcoming: number; sin_registro: number; ok: number };
  checkedAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  overdue: "bg-red-100 text-red-800 border-red-300",
  upcoming: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sin_registro: "bg-gray-100 text-gray-600 border-gray-300",
  ok: "bg-green-100 text-green-800 border-green-300",
};

const STATUS_LABELS: Record<string, string> = {
  overdue: "VENCIDA",
  upcoming: "PROXIMA A VENCER",
  sin_registro: "SIN REGISTRO",
  ok: "AL DIA",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.sin_registro;
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function frequencyLabels(entry: CatalogEntry): string {
  const labels: string[] = [];
  if (entry.freq_acceptance) labels.push("Aceptacion");
  if (entry.freq_daily) labels.push("Diaria");
  if (entry.freq_weekly) labels.push("Semanal");
  if (entry.freq_monthly) labels.push("Mensual");
  if (entry.freq_quarterly) labels.push("Trimestral");
  if (entry.freq_annual) labels.push("Anual");
  if (entry.freq_post_service) labels.push("Post-servicio");
  return labels.length > 0 ? labels.join(", ") : "Sin frecuencia definida";
}

export default function PetCtComplianceApp({ equipment }: { equipment: Equipment[] }) {
  const [view, setView] = useState<"vencimientos" | "catalogo">("vencimientos");
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadCompliance() {
    setLoading(true);
    try {
      const url = equipmentId
        ? `/api/quality-control/petct/compliance?equipment_id=${equipmentId}`
        : "/api/quality-control/petct/compliance";
      const res = await fetch(url);
      const data = await res.json();
      setCompliance(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalog() {
    const res = await fetch("/api/quality-control/petct/catalog");
    const data = await res.json();
    setCatalog(data);
  }

  useEffect(() => {
    if (view === "vencimientos") {
      loadCompliance();
    } else {
      loadCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, equipmentId]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cumplimiento y catalogo de pruebas PET/CT</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase H. Panel de vencimientos (seccion 25 del prompt de mejora) calculado sobre el
          catalogo configurable (seccion 4) y las pruebas ya finalizadas de cada equipo. Un registro en
          borrador (no finalizado) no se considera evidencia de cumplimiento.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setView("vencimientos")}
          className={`px-3 py-2 text-sm border-b-2 ${view === "vencimientos" ? "border-gray-800 font-semibold" : "border-transparent text-gray-500"}`}
        >
          Vencimientos
        </button>
        <button
          type="button"
          onClick={() => setView("catalogo")}
          className={`px-3 py-2 text-sm border-b-2 ${view === "catalogo" ? "border-gray-800 font-semibold" : "border-transparent text-gray-500"}`}
        >
          Catalogo de pruebas
        </button>
      </div>

      {view === "vencimientos" && (
        <div className="space-y-4">
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
          </div>

          {compliance && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 bg-red-50">
                <div className="text-xs text-gray-500">Vencidas</div>
                <div className="text-2xl font-bold text-red-700">{compliance.summary.overdue}</div>
              </div>
              <div className="border rounded-lg p-3 bg-yellow-50">
                <div className="text-xs text-gray-500">Proximas a vencer</div>
                <div className="text-2xl font-bold text-yellow-700">{compliance.summary.upcoming}</div>
              </div>
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="text-xs text-gray-500">Sin registro</div>
                <div className="text-2xl font-bold text-gray-700">{compliance.summary.sin_registro}</div>
              </div>
              <div className="border rounded-lg p-3 bg-green-50">
                <div className="text-xs text-gray-500">Al dia</div>
                <div className="text-2xl font-bold text-green-700">{compliance.summary.ok}</div>
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-gray-500">Calculando...</p>}

          <div className="space-y-2">
            {compliance?.rows.length === 0 && (
              <p className="text-sm text-gray-500">No hay pruebas periodicas configuradas para este filtro.</p>
            )}
            {compliance?.rows.map((r) => (
              <div key={`${r.equipment_id}-${r.test_code}`} className="border rounded p-3 flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={r.status} />
                <span className="font-mono text-xs text-gray-600">{r.test_code}</span>
                <span className="text-gray-700">{r.test_name}</span>
                <span className="text-xs text-gray-500">{r.equipment_label}</span>
                <span className="text-xs text-gray-500">Frecuencia: {r.frequency_label}</span>
                <span className="text-xs text-gray-500">
                  Ultimo: {r.last_performed_at ? new Date(r.last_performed_at).toLocaleDateString() : "Nunca"}
                </span>
                {r.next_due_date && (
                  <span className="text-xs text-gray-500">Vence: {new Date(r.next_due_date).toLocaleDateString()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "catalogo" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Catalogo configurable de pruebas PET/CT (secciones 4 y 25 del prompt de mejora). Este catalogo
            es de solo lectura desde la interfaz; los ajustes de frecuencia o tolerancia los realiza el
            Fisico Medico directamente en la base de datos para evitar cambios normativos accidentales.
          </p>
          {catalog.map((entry) => (
            <div key={entry.id} className="border rounded p-3 space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded">{entry.test_code}</span>
                <span className="font-medium">{entry.test_name}</span>
                <span className="text-xs text-gray-500">({entry.modality})</span>
                {!entry.implemented && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-300">
                    Pendiente de implementar
                  </span>
                )}
                {entry.requires_tof && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">Requiere TOF</span>
                )}
              </div>
              {entry.objective && <p className="text-xs text-gray-600">{entry.objective}</p>}
              <div className="text-xs text-gray-500">
                Responsable: {entry.responsible_level} · Frecuencia: {frequencyLabels(entry)}
              </div>
              <div className="text-xs text-gray-400">Referencia: {entry.reference_bibliography}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
