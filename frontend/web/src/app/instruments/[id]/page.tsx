import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { sql } from "@/lib/db";
import {
  INSTRUMENT_STATUS_LABELS,
  CALIBRATION_ALERT_LABELS,
  CALIBRATION_ALERT_COLORS,
  getCalibrationAlertLevel,
  FAILURE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
  formatBytes,
} from "@/lib/instruments";
import { cn } from "@/lib/utils";
import { InstrumentEditModal } from "@/components/instruments/instrument-edit-modal";

export const dynamic = "force-dynamic";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return String(value).slice(0, 16).replace("T", " ");
}

export default async function InstrumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return notFound();

  const { rows: instrumentRows } = await sql`
    SELECT i.*, t.name AS type_name
    FROM instruments i
    LEFT JOIN instrument_types t ON t.id = i.type_id
    WHERE i.id = ${id}
  `;
  const instrument: any = instrumentRows[0];
  if (!instrument) return notFound();

  const { rows: calibrations } = await sql`
    SELECT c.*, COALESCE(c.company_name, cc.name) AS company_name_resolved
    FROM calibrations c
    LEFT JOIN calibration_companies cc ON cc.id = c.company_id
    WHERE c.instrument_id = ${id}
    ORDER BY c.calibration_date DESC, c.id DESC
  `;

  const { rows: failures } = await sql`
    SELECT * FROM instrument_failures WHERE instrument_id = ${id} ORDER BY failure_date DESC, id DESC
  `;

  const { rows: maintenances } = await sql`
    SELECT * FROM instrument_maintenances WHERE instrument_id = ${id} ORDER BY maintenance_date DESC, id DESC
  `;

  const { rows: history } = await sql`
    SELECT * FROM instrument_history WHERE instrument_id = ${id} ORDER BY changed_at DESC, id DESC
  `;

  const calibrationIds = calibrations.map((c: any) => c.id as number);
  const failureIds = failures.map((f: any) => f.id as number);
  const maintenanceIds = maintenances.map((m: any) => m.id as number);

  const { rows: documents } = await sql.query(
    `SELECT * FROM instrument_documents
     WHERE (owner_type = 'instrument' AND owner_id = $1)
        OR (owner_type = 'calibration' AND owner_id = ANY($2))
        OR (owner_type = 'failure' AND owner_id = ANY($3))
        OR (owner_type = 'maintenance' AND owner_id = ANY($4))
     ORDER BY created_at DESC`,
    [id, calibrationIds.length ? calibrationIds : [0], failureIds.length ? failureIds : [0], maintenanceIds.length ? maintenanceIds : [0]]
  );

  const lastCalibration: any = calibrations[0];
  const alert = getCalibrationAlertLevel(lastCalibration?.expiry_date ?? null);

  const techFields: { label: string; value: string | null | undefined }[] = [
    { label: "Marca", value: instrument.brand },
    { label: "Modelo", value: instrument.model },
    { label: "Número de serie", value: instrument.serial_number },
    { label: "Fabricante", value: instrument.manufacturer },
    { label: "Servicio", value: instrument.service },
    { label: "Unidad", value: instrument.unit },
    { label: "Ubicación", value: instrument.location },
    { label: "Fecha de adquisición", value: fmtDate(instrument.acquisition_date) },
    { label: "Proveedor", value: instrument.provider },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <Link href="/instruments" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Instrumentos
      </Link>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{instrument.name}</h1>
        <InstrumentEditModal instrument={instrument} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {instrument.code} · {instrument.type_name ?? "Sin tipo"} · {INSTRUMENT_STATUS_LABELS[instrument.status as keyof typeof INSTRUMENT_STATUS_LABELS]}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", CALIBRATION_ALERT_COLORS[alert.level])}>
          {CALIBRATION_ALERT_LABELS[alert.level]}
          {alert.daysRemaining !== null && alert.level !== "vencida" ? ` · ${alert.daysRemaining} días` : ""}
        </span>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Ficha técnica</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {techFields.map((f) => (
            <div key={f.label} className="flex justify-between border-b border-border/60 pb-1">
              <span className="text-muted-foreground">{f.label}</span>
              <span>{f.value || "—"}</span>
            </div>
          ))}
        </div>
        {instrument.notes && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Observaciones: </span>{instrument.notes}
          </p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Historial de calibraciones</h2>
        {calibrations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Fecha</th>
                  <th className="px-2 py-1.5">Vencimiento</th>
                  <th className="px-2 py-1.5">Estado</th>
                  <th className="px-2 py-1.5">Empresa</th>
                  <th className="px-2 py-1.5">N° certificado</th>
                  <th className="px-2 py-1.5">Magnitud</th>
                  <th className="px-2 py-1.5">Factor</th>
                  <th className="px-2 py-1.5">Método</th>
                  <th className="px-2 py-1.5">Patrón utilizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {calibrations.map((c: any) => {
                  const a = getCalibrationAlertLevel(c.expiry_date);
                  return (
                    <tr key={c.id}>
                      <td className="px-2 py-1.5">{fmtDate(c.calibration_date)}</td>
                      <td className="px-2 py-1.5">{fmtDate(c.expiry_date)}</td>
                      <td className="px-2 py-1.5">
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", CALIBRATION_ALERT_COLORS[a.level])}>
                          {CALIBRATION_ALERT_LABELS[a.level]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{c.company_name_resolved ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{c.certificate_number ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.magnitude ?? "—"}{c.units ? ` (${c.units})` : ""}</td>
                      <td className="px-2 py-1.5">{c.calibration_factor ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.method ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.standard_used ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin calibraciones registradas.</p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Fallas registradas</h2>
        {failures.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Fecha</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  <th className="px-2 py-1.5">Descripción</th>
                  <th className="px-2 py-1.5">Diagnóstico</th>
                  <th className="px-2 py-1.5">Acción correctiva</th>
                  <th className="px-2 py-1.5">Responsable</th>
                  <th className="px-2 py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {failures.map((f: any) => (
                  <tr key={f.id}>
                    <td className="px-2 py-1.5">{fmtDate(f.failure_date)}</td>
                    <td className="px-2 py-1.5">{f.failure_type ?? "—"}</td>
                    <td className="px-2 py-1.5">{f.description}</td>
                    <td className="px-2 py-1.5">{f.diagnosis ?? "—"}</td>
                    <td className="px-2 py-1.5">{f.corrective_action ?? "—"}</td>
                    <td className="px-2 py-1.5">{f.responsible ?? "—"}</td>
                    <td className="px-2 py-1.5">{FAILURE_STATUS_LABELS[f.status as keyof typeof FAILURE_STATUS_LABELS] ?? f.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin fallas registradas.</p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Mantenimientos</h2>
        {maintenances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Fecha</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  <th className="px-2 py-1.5">Empresa</th>
                  <th className="px-2 py-1.5">Responsable</th>
                  <th className="px-2 py-1.5">Costo</th>
                  <th className="px-2 py-1.5">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {maintenances.map((m: any) => (
                  <tr key={m.id}>
                    <td className="px-2 py-1.5">{fmtDate(m.maintenance_date)}</td>
                    <td className="px-2 py-1.5">{MAINTENANCE_TYPE_LABELS[m.maintenance_type as keyof typeof MAINTENANCE_TYPE_LABELS] ?? m.maintenance_type}</td>
                    <td className="px-2 py-1.5">{m.company ?? "—"}</td>
                    <td className="px-2 py-1.5">{m.responsible ?? "—"}</td>
                    <td className="px-2 py-1.5">{m.cost != null ? `$${Number(m.cost).toLocaleString("es-CL")}` : "—"}</td>
                    <td className="px-2 py-1.5">{m.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin mantenimientos registrados.</p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Documentos</h2>
        {documents.length > 0 ? (
          <ul className="space-y-1.5 text-xs">
            {(documents as any[]).map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <a href={d.blob_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-accent">
                  <FileText className="h-3.5 w-3.5" />
                  {d.original_name}
                </a>
                <span className="text-muted-foreground">{formatBytes(Number(d.size_bytes))} · {d.owner_type}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin documentos adjuntos.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Historial de auditoría</h2>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Fecha</th>
                  <th className="px-2 py-1.5">Usuario</th>
                  <th className="px-2 py-1.5">Campo</th>
                  <th className="px-2 py-1.5">Valor anterior</th>
                  <th className="px-2 py-1.5">Valor nuevo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(history as any[]).map((h) => (
                  <tr key={h.id}>
                    <td className="px-2 py-1.5">{fmtDateTime(h.changed_at)}</td>
                    <td className="px-2 py-1.5">{h.changed_by ?? "—"}</td>
                    <td className="px-2 py-1.5">{h.field_name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{h.old_value ?? "—"}</td>
                    <td className="px-2 py-1.5">{h.new_value ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
        )}
      </div>
    </div>
  );
}
