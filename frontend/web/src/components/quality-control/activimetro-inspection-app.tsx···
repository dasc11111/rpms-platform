"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * MODULO ACTIVIMETRO - ACTIV-01: INSPECCION FISICA Y FUNCIONAL
 * (seccion 6 del prompt maestro QA/QC Activimetros)
 *
 * Checklist configurable de verificacion fisica y funcional del equipo.
 * El resultado global se calcula automaticamente (nunca lo decide el
 * operador): NO_CUMPLE si algun item no cumple; si no, REQUIERE_REVISION
 * si algun item lo requiere; si todos los items aplicables son "no aplica"
 * el resultado es NO_APLICA; en cualquier otro caso, CUMPLE.
 */

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type ChecklistItem = {
  item_code: string;
  item_label: string;
  item_order: number;
};

type ItemResult = "cumple" | "no_cumple" | "requiere_revision" | "no_aplica";

type Inspection = {
  id: number;
  equipment_id: number | null;
  inspection_date: string;
  inspection_time: string | null;
  performed_by: string | null;
  physicist_reviewed_by: string | null;
  overall_result: string;
  observaciones: string | null;
};

type InspectionItemRecord = {
  item_code: string;
  item_label: string;
  result: ItemResult;
  comments: string | null;
};

const RESULT_OPTIONS: { value: ItemResult; label: string }[] = [
  { value: "cumple", label: "Cumple" },
  { value: "no_cumple", label: "No cumple" },
  { value: "requiere_revision", label: "Requiere revision" },
  { value: "no_aplica", label: "No aplica" },
];

const BADGE_STYLES: Record<string, string> = {
  CUMPLE: "bg-green-100 text-green-800",
  NO_CUMPLE: "bg-red-100 text-red-800",
  REQUIERE_REVISION: "bg-yellow-100 text-yellow-800",
  NO_APLICA: "bg-gray-100 text-gray-700",
};

const BADGE_LABELS: Record<string, string> = {
  CUMPLE: "CUMPLE",
  NO_CUMPLE: "NO CUMPLE",
  REQUIERE_REVISION: "REQUIERE REVISION",
  NO_APLICA: "NO APLICA",
};

