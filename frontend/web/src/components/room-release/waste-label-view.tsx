"use client";

import { useEffect, useState, useCallback } from "react";
import {
  WasteLabel,
  WasteLabelHistoryEntry,
  WasteMeasurement,
  WasteMeasurementTipo,
  ProyeccionDispensa,
  RoomReleaseRecord,
  WasteStorageLocation,
  WASTE_LABEL_STATUS,
  WASTE_LABEL_STATUS_LABELS,
  WasteLabelStatus,
  WASTE_TYPE_DISPENSA_OPTIONS,
  WASTE_MEASUREMENT_TIPO_LABELS,
  CRITERIO_UNIVERSAL_BQ_CM2,
  CRITERIO_UNIVERSAL_TASA_DOSIS_USVH,
  wasteTypeDisplayLabel,
  formatActividad,
} from "@/lib/waste";

type ApiResponse = {
  row: WasteLabel & {
    lot_number?: string | null;
    dispensa_estado?: string | null;
    fecha_estimada_liberacion?: string | null;
    fecha_dispensa?: string | null;
    dispensado_por?: string | null;
  };
  history: WasteLabelHistoryEntry[];
  measurements: WasteMeasurement[];
  roomRelease: RoomReleaseRecord | null;
  proyeccion: ProyeccionDispensa;
  dispensa_estado_label: string;
};

type TabKey = "rotulo" | "acta" | "resultados" | "fotografias" | "historial" | "estado";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rotulo", label: "Rótulo" },
  { key: "acta", label: "Acta" },
  { key: "resultados", label: "Resultados y Mediciones" },
  { key: "fotografias", label: "Fotografías" },
  { key: "historial", label: "Historial" },
  { key: "estado", label: "Estado" },
  ];

