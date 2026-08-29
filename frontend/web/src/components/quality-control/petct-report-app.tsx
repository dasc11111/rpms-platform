"use client";

import { useState } from "react";
import { generatePetCtReportPdf } from "@/lib/qc-petct-report";

/**
 * MODULO 4 - PET/CT - FASE P
 * UI del informe PDF (seccion 31 del prompt de mejora). El operador solo
 * selecciona el equipo; este componente obtiene los datos ya calculados
 * (ficha del equipo, cumplimiento, pruebas PET/CT/interaccion y alertas
 * con accion recomendada) desde los endpoints existentes y delega el
 * armado del documento a qc-petct-report.ts (Fase P). No se recalcula ni
 * reclasifica ningun resultado en esta pantalla.
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  has_tof: boolean;
  software_name: string | null;
  software_version: string | null;
};

function equipmentLabel(eq: Equipment | undefined): string {
  if (!eq) return "";
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

export default function PetCtReportApp({ equipment }: { equipment: Equipment[] }) {
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
      const [petRes, ctRes, jointRes, alertsRes, complianceRes] = await Promise.all([
        fetch(`/api/quality-control/petct/pet-tests?equipment_id=${equipmentId}`),
        fetch(`/api/quality-control/petct/ct-tests?equipment_id=${equipmentId}`),
        fetch(`/api/quality-control/petct/joint-tests?equipment_id=${equipmentId}`),
        fetch(`/api/quality-control/petct/alerts?equipmentId=${equipmentId}`),
        fetch(`/api/quality-control/petct/compliance?equipment_id=${equipmentId}`),
      ]);
      const petTests = await petRes.json();
      const ctTests = await ctRes.json();
      const jointTests = await jointRes.json();
      const alertsData = await alertsRes.json();
      const complianceData = await complianceRes.json();

      const doc = generatePetCtReportPdf({
        equipment: eq,
        generatedAt: new Date().toISOString(),
        complianceSummary: complianceData?.summary ?? null,
        petTests: Array.isArray(petTests) ? petTests : [],
        ctTests: Array.isArray(ctTests) ? ctTests : [],
        jointTests: Array.isArray(jointTests) ? jointTests : [],
        alerts: Array.isArray(alertsData?.alerts) ? alertsData.alerts : Array.isArray(alertsData) ? alertsData : [],
      });

      const fileName = `informe-petct-${eq.internal_code ?? eq.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
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
        <h1 className="text-2xl font-bold">Informe PDF PET/CT</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase P (seccion 31 del prompt de mejora). Genera un documento PDF que consolida la
          ficha del equipo, el cumplimiento de frecuencias, los resultados ya calculados de las pruebas
          PET, CT e interaccion PET/CT, y las alertas activas con su accion recomendada. El informe solo
          da formato a datos ya calculados por el motor; no reemplaza la firma y revision del Fisico
          Medico responsable.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-lg p-4">
        <div className="md:col-span-2">
          <label className="text-sm font-medium block mb-1">Equipo</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
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
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm w-full"
          >
            {loading ? "Generando..." : "Generar informe PDF"}
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
