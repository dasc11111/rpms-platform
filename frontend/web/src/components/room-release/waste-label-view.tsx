"use client";

import { useEffect, useState, useCallback } from "react";
import {
  WasteLabel,
  WasteLabelHistoryEntry,
  RoomReleaseRecord,
  WASTE_LABEL_STATUS,
  WASTE_LABEL_STATUS_LABELS,
  WasteLabelStatus,
  formatActividad,
} from "@/lib/waste";

type ApiResponse = {
  row: WasteLabel;
  history: WasteLabelHistoryEntry[];
  roomRelease: RoomReleaseRecord | null;
};

type TabKey = "rotulo" | "acta" | "resultados" | "fotografias" | "historial" | "estado";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rotulo", label: "Rótulo" },
  { key: "acta", label: "Acta" },
  { key: "resultados", label: "Resultados" },
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
        ["Radionúclido", row.radionuclide_code],
        ["Servicio", row.service],
        ["Sala", row.sala],
        ["N° de habitación", row.room_number ?? "—"],
        ["Paciente", row.paciente_nombre ?? "—"],
        ["Actividad estimada residual", formatActividad(row.actividad_estimada_residual, row.unidad_actividad)],
        ["Tipo de residuo", row.waste_type ?? "—"],
        ["Clasificación", row.waste_classification ?? "—"],
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

  const { row, history, roomRelease } = data;

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
              <Field
                label="Actividad estimada residual"
                value={formatActividad(row.actividad_estimada_residual, row.unidad_actividad)}
              />
              <Field label="Tipo de residuo" value={row.waste_type ?? "—"} />
              <Field label="Clasificación" value={row.waste_classification ?? "—"} />
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
        )}

        {tab === "acta" && (
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Acta de Liberación de Sala</h3>
            {!roomRelease ? (
              <p className="text-sm text-gray-500">No se encontró el acta asociada.</p>
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
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Resultados de la liberación</h3>
            {!roomRelease ? (
              <p className="text-sm text-gray-500">No hay resultados disponibles.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <Field
                  label="Actividad medida al momento de la liberación"
                  value={formatActividad(roomRelease.actividad_medida_liberacion, roomRelease.unidad_actividad)}
                />
                <Field label="Tasa de dosis medida" value={roomRelease.tasa_dosis_medida ?? "—"} />
                <Field label="Criterio de liberación aplicado" value={roomRelease.criterio_liberacion ?? "—"} />
                <Field
                  label="Actividad estimada residual del residuo"
                  value={formatActividad(row.actividad_estimada_residual, row.unidad_actividad)}
                />
              </dl>
            )}
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
              Impresiones: {row.print_count}
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