export default function WasteLabelView({ labelId }: { labelId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("rotulo");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

const [locations, setLocations] = useState<WasteStorageLocation[]>([]);
  const [editWasteType, setEditWasteType] = useState("");
  const [editWasteTypeOther, setEditWasteTypeOther] = useState("");
  const [editStorageLocationId, setEditStorageLocationId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

// --- Registro de mediciones (seguimiento / verificacion final / dispensa)
const [medTipo, setMedTipo] = useState<WasteMeasurementTipo>("seguimiento");
  const [medFecha, setMedFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [medCps, setMedCps] = useState("");
  const [medCpsFondo, setMedCpsFondo] = useState("0");
  const [medTasaDosis, setMedTasaDosis] = useState("");
  const [medInstrumento, setMedInstrumento] = useState("");
  const [medUsuario, setMedUsuario] = useState("");
  const [medObservaciones, setMedObservaciones] = useState("");
  const [medSaving, setMedSaving] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);
  const [medSuccess, setMedSuccess] = useState<string | null>(null);

const [dispensaUsuario, setDispensaUsuario] = useState("");
  const [dispensaSaving, setDispensaSaving] = useState(false);
  const [dispensaError, setDispensaError] = useState<string | null>(null);

const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`/api/waste-labels/${labelId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo cargar el rótulo");
      setData(null);
    } else {
      setData(json);
      setEditWasteType(json.row.waste_type ?? "");
      setEditWasteTypeOther(json.row.waste_type_other ?? "");
      setEditStorageLocationId(json.row.storage_location_id ? String(json.row.storage_location_id) : "");
    }
  } catch {
    setError("Error de red al cargar el rótulo");
  } finally {
    setLoading(false);
  }
}, [labelId]);

useEffect(() => {
  load();
}, [load]);

useEffect(() => {
  fetch("/api/waste-storage/locations")
  .then((res) => (res.ok ? res.json() : { rows: [] }))
  .then((d) => setLocations(d.rows ?? []))
  .catch(() => {});
}, []);

useEffect(() => {
  if (!data?.row) return;
  let cancelled = false;
  (async () => {
    try {
      const QRCode = (await import("qrcode")).default;
      const url = typeof window !== "undefined" ? window.location.href : "";
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
      if (!cancelled) setQrDataUrl(dataUrl);
    } catch {
      if (!cancelled) setQrDataUrl(null);
    }
  })();
  return () => {
    cancelled = true;
  };
}, [data?.row]);

async function handlePrint() {
  try {
    await fetch(`/api/waste-labels/${labelId}/print`, { method: "POST" });
  } catch {
    // La impresión igual continúa aunque falle el registro de trazabilidad.
  }
  window.print();
  load();
}

async function handleSaveEdit() {
  setEditError(null);
  setEditSuccess(null);
  if (editWasteType === "otro" && !editWasteTypeOther.trim()) {
    setEditError('Debe especificar el tipo de residuo cuando selecciona "Otro"');
    return;
  }
  setSavingEdit(true);
  try {
    const res = await fetch(`/api/waste-labels/${labelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waste_type: editWasteType || null,
        waste_type_other: editWasteType === "otro" ? editWasteTypeOther.trim() : null,
        storage_location_id: editStorageLocationId ? Number(editStorageLocationId) : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEditError(json.error ?? "No se pudo guardar el rótulo");
      return;
    }
    setEditSuccess("Rótulo actualizado correctamente.");
    await load();
  } catch {
    setEditError("Error de red al guardar el rótulo");
  } finally {
    setSavingEdit(false);
  }
}

async function handleAddMeasurement() {
  setMedError(null);
  setMedSuccess(null);
  if (medCps.trim() === "" || Number.isNaN(Number(medCps)) || Number(medCps) < 0) {
    setMedError("Debe ingresar las cps medidas, un numero valido y no negativo.");
    return;
  }
  if (medTipo === "verificacion_final" && (medTasaDosis.trim() === "" || Number.isNaN(Number(medTasaDosis)) || Number(medTasaDosis) < 0)) {
    setMedError("La verificación final requiere registrar la tasa de dosis (µSv/h).");
    return;
  }
  setMedSaving(true);
  try {
    const res = await fetch(`/api/waste-labels/${labelId}/measurements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: medTipo,
        fecha: medFecha,
        cps: Number(medCps),
        cps_fondo: medCpsFondo.trim() === "" ? 0 : Number(medCpsFondo),
        tasa_dosis_usv_h: medTasaDosis.trim() === "" ? null : Number(medTasaDosis),
        instrumento: medInstrumento.trim() || null,
        usuario: medUsuario.trim() || null,
        observaciones: medObservaciones.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMedError(json.error ?? "No se pudo registrar la medición.");
      return;
    }
    setMedSuccess("Medición registrada correctamente.");
    setMedCps("");
    setMedTasaDosis("");
    setMedObservaciones("");
    await load();
  } catch {
    setMedError("Error de red al registrar la medición.");
  } finally {
    setMedSaving(false);
  }
}

async function handleConfirmDispensa() {
  setDispensaError(null);
  if (!dispensaUsuario.trim()) {
    setDispensaError("Debe ingresar el nombre del OPR que confirma la dispensa.");
    return;
  }
  setDispensaSaving(true);
  try {
    const res = await fetch(`/api/waste-labels/${labelId}/measurements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "dispensa", usuario: dispensaUsuario.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDispensaError(json.error ?? "No se pudo confirmar la dispensa.");
      return;
    }
    await load();
  } catch {
    setDispensaError("Error de red al confirmar la dispensa.");
  } finally {
    setDispensaSaving(false);
  }
}

async function handleDownloadPdf() {
  if (!data?.row) return;
  setGeneratingPdf(true);
  try {
    const { jsPDF } = await import("jspdf");
    const row = data.row;
    // Formato A6 (105 x 148 mm), segun lo requerido para la plantilla de impresion.
  const doc = new jsPDF({ unit: "mm", format: [105, 148] });
    const marginX = 6;
    let y = 10;

  doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("RPMS · Medicina Nuclear", marginX, y);
    y += 5;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text("Rótulo de Residuo Radiactivo", marginX, y);
    y += 7;

  doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text("N° de rótulo", marginX, y);
    y += 5;
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(row.label_number, marginX, y);
    y += 7;

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", 105 - 6 - 28, 10, 28, 28);
    } catch {
      // Si falla la insercion del QR, el PDF igual se genera sin el.
    }
  }

  const fields: [string, string][] = [
    ["Fecha de generación", row.generation_date],
    ["N° de lote", row.lot_number ?? "—"],
    ["Radionúclido", row.radionuclide_code],
    ["Servicio", row.service],
    ["Sala", row.sala],
    ["N° de habitación", row.room_number ?? "—"],
    ["Paciente", row.paciente_nombre ?? "—"],
    ["Tipo de residuo", wasteTypeDisplayLabel(row.waste_type, row.waste_type_other)],
    ["Contenedor", row.container ?? "—"],
    ["Ubicación de almacenamiento", row.storage_location ?? "—"],
    ["Fecha de ingreso", row.entry_date],
    ["Responsable", row.responsible],
    ["Estado", WASTE_LABEL_STATUS_LABELS[row.status]],
    ];

  doc.setFontSize(8.5);
    for (const [label, value] of fields) {
      doc.setTextColor(120);
      doc.text(label, marginX, y);
      y += 4;
      doc.setTextColor(10);
      doc.text(String(value), marginX, y);
      y += 5.5;
    }

  const proyeccion = data.proyeccion;
    doc.setTextColor(120);
    doc.text("Estado de dispensa por decaimiento", marginX, y);
    y += 4;
    doc.setTextColor(10);
    if (proyeccion.aplica) {
      doc.text(
        proyeccion.fechaEstimadaLiberacion
        ? `${data.dispensa_estado_label} (fecha estimada: ${proyeccion.fechaEstimadaLiberacion}, ${proyeccion.diasRestantesEstimados} dia(s))`
        : data.dispensa_estado_label,
        marginX,
        y
        );
    } else {
      doc.text(proyeccion.mensaje ?? data.dispensa_estado_label, marginX, y);
    }
    y += 5.5;

  if (row.observations) {
    doc.setTextColor(120);
    doc.text("Observaciones", marginX, y);
    y += 4;
    doc.setTextColor(10);
    const lines = doc.splitTextToSize(row.observations, 105 - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 4.5;
  }

  doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Impresiones: ${row.print_count} · Escanee el QR para ver el registro completo`,
      marginX,
      142
      );

  doc.save(`${row.label_number}.pdf`);
  } finally {
    setGeneratingPdf(false);
  }
}

async function handleStatusChange(newStatus: WasteLabelStatus) {
  setSavingStatus(true);
  try {
    const res = await fetch(`/api/waste-labels/${labelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) await load();
  } finally {
    setSavingStatus(false);
  }
}

