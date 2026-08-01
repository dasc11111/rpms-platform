import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, GraduationCap, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { formatMSv } from "@/lib/utils";
import { sql } from "@/lib/db";
import { StatusActionButton } from "@/components/workers/status-action-button";
import { WorkerEditModal } from "@/components/workers/worker-edit-modal";
import { buildAuthSummary, formatDaysRemaining, AUTH_STATUS_LABEL, SEMAPHORE_DOT_CLASS, SEMAPHORE_TEXT_CLASS } from "@/lib/authorization";
import { composeWorkerName } from "@/lib/worker-name";
import { cn } from "@/lib/utils";
import { computeDosimeterAlerts, ALERT_SEVERITY_LABEL, ALERT_SEVERITY_CLASS, type DosimeterAlertSeverity } from "@/lib/dosimeter-alerts";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = {
  normal: "Normal",
  registro: "Nivel de registro",
  investigacion: "Nivel de investigación",
  intervencion: "Nivel de intervención",
};

const LEVEL_CLASS: Record<string, string> = {
  normal: "text-muted-foreground",
  registro: "text-sky-600",
  investigacion: "text-warning",
  intervencion: "text-red-600 font-semibold",
};

const ALERT_ICON: Record<DosimeterAlertSeverity, any> = { alta: AlertCircle, media: AlertTriangle, baja: Info };

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound();
  const rut = decodeURIComponent(id);

  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_1 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_2 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS first_names TEXT`;

  const { rows: workerRows } = await sql`
    SELECT rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
      dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
      course_pr_completed, course_pr_date,
      authorization_number, authorization_issue_date, authorization_expiry_date, notes
    FROM workers
    WHERE rut = ${rut}
    LIMIT 1
  `;
  const worker: any = workerRows[0];
  if (!worker) return notFound();

  const rutDigits = (rut.split("-")[0] ?? "").replace(/[^0-9]/g, "");
  let quarterlyRows: any[] = [];
  try {
    const { rows } = await sql`
      SELECT year, quarter, period_label, dose_body, dose_lens, dose_skin,
        accum_year_body, accum_12m_body, accum_60m_body, accum_60m_lens, accum_60m_skin,
        level, institucion, departamento
      FROM dosimetry_quarterly
      WHERE regexp_replace(split_part(worker_rut, '-', 1), '[^0-9]', '', 'g') = ${rutDigits}
      ORDER BY year DESC, quarter DESC
    `;
    quarterlyRows = rows;
  } catch {
    quarterlyRows = [];
  }

  // Hoja 'Lista de devolucion': historial de devoluciones fisicas de este
  // trabajador, tal como quedan registradas por el laboratorio.
  let returnRows: any[] = [];
  try {
    const { rows } = await sql`
      SELECT dosimeter_code, unidad, period_label, estado, observaciones, registered_at
      FROM dosimetry_returns
      WHERE regexp_replace(split_part(worker_rut, '-', 1), '[^0-9]', '', 'g') = ${rutDigits}
      ORDER BY registered_at DESC
    `;
    returnRows = rows;
  } catch {
    returnRows = [];
  }

  const workerAlerts = await computeDosimeterAlerts(rut);

  // Fase 5 - Analisis individual: evolucion anual (a partir del acumulado del
  // ultimo trimestre informado de cada ano) y comparacion contra el promedio
  // de su servicio y el promedio institucional en el ultimo periodo informado.
  const annualMap = new Map<number, number>();
  for (const r of quarterlyRows) {
    if (!annualMap.has(r.year)) annualMap.set(r.year, Number(r.accum_year_body) || 0);
  }
  const annualEvolution = Array.from(annualMap.entries())
    .map(([year, accum]) => ({ year, accum }))
    .sort((a, b) => a.year - b.year);

  const quarterlyAsc = [...quarterlyRows].reverse();
  const latestQuarter = quarterlyRows[0] ?? null;

  let serviceAvgDose: number | null = null;
  let institutionalAvgDose: number | null = null;
  if (latestQuarter && worker.service) {
    try {
      const { rows: svcRows } = await sql`
        SELECT AVG(q.dose_body)::float as avg_dose
        FROM dosimetry_quarterly q
        JOIN workers w ON w.rut = q.worker_rut
        WHERE q.year = ${latestQuarter.year} AND q.quarter = ${latestQuarter.quarter} AND w.service = ${worker.service}
      `;
      serviceAvgDose = svcRows[0]?.avg_dose ?? null;
    } catch {
      serviceAvgDose = null;
    }
    try {
      const { rows: instRows } = await sql`
        SELECT AVG(dose_body)::float as avg_dose
        FROM dosimetry_quarterly
        WHERE year = ${latestQuarter.year} AND quarter = ${latestQuarter.quarter}
      `;
      institutionalAvgDose = instRows[0]?.avg_dose ?? null;
    } catch {
      institutionalAvgDose = null;
    }
  }

  const annualDose = Number(worker.annual_dose);
  const isActive = worker.status !== "inactive";
  const auth = buildAuthSummary(worker);
  const displayName = composeWorkerName(worker);

  const contactFields: { label: string; value: string | null }[] = [
    { label: "Sexo", value: worker.sex },
    { label: "Fecha nacimiento", value: worker.birth_date },
    { label: "Teléfono", value: worker.phone },
    { label: "Correo", value: worker.email },
    { label: "Dirección", value: worker.address },
    { label: "Estamento", value: worker.estamento },
    { label: "Calidad contractual", value: worker.contract_type },
    { label: "Unidad", value: worker.unit },
  ].filter((f) => f.value);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <Link href="/workers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Trabajadores
      </Link>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{displayName}</h1>
        <div className="flex items-center gap-2">
          <WorkerEditModal worker={worker} />
          <StatusActionButton rut={worker.rut} active={isActive} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{worker.role} · {worker.service} · Categoría {worker.category} (ICRP)</p>

      {!isActive && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Este trabajador está dado de baja. Sus datos se conservan y puede reactivarse en cualquier momento.
        </div>
      )}

      {workerAlerts.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Alertas dosimétricas</h2>
          <div className="flex flex-col gap-2">
            {workerAlerts.map((a) => {
              const Icon = ALERT_ICON[a.severity];
              return (
                <div key={a.id} className="flex items-start gap-2.5 rounded-md border border-border p-2.5">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", ALERT_SEVERITY_CLASS[a.severity])}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">{a.description}</span>
                  </div>
                  <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", ALERT_SEVERITY_CLASS[a.severity])}>
                    {ALERT_SEVERITY_LABEL[a.severity]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contactFields.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Datos de contacto</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {contactFields.map((f) => (
              <div key={f.label} className="flex justify-between border-b border-border/60 pb-1">
                <span className="text-muted-foreground">{f.label}</span>
                <span>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Curso PR y Autorización de Desempeño</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">Curso de Protección Radiológica</span>
            <span className="flex items-center gap-1">
              {worker.course_pr_completed ? (
                <>
                  <GraduationCap className="h-3.5 w-3.5 text-success" /> Completado{worker.course_pr_date ? ` (${worker.course_pr_date})` : ""}
                </>
              ) : (
                "No registrado"
              )}
            </span>
          </div>
          <div className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">N° de autorización</span>
            <span>{worker.authorization_number || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">Fecha emisión</span>
            <span>{worker.authorization_issue_date || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">Fecha vencimiento</span>
            <span>{worker.authorization_expiry_date || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">Días restantes</span>
            <span className={cn("flex items-center gap-1.5 font-medium", SEMAPHORE_TEXT_CLASS[auth.semaphore])}>
              <span className={cn("h-1.5 w-1.5 rounded-full", SEMAPHORE_DOT_CLASS[auth.semaphore])} />
              {formatDaysRemaining(auth.days)}
            </span>
          </div>
          <div className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">Estado</span>
            <span>{AUTH_STATUS_LABEL[auth.status]}</span>
          </div>
        </div>
        {worker.notes && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Observaciones: </span>{worker.notes}
          </p>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Dosimetría trimestral (Hp10 / Hp3 / Hp0,07)</h2>
        {quarterlyRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Periodo</th>
                  <th className="px-2 py-1.5">Institución</th>
                  <th className="px-2 py-1.5 text-right">Hp(10)</th>
                  <th className="px-2 py-1.5 text-right">Hp(3)</th>
                  <th className="px-2 py-1.5 text-right">Hp(0,07)</th>
                  <th className="px-2 py-1.5 text-right">Acum. año</th>
                  <th className="px-2 py-1.5 text-right">Acum. 12m</th>
                  <th className="px-2 py-1.5 text-right">Acum. 60m</th>
                  <th className="px-2 py-1.5">Nivel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quarterlyRows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 font-medium">{r.period_label}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.institucion || "—"}</td>
                    <td className="px-2 py-1.5 text-right">{formatMSv(Number(r.dose_body))}</td>
                    <td className="px-2 py-1.5 text-right">{formatMSv(Number(r.dose_lens))}</td>
                    <td className="px-2 py-1.5 text-right">{formatMSv(Number(r.dose_skin))}</td>
                    <td className="px-2 py-1.5 text-right">{formatMSv(Number(r.accum_year_body))}</td>
                    <td className="px-2 py-1.5 text-right">{formatMSv(Number(r.accum_12m_body))}</td>
                    <td className="px-2 py-1.5 text-right">{formatMSv(Number(r.accum_60m_body))}</td>
                    <td className={cn("px-2 py-1.5", LEVEL_CLASS[r.level] || "")}>{LEVEL_LABEL[r.level] || r.level || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin registros trimestrales de dosimetría vinculados a este RUT.</p>
        )}
      </div>

      {quarterlyRows.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Análisis individual</h2>

          <p className="mb-1 text-xs font-medium text-muted-foreground">Evolución trimestral (Hp10)</p>
          <div className="mb-4 flex h-16 items-end gap-1">
            {quarterlyAsc.map((r, i) => {
              const v = Number(r.dose_body);
              const maxQ = Math.max(...quarterlyAsc.map((x) => Number(x.dose_body)), 0.01);
              const h = (v / maxQ) * 80 + 20;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-accent-subtle hover:bg-accent"
                  style={{ height: `${h}%` }}
                  title={`${r.period_label}: ${v.toFixed(2)} mSv`}
                />
              );
            })}
          </div>

          {annualEvolution.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Evolución anual (dosis acumulada cuerpo entero)</p>
              <div className="mb-4 flex h-16 items-end gap-2">
                {annualEvolution.map((r, i) => {
                  const maxY = Math.max(...annualEvolution.map((x) => x.accum), 0.01);
                  const h = (r.accum / maxY) * 80 + 20;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-accent-subtle hover:bg-accent"
                        style={{ height: `${h}%` }}
                        title={`${r.year}: ${r.accum.toFixed(2)} mSv`}
                      />
                      <span className="text-[10px] text-muted-foreground">{r.year}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {latestQuarter && (
            <>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Comparación en {latestQuarter.period_label} (Hp10)
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Este trabajador</span>
                  <span className="font-medium">{formatMSv(Number(latestQuarter.dose_body))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Promedio de su servicio ({worker.service || "—"})</span>
                  <span className="font-medium">{serviceAvgDose !== null ? formatMSv(serviceAvgDose) : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Promedio institucional</span>
                  <span className="font-medium">{institutionalAvgDose !== null ? formatMSv(institutionalAvgDose) : "—"}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-1">Historial de devoluciones (hoja \"Lista de devolución\")</h2>
        {Number.isFinite(annualDose) && annualDose > 0 && (
          <p className="mb-2 text-xs text-muted-foreground">Dosis anual acumulada (registro manual): {formatMSv(annualDose)}</p>
        )}
        {returnRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Fecha</th>
                  <th className="px-2 py-1.5">Dosímetro</th>
                  <th className="px-2 py-1.5">Unidad</th>
                  <th className="px-2 py-1.5">Periodo</th>
                  <th className="px-2 py-1.5">Estado</th>
                  <th className="px-2 py-1.5">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {returnRows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 text-muted-foreground">{new Date(r.registered_at).toLocaleDateString("es-CL")}</td>
                    <td className="px-2 py-1.5 font-medium">{r.dosimeter_code}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.unidad || "—"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.period_label || "—"}</td>
                    <td className="px-2 py-1.5">{r.estado}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.observaciones || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin devoluciones registradas para este trabajador.</p>
        )}
      </div>
    </div>
  );
}