function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${BADGE_STYLES[result] ?? "bg-gray-100 text-gray-700"}`}>
      {BADGE_LABELS[result] ?? result}
    </span>
  );
}

export default function ActivimetroInspectionApp() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [inspectionDate, setInspectionDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [inspectionTime, setInspectionTime] = useState<string>("");
  const [performedBy, setPerformedBy] = useState("");
  const [physicistReviewedBy, setPhysicistReviewedBy] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [itemResults, setItemResults] = useState<Record<string, { result: ItemResult; comments: string }>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, InspectionItemRecord[]>>({});

  useEffect(() => {
    fetch("/api/quality-control/activimetro/equipment").then((r) => r.json()).then(setEquipmentList);
    fetch("/api/quality-control/activimetro/inspection/checklist").then((r) => r.json()).then((items: ChecklistItem[]) => {
      setChecklist(items);
      const initial: Record<string, { result: ItemResult; comments: string }> = {};
      for (const item of items) {
        initial[item.item_code] = { result: "cumple", comments: "" };
      }
      setItemResults(initial);
    });
    loadInspections();
  }, []);

  async function loadInspections() {
    const res = await fetch("/api/quality-control/activimetro/inspection");
    const data = await res.json();
    setInspections(data);
  }

  function setItemResult(code: string, result: ItemResult) {
    setItemResults((prev) => ({ ...prev, [code]: { ...prev[code], result } }));
  }

  function setItemComment(code: string, comments: string) {
    setItemResults((prev) => ({ ...prev, [code]: { ...prev[code], comments } }));
  }

  const previewOverall = useMemo(() => {
    const results = checklist.map((c) => itemResults[c.item_code]?.result ?? "cumple");
    if (results.some((r) => r === "no_cumple")) return "NO_CUMPLE";
    if (results.some((r) => r === "requiere_revision")) return "REQUIERE_REVISION";
    if (results.length > 0 && results.every((r) => r === "no_aplica")) return "NO_APLICA";
    return "CUMPLE";
  }, [checklist, itemResults]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const items = checklist.map((c) => ({
        item_code: c.item_code,
        item_label: c.item_label,
        result: itemResults[c.item_code]?.result ?? "cumple",
        comments: itemResults[c.item_code]?.comments || null,
      }));
      const res = await fetch("/api/quality-control/activimetro/inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId ? Number(equipmentId) : null,
          inspection_date: inspectionDate,
          inspection_time: inspectionTime || null,
          performed_by: performedBy || null,
          physicist_reviewed_by: physicistReviewedBy || null,
          observaciones: observaciones || null,
          items,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setMessage("Inspeccion registrada correctamente.");
      setObservaciones("");
      await loadInspections();
    } catch {
      setMessage("Ocurrio un error al registrar la inspeccion.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!expandedItems[id]) {
      const res = await fetch(`/api/quality-control/activimetro/inspection?id=${id}`);
      const data = await res.json();
      setExpandedItems((prev) => ({ ...prev, [id]: data.items }));
    }
  }

  function equipmentLabel(id: number | null) {
    if (!id) return "Sin equipo asociado";
    const eq = equipmentList.find((e) => e.id === id);
    if (!eq) return `Equipo #${id}`;
    return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ACTIV-01 · Inspeccion Fisica y Funcional</h1>
        <p className="text-sm text-gray-500">
          Checklist de verificacion fisica y funcional del activimetro: integridad, camara de
          medicion, porta-viales/jeringas, pantalla, teclado, conectores, fuente de
          alimentacion, limpieza, identificacion, funcionamiento general y documentacion. El
          resultado global se calcula automaticamente a partir de cada item.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Equipo</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">Sin equipo asociado</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.manufacturer} {eq.model} ({eq.internal_code ?? "s/codigo"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Fecha</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 text-sm"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Hora</label>
            <input
              type="time"
              className="w-full border rounded px-2 py-1 text-sm"
              value={inspectionTime}
              onChange={(e) => setInspectionTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Realizado por (operador)</label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Revisado por (fisico medico)</label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm"
              value={physicistReviewedBy}
              onChange={(e) => setPhysicistReviewedBy(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-md divide-y">
          {checklist.map((item) => (
            <div key={item.item_code} className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              <div className="md:col-span-1 text-sm font-medium">{item.item_label}</div>
              <div className="md:col-span-1 flex flex-wrap gap-3">
                {RESULT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name={`item-${item.item_code}`}
                      checked={(itemResults[item.item_code]?.result ?? "cumple") === opt.value}
                      onChange={() => setItemResult(item.item_code, opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="md:col-span-1">
                <input
                  type="text"
                  placeholder="Comentarios (opcional)"
                  className="w-full border rounded px-2 py-1 text-xs"
                  value={itemResults[item.item_code]?.comments ?? ""}
                  onChange={(e) => setItemComment(item.item_code, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Observaciones generales</label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Resultado global (calculado):</span>
          <ResultBadge result={previewOverall} />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 text-white text-sm">
            {loading ? "Guardando..." : "Registrar inspeccion"}
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      </form>

      <div>
        <h2 className="text-lg font-semibold mb-2">Historial de inspecciones</h2>
        <div className="border rounded-lg divide-y">
          {inspections.length === 0 && <div className="p-3 text-sm text-gray-500">Sin inspecciones registradas.</div>}
          {inspections.map((insp) => (
            <div key={insp.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="text-sm">
                  <span className="font-medium">{insp.inspection_date}</span>{" "}
                  {insp.inspection_time ? `${insp.inspection_time} · ` : ""}
                  {equipmentLabel(insp.equipment_id)}
                  {insp.performed_by ? ` · ${insp.performed_by}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  <ResultBadge result={insp.overall_result} />
                  <button
                    type="button"
                    onClick={() => toggleExpand(insp.id)}
                    className="text-xs px-2 py-1 rounded border"
                  >
                    {expandedId === insp.id ? "Ocultar" : "Ver detalle"}
                  </button>
                </div>
              </div>
              {expandedId === insp.id && (
                <div className="mt-3 border-t pt-3 space-y-1">
                  {(expandedItems[insp.id] ?? []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span>{item.item_label}</span>
                      <span className="flex items-center gap-2">
                        <ResultBadge result={item.result.toUpperCase()} />
                        {item.comments && <span className="text-gray-500">{item.comments}</span>}
                      </span>
                    </div>
                  ))}
                  {insp.observaciones && (
                    <div className="text-xs text-gray-600 pt-2">Observaciones: {insp.observaciones}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
