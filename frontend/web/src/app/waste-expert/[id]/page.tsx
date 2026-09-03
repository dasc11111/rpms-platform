import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";
import { activityAtElapsed, construirExplicacion } from "@/lib/waste-expert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Feedback";
import { WasteExpertMeasurementModal } from "@/components/waste-expert/waste-expert-measurement-modal";
import { WasteExpertAuthorizeModal } from "@/components/waste-expert/waste-expert-authorize-modal";
import {
  WASTE_ITEM_ESTADO_META,
  tipoResiduoLabel,
  tipoMedicionLabel,
  areaTipoLabel,
  decisionMetrologicaLabel,
  cumpleCriterioLabel,
  fmtDate,
  fmtDateTime,
  fmtNumber,
} from "@/lib/waste-expert-ui";

export const dynamic = "force-dynamic";

// Fase D - Ficha individual de un residuo radiactivo (Secciones 2, 10, 39-42
// del Prompt Maestro Definitivo). Cada residuo es una entidad independiente,
// totalmente trazable: registro -> mediciones -> historial de estados ->
// correcciones -> autorizaciones.
export default async function WasteExpertItemPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureWasteExpertSchema();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return notFound();

  const { rows: itemRows } = await sql`
    SELECT wi.*, rn.half_life_days, rn.name AS radionuclide_name, rn.symbol AS radionuclide_symbol
    FROM waste_items wi
    LEFT JOIN radionuclides rn ON rn.code = wi.radionuclide_code
    WHERE wi.id = ${id}
  `;
  const item: any = itemRows[0];
  if (!item) return notFound();

  const { rows: measurements } = await sql`
    SELECT m.*, c.valor AS criterio_valor, c.unidad AS criterio_unidad, c.documento_fuente AS criterio_documento_fuente
    FROM waste_item_measurements m
    LEFT JOIN waste_contamination_criteria c ON c.id = m.criterio_aplicado_id
    WHERE m.waste_item_id = ${id}
    ORDER BY m.fecha DESC, m.id DESC
  `;
  const { rows: statusHistory } = await sql`
    SELECT * FROM waste_item_status_history WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
  `;
  const { rows: authorizations } = await sql`
    SELECT * FROM waste_item_authorizations WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
  `;
  const { rows: corrections } = await sql`
    SELECT * FROM waste_item_corrections WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
  `;

  const ultima: any = measurements[0];
  const explicacion = construirExplicacion({
    itemCode: item.item_code,
    estado: item.estado,
    radionuclideCode: item.radionuclide_code,
    ultimaBqCm2: ultima?.actividad_bq_cm2 ?? null,
    criterioBqCm2: ultima?.criterio_valor ?? null,
    ultimaMedicionValida: ultima ? Boolean(ultima.cumple_criterio !== null) : null,
    fechaTeoricaProximaEvaluacion: item.fecha_teorica_cumplimiento ?? null,
  });

  let prediccionActual: number | null = null;
  if (item.actividad_inicial !== null && item.half_life_days && item.fecha_hora_generacion) {
    const elapsedDays = (Date.now() - new Date(item.fecha_hora_generacion).getTime()) / 86400000;
    prediccionActual = activityAtElapsed(Number(item.actividad_inicial), Number(item.half_life_days), elapsedDays);
  }

  const meta = WASTE_ITEM_ESTADO_META[item.estado as keyof typeof WASTE_ITEM_ESTADO_META];

  const fichaFields: { label: string; value: string | null }[] = [
    { label: "Radionúclido", value: `${item.radionuclide_symbol || item.radionuclide_code} — ${item.radionuclide_name ?? ""}` },
    { label: "Tipo de residuo", value: tipoResiduoLabel(item.tipo_residuo) + (item.tipo_residuo_otro ? ` (${item.tipo_residuo_otro})` : "") },
    { label: "Fecha de generación", value: fmtDateTime(item.fecha_hora_generacion) },
    { label: "Actividad inicial", value: item.actividad_inicial != null ? `${fmtNumber(item.actividad_inicial)} ${item.unidad_actividad ?? ""}` : "—" },
    { label: "Masa (g)", value: item.masa_g != null ? fmtNumber(item.masa_g) : "—" },
    { label: "Volumen (ml)", value: item.volumen_ml != null ? fmtNumber(item.volumen_ml) : "—" },
    { label: "Superficie estimada (cm²)", value: item.superficie_estimada_cm2 != null ? fmtNumber(item.superficie_estimada_cm2) : "—" },
    { label: "Ubicación", value: item.ubicacion ?? "—" },
    { label: "Contenedor", value: item.contenedor ?? "—" },
    { label: "Área de almacenamiento", value: item.area_almacenamiento ?? "—" },
    { label: "Responsable", value: item.responsable ?? "—" },
    { label: "Fecha teórica de cumplimiento", value: fmtDateTime(item.fecha_teorica_cumplimiento) },
    { label: "Fecha de verificación", value: fmtDate(item.fecha_verificacion) },
    { label: "Fecha de liberación autorizada", value: fmtDate(item.fecha_liberacion_autorizada) },
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-6">
      <Link href="/waste-expert" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />
        Sistema Experto de Gestión de Desechos Radiactivos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight">{item.item_code}</h1>
          <p className="text-xs text-muted-foreground">
            {tipoResiduoLabel(item.tipo_residuo)} · {item.radionuclide_symbol || item.radionuclide_code}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={meta ? meta.label : item.estado} level={meta?.level} />
          <WasteExpertMeasurementModal wasteItemId={item.id} radionuclideCode={item.radionuclide_code} />
          <WasteExpertAuthorizeModal wasteItemId={item.id} estado={item.estado} />
        </div>
      </div>

      <Alert tone="info" title="Explicación del estado actual (motor de explicación, sección 42)">
        {explicacion}
      </Alert>

      {prediccionActual !== null ? (
        <Alert tone="warning" title="Predicción matemática de decaimiento (Motor 1 — nunca implica liberación automática)">
          Actividad teórica estimada al día de hoy por decaimiento físico: {fmtNumber(prediccionActual)} {item.unidad_actividad}. Este valor
          es una proyección matemática (sección 12) y no reemplaza una medición real.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ficha técnica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {fichaFields.map((f) => (
              <div key={f.label} className="flex justify-between border-b border-border/60 pb-1">
                <span className="text-muted-foreground">{f.label}</span>
                <span>{f.value || "—"}</span>
              </div>
            ))}
          </div>
          {item.descripcion ? (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Descripción: </span>
              {item.descripcion}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mediciones registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {measurements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="px-2 py-1.5">Instrumento</th>
                    <th className="px-2 py-1.5">cps neto</th>
                    <th className="px-2 py-1.5">Actividad (Bq)</th>
                    <th className="px-2 py-1.5">Bq/cm²</th>
                    <th className="px-2 py-1.5">Área</th>
                    <th className="px-2 py-1.5">µSv/h neto</th>
                    <th className="px-2 py-1.5">Resultado metrológico</th>
                    <th className="px-2 py-1.5">Criterio</th>
                    <th className="px-2 py-1.5">Cumple</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(measurements as any[]).map((m) => (
                    <tr key={m.id}>
                      <td className="px-2 py-1.5">{fmtDate(m.fecha)}{m.hora ? ` ${String(m.hora).slice(0, 5)}` : ""}</td>
                      <td className="px-2 py-1.5">{tipoMedicionLabel(m.tipo_medicion)}</td>
                      <td className="px-2 py-1.5">{m.instrumento ?? "—"}</td>
                      <td className="px-2 py-1.5">{m.cps_neto != null ? fmtNumber(m.cps_neto) : "—"}</td>
                      <td className="px-2 py-1.5">{m.actividad_bq != null ? fmtNumber(m.actividad_bq) : "—"}</td>
                      <td className="px-2 py-1.5">{m.actividad_bq_cm2 != null ? fmtNumber(m.actividad_bq_cm2) : "—"}</td>
                      <td className="px-2 py-1.5">{areaTipoLabel(m.area_tipo)}</td>
                      <td className="px-2 py-1.5">{m.tasa_dosis_neta_usv_h != null ? fmtNumber(m.tasa_dosis_neta_usv_h) : "—"}</td>
                      <td className="px-2 py-1.5">{decisionMetrologicaLabel(m.resultado_metrologico)}</td>
                      <td className="px-2 py-1.5">{m.criterio_valor != null ? `${fmtNumber(m.criterio_valor)} ${m.criterio_unidad ?? ""}` : "—"}</td>
                      <td className="px-2 py-1.5">{cumpleCriterioLabel(m.cumple_criterio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin mediciones registradas todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de estados</CardTitle>
        </CardHeader>
        <CardContent>
          {statusHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Estado anterior</th>
                    <th className="px-2 py-1.5">Estado nuevo</th>
                    <th className="px-2 py-1.5">Motivo</th>
                    <th className="px-2 py-1.5">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(statusHistory as any[]).map((h) => (
                    <tr key={h.id}>
                      <td className="px-2 py-1.5">{fmtDateTime(h.fecha)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{h.estado_anterior ?? "—"}</td>
                      <td className="px-2 py-1.5">{h.estado_nuevo}</td>
                      <td className="px-2 py-1.5">{h.motivo ?? "—"}</td>
                      <td className="px-2 py-1.5">{h.usuario ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin cambios de estado registrados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autorizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {authorizations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="px-2 py-1.5">Autorizado por</th>
                    <th className="px-2 py-1.5">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(authorizations as any[]).map((a) => (
                    <tr key={a.id}>
                      <td className="px-2 py-1.5">{fmtDateTime(a.fecha)}</td>
                      <td className="px-2 py-1.5">{a.tipo}</td>
                      <td className="px-2 py-1.5">{a.autorizado_por}</td>
                      <td className="px-2 py-1.5">{a.observaciones ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin autorizaciones registradas. La liberación requiere una autorización explícita.</p>
          )}
        </CardContent>
      </Card>

      {corrections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Correcciones de datos (auditoría)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Campo</th>
                    <th className="px-2 py-1.5">Valor anterior</th>
                    <th className="px-2 py-1.5">Valor nuevo</th>
                    <th className="px-2 py-1.5">Motivo</th>
                    <th className="px-2 py-1.5">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(corrections as any[]).map((c) => (
                    <tr key={c.id}>
                      <td className="px-2 py-1.5">{fmtDateTime(c.fecha)}</td>
                      <td className="px-2 py-1.5">{c.campo}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.valor_anterior ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.valor_nuevo ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.motivo ?? "—"}</td>
                      <td className="px-2 py-1.5">{c.usuario ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
