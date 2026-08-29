"use client";

import { useState } from "react";

/**
 * MODULO 4 - PET/CT - FASE O
 * Vista integrada de comparacion PET + CT + Fusion (seccion 24 del prompt
 * de mejora). Combina el resultado numerico de las pruebas de interaccion
 * PET/CT (PETCT-01 registro de imagenes, seccion 6; PETCT-02 offset
 * calibration, seccion 14) con la evidencia grafica ya registrada en el
 * modulo de evidencia (Fase J, seccion 23), agrupada por modalidad (PET /
 * CT / Fusion) para que el Fisico Medico revise visual y numericamente la
 * exactitud del registro espacial en una sola pantalla. Esta pantalla no
 * genera ni procesa imagenes DICOM: solo consolida referencias/URLs ya
 * registradas y resultados ya calculados por el motor (seccion 3 del
 * prompt maestro: el motor de calculo es la unica fuente de clasificacion,
 * nunca el operador).
 */

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type JointTest = {
  id: number;
  equipment_id: number | null;
  test_code: string;
  raw_inputs: Record<string, any>;
  calculated: Record<string, any>;
  status: string;
  action_level: string;
  operator?: string | null;
  test_date?: string | null;
  created_at?: string;
};

type EvidenceRecord = {
  id: number;
  test_id: number | null;
  equipment_id: number | null;
  evidence_type: string;
  file_name: string | null;
  file_url: string | null;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

const IMAGE_COLUMNS: { value: string; label: string }[] = [
  { value: "imagen_pet", label: "Imagen PET" },
  { value: "imagen_ct", label: "Imagen CT" },
  { value: "imagen_fusion", label: "Imagen Fusion PET/CT" },
];

const STATUS_STYLES: Record<string, string> = {
  cumple: "bg-green-100 text-green-800 border-green-300",
  no_cumple: "bg-red-100 text-red-800 border-red-300",
  requiere_revision: "bg-yellow-100 text-yellow-800 border-yellow-300",
  no_aplica: "bg-gray-100 text-gray-700 border-gray-300",
  pendiente_revision: "bg-gray-100 text-gray-700 border-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  cumple: "Cumple",
  no_cumple: "No cumple",
  requiere_revision: "Requiere revision",
  no_aplica: "No aplica",
  pendiente_revision: "Pendiente de revision",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.pendiente_revision;
  const label = STATUS_LABELS[status] ?? status;
  return <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${cls}`}>{label}</span>;
}

function equipmentLabel(eq: Equipment | undefined): string {
  if (!eq) return "";
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

function fmt(value: unknown): string {
  if (value === null || value === undefined || (typeof value === "number" && Number.isNaN(value))) return "s/d";
  if (typeof value === "number") return value.toFixed(2);
  return String(value);
}

export default function PetCtComparisonApp({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [petct01, setPetct01] = useState<JointTest | null>(null);
  const [petct02, setPetct02] = useState<JointTest | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadComparison() {
    if (!equipmentId) {
      setMessage("Seleccione un equipo para comparar.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const [r01, r02, rEv] = await Promise.all([
        fetch(`/api/quality-control/petct/joint-tests?equipment_id=${equipmentId}&test_code=PETCT-01`),
        fetch(`/api/quality-control/petct/joint-tests?equipment_id=${equipmentId}&test_code=PETCT-02`),
        fetch(`/api/quality-control/petct/evidence?equipmentId=${equipmentId}`),
      ]);
      const d01 = await r01.json();
      const d02 = await r02.json();
      const dEv = await rEv.json();
      setPetct01(Array.isArray(d01) && d01.length ? d01[0] : null);
      setPetct02(Array.isArray(d02) && d02.length ? d02[0] : null);
      setEvidence(Array.isArray(dEv) ? dEv : []);
      setQueried(true);
    } catch {
      setMessage("Ocurrio un error al cargar la comparacion.");
    } finally {
      setLoading(false);
    }
  }

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comparacion PET + CT + Fusion</h1>
        <p className="text-sm text-gray-500">
          Modulo 4 - Fase O (seccion 24 del prompt de mejora). Vista integrada: combina el resultado
          numerico del registro/offset PET/CT (PETCT-01, PETCT-02) con la evidencia grafica registrada
          para el equipo, agrupada por modalidad, para apoyar la revision visual del Fisico Medico. El
          archivo de imagen se administra fuera de este modulo; aqui solo se referencian las URL ya
          registradas en Evidencia grafica (Fase J).
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
            onClick={loadComparison}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm w-full"
          >
            {loading ? "Cargando..." : "Comparar"}
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      {queried && (
        <>
          {selectedEquipment && (
            <p className="text-sm text-gray-600">Equipo: {equipmentLabel(selectedEquipment)}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-sm">PETCT-01 - Registro de imagenes (seccion 6)</h2>
              {petct01 ? (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={petct01.status} />
                    <span className="text-gray-500">
                      {petct01.test_date ? new Date(petct01.test_date).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div>Desplazamiento maximo: {fmt(petct01.calculated?.maxDisplacementMm)} mm</div>
                  <div>Error en voxels: {fmt(petct01.calculated?.errorVoxels)} (tolerancia: +/-1 voxel)</div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Sin resultado registrado para este equipo.</p>
              )}
            </div>
            <div className="border rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-sm">PETCT-02 - Offset calibration (seccion 14)</h2>
              {petct02 ? (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={petct02.status} />
                    <span className="text-gray-500">
                      {petct02.test_date ? new Date(petct02.test_date).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div>Offset maximo: {fmt(petct02.calculated?.maxOffsetMm)} mm</div>
                  <div>Deriva vs. anterior: {fmt(petct02.calculated?.deltaFromPreviousMm?.max)} mm</div>
                  <div>Deriva vs. baseline: {fmt(petct02.calculated?.deltaFromBaselineMm?.max)} mm</div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Sin resultado registrado para este equipo.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-sm mb-2">Evidencia grafica por modalidad</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {IMAGE_COLUMNS.map((col) => {
                const items = evidence.filter((ev) => ev.evidence_type === col.value);
                return (
                  <div key={col.value} className="border rounded-lg p-3 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                    {items.length === 0 && (
                      <p className="text-xs text-gray-500">Sin evidencia registrada de este tipo.</p>
                    )}
                    {items.map((ev) => (
                      <div key={ev.id} className="space-y-1">
                        {ev.file_url && isImageUrl(ev.file_url) ? (
                          <a href={ev.file_url} target="_blank" rel="noreferrer">
                            <img
                              src={ev.file_url}
                              alt={ev.file_name ?? col.label}
                              className="w-full h-40 object-contain border rounded bg-slate-50"
                            />
                          </a>
                        ) : ev.file_url ? (
                          <a href={ev.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                            {ev.file_name || ev.file_url}
                          </a>
                        ) : null}
                        <div className="text-[11px] text-gray-500">
                          {new Date(ev.uploaded_at).toLocaleDateString()}
                          {ev.description ? ` - ${ev.description}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {(() => {
            const otherEvidence = evidence.filter((ev) => !IMAGE_COLUMNS.some((c) => c.value === ev.evidence_type));
            if (!otherEvidence.length) return null;
            return (
              <div className="border rounded-lg p-4">
                <h2 className="font-semibold text-sm mb-2">Otra evidencia registrada para el equipo</h2>
                <div className="space-y-1">
                  {otherEvidence.map((ev) => (
                    <div key={ev.id} className="text-xs text-gray-600">
                      {ev.file_url && (
                        <a href={ev.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline mr-2">
                          {ev.file_name || ev.file_url}
                        </a>
                      )}
                      <span>{ev.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