if (loading) {
  return <div className="p-8 text-sm text-gray-500">Cargando rótulo…</div>;
}
  if (error || !data) {
    return <div className="p-8 text-sm text-red-600">{error ?? "Rótulo no encontrado"}</div>;
  }
  
  const { row, history, measurements, roomRelease, proyeccion, dispensa_estado_label } = data;
  
  
  return (
    <div className="min-h-screen bg-gray-50">
    <style>{`
    @media print {
    .no-print { display: none !important; }
    .print-label {
    width: 105mm;
    height: 148mm;
    margin: 0 auto;
    box-shadow: none !important;
    border: 1px solid #000 !important;
    }
    body { background: white !important; }
    }
    `}</style>
    
    <div className="no-print border-b bg-white px-6 py-4 flex items-center justify-between">
    <div>
    <h1 className="text-lg font-semibold text-gray-900">Rótulo {row.label_number}</h1>
    <p className="text-sm text-gray-500">Gestión de Residuos Radiactivos</p>
    </div>
    <div className="flex gap-2">
    <button
      onClick={handleDownloadPdf}
      disabled={generatingPdf}
      className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
      {generatingPdf ? "Generando PDF…" : "Descargar PDF"}
    </button>
    <button
      onClick={handlePrint}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
    Imprimir rótulo
    </button>
    </div>
    </div>
    
    <div className="no-print border-b bg-white px-6">
    <nav className="flex gap-4">
      {TABS.map((t) => (
      <button
        key={t.key}
        onClick={() => setTab(t.key)}
        className={`border-b-2 px-2 py-3 text-sm font-medium ${
          tab === t.key
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
        }`}
        >
        {t.label}
      </button>
      ))}
    </nav>
    </div>
    
    <div className="mx-auto max-w-3xl p-6">
      {tab === "rotulo" && (
      <>
      <div className="print-label mx-auto flex flex-col gap-3 rounded-lg border-2 border-gray-800 bg-white p-5 shadow-lg">
      <div className="flex items-start justify-between border-b border-gray-300 pb-2">
      <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">RPMS · Medicina Nuclear</p>
      <h2 className="text-base font-bold text-gray-900">Rótulo de Residuo Radiactivo</h2>
      </div>
      <RadiationSymbol />
      </div>
      
      <div className="flex items-center justify-between">
      <div>
      <p className="text-[11px] uppercase text-gray-500">N° de rótulo</p>
      <p className="text-xl font-bold tracking-wider text-gray-900">{row.label_number}</p>
        {row.lot_number && <p className="text-[11px] text-gray-500">Lote: {row.lot_number}</p>}
      </div>
        {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="Código QR" className="h-20 w-20" />
        )}
      </div>
      
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      <Field label="Fecha de generación" value={row.generation_date} />
      <Field label="Radionúclido" value={row.radionuclide_code} />
      <Field label="Servicio" value={row.service} />
      <Field label="Sala" value={row.sala} />
      <Field label="N° de habitación" value={row.room_number ?? "—"} />
      <Field label="Paciente" value={row.paciente_nombre ?? "—"} />
      <Field label="Tipo de residuo" value={wasteTypeDisplayLabel(row.waste_type, row.waste_type_other)} />
      <Field label="Contenedor" value={row.container ?? "—"} />
      <Field label="Ubicación de almacenamiento" value={row.storage_location ?? "—"} />
      <Field label="Fecha de ingreso" value={row.entry_date} />
      <Field label="Responsable" value={row.responsible} />
      <Field label="Estado" value={WASTE_LABEL_STATUS_LABELS[row.status]} />
      </dl>
      
        {row.observations && (
        <div className="border-t border-gray-300 pt-2 text-xs">
        <p className="font-semibold text-gray-500">Observaciones</p>
        <p className="text-gray-800">{row.observations}</p>
        </div>
      )}
      
      <p className="mt-auto text-center text-[10px] text-gray-400">
      Impresiones: {row.print_count} · Escanee el QR para ver el registro completo
      </p>
      </div>
      
      <div className="no-print mx-auto mt-4 max-w-md rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Editar rótulo</h3>
      <div className="space-y-3">
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de residuo</label>
      <select
        value={editWasteType}
        onChange={(e) => setEditWasteType(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        >
      <option value="">Sin especificar</option>
        {WASTE_TYPE_DISPENSA_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
          ))}
      </select>
      </div>
        {editWasteType === "otro" && (
        <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Especificar otro tipo de residuo</label>
        <input
          value={editWasteTypeOther}
          onChange={(e) => setEditWasteTypeOther(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          placeholder="Ej: Almohada"
          />
        </div>
      )}
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">Ubicación de almacenamiento</label>
      <select
        value={editStorageLocationId}
        onChange={(e) => setEditStorageLocationId(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        >
      <option value="">Sin asignar</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
          ))}
      </select>
      </div>
        {editError && <p className="text-xs text-red-600">{editError}</p>}
        {editSuccess && <p className="text-xs text-green-600">{editSuccess}</p>}
      <button
        onClick={handleSaveEdit}
        disabled={savingEdit}
        className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
        {savingEdit ? "Guardando..." : "Guardar cambios"}
      </button>
      </div>
      </div>
      </>
      )}
    
      {tab === "acta" && (
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Acta de Liberación de Sala</h3>
        {!roomRelease ? (
        <p className="text-sm text-gray-500">
        Este residuo no proviene de un Acta de Liberación de Sala: fue generado de forma independiente.
        </p>
        ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Field label="Fecha de liberación" value={roomRelease.release_date} />
        <Field label="Fecha de ingreso" value={roomRelease.admission_date ?? "—"} />
        <Field label="Servicio" value={roomRelease.service} />
        <Field label="Sala" value={roomRelease.sala} />
        <Field label="N° de habitación" value={roomRelease.room_number ?? "—"} />
        <Field label="Paciente" value={roomRelease.paciente_nombre} />
        <Field label="RUN" value={roomRelease.paciente_run ?? "—"} />
        <Field label="Ficha clínica" value={roomRelease.ficha_clinica ?? "—"} />
        <Field label="Radionúclido" value={roomRelease.radionuclide_code} />
        <Field
          label="Actividad administrada"
          value={formatActividad(roomRelease.actividad_administrada, roomRelease.unidad_actividad)}
          />
        <Field label="Responsable OPR" value={roomRelease.responsable_opr} />
        <Field label="Estado del acta" value={roomRelease.status} />
        </dl>
      )}
      </div>
    )}
    
    
      {tab === "resultados" && (
      <div className="space-y-4">
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
      Criterio universal de dispensa
      </h3>
      <p className="mb-3 text-xs text-gray-500">
      Aplica a todos los tipos de residuo de este módulo: actividad superficial ≤ {CRITERIO_UNIVERSAL_BQ_CM2} Bq/cm²
      Y tasa de dosis &lt; {CRITERIO_UNIVERSAL_TASA_DOSIS_USVH} µSv/h, evaluados de forma independiente sobre la
      última medición registrada (nunca sobre la actividad inicial de generación).
      </p>
      <div
        className={`rounded-md px-3 py-2 text-center text-sm font-semibold ${
          row.dispensa_estado === "apto_para_dispensa" || row.dispensa_estado === "dispensado"
          ? "bg-green-100 text-green-700"
          : row.dispensa_estado === "no_apto"
          ? "bg-red-100 text-red-700"
          : row.dispensa_estado === "pendiente_verificacion_final"
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-700"
        }`}
        >
        {dispensa_estado_label}
      </div>
        {proyeccion.aplica && proyeccion.fechaEstimadaLiberacion && (
        <p className="mt-2 text-center text-xs text-gray-500">
        Fecha estimada de cumplimiento del criterio de contaminación: {proyeccion.fechaEstimadaLiberacion} (
          {proyeccion.diasRestantesEstimados} día(s) restantes, según la última medición registrada)
        </p>
      )}
        {!proyeccion.aplica && (
        <p className="mt-2 text-center text-xs text-gray-500">{proyeccion.mensaje}</p>
      )}
      </div>
      
        {row.dispensa_estado === "apto_para_dispensa" && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-green-800">Confirmar dispensa</h3>
        <p className="mb-3 text-xs text-green-700">
        El residuo cumple el criterio universal de dispensa. Registre el nombre del Oficial de Protección
        Radiológica que confirma la dispensa final.
        </p>
        <div className="flex gap-2">
        <input
          value={dispensaUsuario}
          onChange={(e) => setDispensaUsuario(e.target.value)}
          placeholder="Nombre del OPR"
          className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        <button
          onClick={handleConfirmDispensa}
          disabled={dispensaSaving}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
          {dispensaSaving ? "Confirmando..." : "Confirmar dispensa"}
        </button>
        </div>
          {dispensaError && <p className="mt-2 text-xs text-red-600">{dispensaError}</p>}
        </div>
      )}
      
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Historial de mediciones</h3>
        {measurements.length === 0 ? (
        <p className="text-sm text-gray-500">Aún no se han registrado mediciones para este residuo.</p>
        ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 uppercase text-gray-500">
        <tr>
        <th className="px-2 py-1.5">Fecha</th>
        <th className="px-2 py-1.5">Tipo</th>
        <th className="px-2 py-1.5">CPS</th>
        <th className="px-2 py-1.5">CPS fondo</th>
        <th className="px-2 py-1.5">Bq/cm²</th>
        <th className="px-2 py-1.5">µSv/h</th>
        <th className="px-2 py-1.5">Resultado</th>
        <th className="px-2 py-1.5">Usuario</th>
        </tr>
        </thead>
        <tbody>
          {measurements.map((m) => (
          <tr key={m.id} className="border-t border-gray-100">
          <td className="px-2 py-1.5">{m.fecha}</td>
          <td className="px-2 py-1.5">{WASTE_MEASUREMENT_TIPO_LABELS[m.tipo]}</td>
          <td className="px-2 py-1.5">{m.cps ?? "—"}</td>
          <td className="px-2 py-1.5">{m.cps_fondo ?? "—"}</td>
          <td className="px-2 py-1.5">{m.bq_cm2 !== null ? Number(m.bq_cm2).toFixed(2) : "—"}</td>
          <td className="px-2 py-1.5">{m.tasa_dosis_usv_h ?? "—"}</td>
          <td className="px-2 py-1.5">{m.resultado ?? "—"}</td>
          <td className="px-2 py-1.5">{m.usuario ?? "—"}</td>
          </tr>
          ))}
        </tbody>
        </table>
        </div>
      )}
      </div>
      
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Registrar nueva medición</h3>
      <div className="grid grid-cols-2 gap-3">
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de medición</label>
      <select
        value={medTipo}
        onChange={(e) => setMedTipo(e.target.value as WasteMeasurementTipo)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        >
      <option value="seguimiento">{WASTE_MEASUREMENT_TIPO_LABELS.seguimiento}</option>
      <option value="verificacion_final">{WASTE_MEASUREMENT_TIPO_LABELS.verificacion_final}</option>
      </select>
      </div>
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">Fecha</label>
      <input
        type="date"
        value={medFecha}
        onChange={(e) => setMedFecha(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">CPS medida</label>
      <input
        type="number"
        value={medCps}
        onChange={(e) => setMedCps(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">CPS de fondo</label>
      <input
        type="number"
        value={medCpsFondo}
        onChange={(e) => setMedCpsFondo(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
      Tasa de dosis µSv/h {medTipo === "verificacion_final" ? "(obligatoria)" : "(opcional)"}
      </label>
      <input
        type="number"
        value={medTasaDosis}
        onChange={(e) => setMedTasaDosis(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">Instrumento (opcional)</label>
      <input
        value={medInstrumento}
        onChange={(e) => setMedInstrumento(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">Usuario / OPR (opcional)</label>
      <input
        value={medUsuario}
        onChange={(e) => setMedUsuario(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-2">
      <label className="mb-1 block text-xs font-medium text-gray-600">Observaciones (opcional)</label>
      <input
        value={medObservaciones}
        onChange={(e) => setMedObservaciones(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
      </div>
      </div>
        {medError && <p className="mt-2 text-xs text-red-600">{medError}</p>}
        {medSuccess && <p className="mt-2 text-xs text-green-600">{medSuccess}</p>}
      <button
        onClick={handleAddMeasurement}
        disabled={medSaving}
        className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
        {medSaving ? "Guardando..." : "Registrar medición"}
      </button>
      </div>
      </div>
    )}
    
    
      {tab === "fotografias" && (
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Fotografías</h3>
      <p className="text-sm text-gray-500">
      No hay fotografías asociadas a este residuo. Esta sección queda preparada para integrarse con el
      módulo de Documentos cuando se habilite la carga de evidencia fotográfica.
      </p>
      </div>
    )}
    
      {tab === "historial" && (
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Historial del rótulo</h3>
        {history.length === 0 ? (
        <p className="text-sm text-gray-500">Sin movimientos registrados.</p>
        ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {history.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-2">
          <span className="font-medium text-gray-800">{h.action}</span>
          <span className="text-gray-500">{h.changed_by ?? "sistema"}</span>
          <span className="text-gray-400">{new Date(h.changed_at).toLocaleString("es-CL")}</span>
          </li>
          ))}
        </ul>
      )}
      </div>
    )}
    
      {tab === "estado" && (
      <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Estado del residuo</h3>
      <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600">Cambiar estado:</label>
      <select
        value={row.status}
        disabled={savingStatus}
        onChange={(e) => handleStatusChange(e.target.value as WasteLabelStatus)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
        {WASTE_LABEL_STATUS.map((s) => (
          <option key={s} value={s}>
            {WASTE_LABEL_STATUS_LABELS[s]}
          </option>
          ))}
      </select>
      </div>
      <p className="mt-3 text-xs text-gray-400">
      Estado de dispensa: {dispensa_estado_label} · Impresiones: {row.print_count}
        {row.last_printed_at ? ` · Última impresión: ${new Date(row.last_printed_at).toLocaleString("es-CL")}` : ""}
      </p>
      </div>
    )}
    </div>
    </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
    <dt className="text-[11px] uppercase text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900">{value}</dd>
    </div>
    );
}

function RadiationSymbol() {
  return (
    <svg viewBox="0 0 100 100" className="h-10 w-10 flex-shrink-0" aria-label="Símbolo internacional de radiación">
    <circle cx="50" cy="50" r="48" fill="#fbbf24" stroke="#000" strokeWidth="2" />
    <circle cx="50" cy="50" r="8" fill="#000" />
      {[0, 120, 240].map((angle) => (
      <path
        key={angle}
        d="M50 50 L50 14 A36 36 0 0 1 81.1 32 Z"
        fill="#000"
        transform={`rotate(${angle} 50 50)`}
        />
      ))}
    </svg>
    );
}
