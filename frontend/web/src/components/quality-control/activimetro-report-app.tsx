"use client";

import { useState } from "react";
import { generateActivimetroReportPdf } from "@/lib/qc-activimetro-report";

/**
 * MODULO ACTIVIMETRO
 * UI del informe PDF (seccion 31 del prompt maestro). El operador solo
 * selecciona el equipo; este componente obtiene los datos ya registrados
 * (ficha del equipo, avisos de vencimiento, pruebas, inspeccion, eventos
 * de servicio y evidencia) desde los endpoints existentes y delega el
 * armado del documento a qc-activimetro-report.ts. No se recalcula ni
 * reclasifica ningun resultado en esta pantalla.
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  service_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  chamber_type: string | null;
  detector_type: string | null;
  software_name: string | null;
  software_version: string | null;
  instrument_id: number | null;
};

function equipmentLabel(eq: Equipment | undefined): string {
  if (!eq) return "";
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

export default function ActivimetroReportApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate() {
    if (!equipmentId) {
      setMessage("Seleccione un equipo para generar el informe.");
      return;
    }
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return;
    setLoading(true);
    setMessage(null);
    try {
      const instrumentId = eq.instrument_id;
      const [testsData, inspections, serviceEvents, evidence, dueData] = await Promise.all([
        instrumentId
          ? fetch(`/api/quality-control/activimetro?instrumentId=${instrumentId}&limit=500`).then((r) => r.json())
          : Promise.resolve({ tests: [] }),
        fetch(`/api/quality-control/activimetro/inspection?equipment_id=${eq.id}`).then((r) => r.json()),
        fetch(`/api/quality-control/activimetro/service-events?equipmentId=${eq.id}`).then((r) => r.json()),
        fetch(`/api/quality-control/activimetro/evidence?equipmentId=${eq.id}`).then((r) => r.json()),
        instrumentId
          ? fetch(`/api/quality-control/activimetro/due-status?instrumentId=${instrumentId}`).then((r) => r.json())
          : Promise.resolve({ alerts: [] }),
      ]);

      const doc = generateActivimetroReportPdf({
        equipment: eq,
        generatedAt: new Date().toISOString(),
        tests: Array.isArray(testsData?.tests) ? testsData.tests : [],
        inspections: Array.isArray(inspections) ? inspections : [],
        serviceEvents: Array.isArray(serviceEvents) ? serviceEvents : [],
        evidence: Array.isArray(evidence) ? evidence : [],
        dueAlerts: Array.isArray(dueData?.alerts) ? dueData.alerts : [],
      });

      const fileName = `informe-activimetro-${eq.internal_code ?? eq.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      setMessage("Informe generado y descargado correctamente.");
    } catch {
      setMessage("Ocurrio un error al generar el informe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Informe PDF - Activimetro</h1>
        <p className="text-sm text-gray-500">
          Genera un documento PDF que consolida la ficha del equipo, los avisos de vencimiento y
          retraso, las pruebas de control de calidad ya registradas (ACTIV-01 a ACTIV-07), los
          eventos de servicio tecnico y la evidencia documental asociada. El informe solo
          consolida datos ya registrados; no recalcula ni reclasifica ningun resultado.
        </p>
      </div>

      <div className="border rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Equipo</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Seleccione un equipo...</option>
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {equipmentLabel(eq)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Generando..." : "Generar y descargar informe PDF"}
        </button>

        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
