"use client";

import { useState } from "react";

/**
 * MODULO ACTIVIMETRO - FASE C
 * Bitacora de auditoria generica y reutilizable (seccion 40 del prompt
 * maestro). Es una pantalla de SOLO LECTURA: los registros se generan
 * automaticamente como efecto de otras acciones del sistema (por
 * ejemplo, al establecer un nuevo baseline, la version anterior se
 * conserva y el cambio se registra aqui con motivo y usuario). Esta
 * pantalla no permite crear, editar ni eliminar registros.
 */

type AuditRecord = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

const KNOWN_ENTITY_TYPES = [
  { value: "qc_activimetro_baseline", label: "Baseline del equipo" },
  { value: "qc_activimetro_equipment", label: "Ficha tecnica del equipo" },
  { value: "qc_activimetro_test_catalog", label: "Catalogo de pruebas" },
  { value: "qc_activimetro_service_events", label: "Eventos de servicio tecnico" },
  { value: "qc_activimetro_procedure_versions", label: "Versiones de procedimiento" },
  { value: "qc_activimetro_sources", label: "Fuentes / patrones" },
];

function entityLabel(entityType: string): string {
  return KNOWN_ENTITY_TYPES.find((t) => t.value === entityType)?.label ?? entityType;
}

export default function ActivimetroAuditApp({ initialRecords }: { initialRecords: AuditRecord[] }) {
  const [records, setRecords] = useState<AuditRecord[]>(initialRecords);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filtered, setFiltered] = useState(false);

  async function loadRecent() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quality-control/activimetro/audit?limit=200");
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
      setFiltered(false);
    } catch {
      setMessage("Ocurrio un error al consultar la bitacora.");
    } finally {
      setLoading(false);
    }
  }

  async function loadByEntity() {
    if (!entityType || !entityId) {
      setMessage("Indique el tipo de entidad y el ID de entidad para filtrar.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch("/api/quality-control/activimetro/audit?" + params.toString());
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
      setFiltered(true);
    } catch {
      setMessage("Ocurrio un error al consultar la bitacora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bitacora de Auditoria - Activimetro</h1>
        <p className="text-sm text-gray-500">
          Registro generico y reutilizable de cambios (seccion 40 del prompt maestro). Los
          registros se generan automaticamente cuando otras pantallas del modulo modifican
          datos con historial (por ejemplo, al establecer un nuevo baseline). Esta pantalla es
          de solo lectura: no permite crear, editar ni eliminar registros.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border rounded-lg p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Tipo de entidad</label>
          <input
            type="text"
            list="entity-type-options"
            className="w-full border rounded px-2 py-1 text-sm text-slate-800"
            placeholder="qc_activimetro_baseline"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <datalist id="entity-type-options">
            {KNOWN_ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">ID de entidad</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1 text-sm text-slate-800"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button type="button" onClick={loadByEntity} disabled={loading} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">
            {loading ? "Consultando..." : "Consultar por entidad"}
          </button>
          <button type="button" onClick={loadRecent} disabled={loading} className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm">
            Ver cambios recientes
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-gray-400">{message}</p>}

      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-2">
          {filtered ? "Historial de la entidad seleccionada" : "Cambios mas recientes (cualquier entidad)"}
        </h2>
        {records.length === 0 && (
          <p className="text-xs text-gray-500">No hay registros de auditoria para mostrar.</p>
        )}
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="border rounded p-2 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                  {entityLabel(r.entity_type)} #{r.entity_id}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {r.action}
                </span>
                <span className="text-gray-500">{new Date(r.changed_at).toLocaleString()}</span>
              </div>
              {r.field_name && (
                <div className="text-gray-600">
                  Campo: <span className="font-medium">{r.field_name}</span>
                  {r.old_value !== null && <span> · Valor anterior: {r.old_value}</span>}
                  {r.new_value !== null && <span> · Valor nuevo: {r.new_value}</span>}
                </div>
              )}
              {r.change_reason && <div className="text-gray-600">Motivo del cambio: {r.change_reason}</div>}
              {r.changed_by && <div className="text-gray-600">Modificado por: {r.changed_by}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
