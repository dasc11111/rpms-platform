import type { ComponentType } from "react";
import { sql } from "@/lib/db";
import { KPICard } from "@/components/dashboard/kpi-card";
import { CheckCircle, XCircle, Clock, Activity, Zap, Radio } from "lucide-react";

export const dynamic = "force-dynamic";

interface QCRecord {
  id: number;
  equipment_id: string;
  equipment_name: string;
  qc_type: string;
  performed_at: string;
  performed_by: string;
  result: string;
  pass: boolean;
  notes: string | null;
  next_due_at: string | null;
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  tests: { label: string; frequency: string; tolerance: string }[];
}

const EQUIPMENT_CATALOG: Equipment[] = [
  {
    id: "captus3000",
    name: "Tiroidímetro Captus 3000",
    model: "Captus 3000 (Capintec)",
    tests: [
      { label: "Background / Fondo", frequency: "Diaria", tolerance: "< 500 cpm" },
      { label: "Eficiencia con fuente Cs-137", frequency: "Diaria", tolerance: "±10% del valor referencia" },
      { label: "Linealidad de energía", frequency: "Mensual", tolerance: "±5% energía fotopico" },
      { label: "Resolución energética (FWHM)", frequency: "Mensual", tolerance: "< 12% a 662 keV" },
      { label: "Estabilidad a largo plazo", frequency: "Anual", tolerance: "±5% eficiencia base" },
    ],
  },
  {
    id: "atomlab500",
    name: "Calibrador de Dosis Atomlab 500",
    model: "Atomlab 500 (Biodex)",
    tests: [
      { label: "Background / Fondo", frequency: "Diaria", tolerance: "< 10 μCi" },
      { label: "Exactitud con fuente traceable (Cs-137 o Co-57)", frequency: "Diaria", tolerance: "±5% valor certificado" },
      { label: "Reproducibilidad (5 mediciones)", frequency: "Diaria", tolerance: "CV < 2%" },
      { label: "Linealidad de respuesta", frequency: "Trimestral", tolerance: "±5% en rango 10 μCi – 1 Ci" },
      { label: "Geometría de medición", frequency: "Semestral", tolerance: "±5% distintas posiciones" },
      { label: "Calibración con fuente NIST", frequency: "Anual", tolerance: "±5% certificado" },
    ],
  },
  {
    id: "gammacamara",
    name: "Gamma Cámara SPECT/CT",
    model: "SPECT/CT (Siemens/GE/Philips)",
    tests: [
      { label: "Uniformidad intrínseca (FWHM)", frequency: "Diaria", tolerance: "< 3% UFOV, < 3.5% CFOV" },
      { label: "Sensibilidad del sistema", frequency: "Semanal", tolerance: "±5% del valor referencia" },
      { label: "Resolución espacial intrínseca", frequency: "Semanal", tolerance: "FWHM < 4 mm" },
      { label: "Linealidad espacial", frequency: "Mensual", tolerance: "< 2 mm UFOV" },
      { label: "Uniformidad extrínseca (con colimador)", frequency: "Semanal", tolerance: "< 5% UFOV" },
      { label: "Sensibilidad planar (SPECT)", frequency: "Mensual", tolerance: "±5% referencia" },
      { label: "Aceptación geométrica multi-cabezal", frequency: "Semestral", tolerance: "< 2 mm desalineación" },
      { label: "Calibración CT (HU agua, aire)", frequency: "Mensual", tolerance: "±10 HU agua, -1000±10 HU aire" },
    ],
  },
];

function qcTypeLabel(type: string): string {
  const map: Record<string, string> = {
    daily: "Diaria",
    weekly: "Semanal",
    monthly: "Mensual",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    annual: "Anual",
  };
  return map[type] ?? type;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function QualityControlPage() {
  let records: QCRecord[] = [];
  let totalTests = 0;
  let passCount = 0;
  let failCount = 0;
  let overdueCount = 0;

  try {
    const r = await sql`
      SELECT id, equipment_id, equipment_name, qc_type, performed_at::text,
             performed_by, result, pass, notes, next_due_at::text
      FROM qc_records
      ORDER BY performed_at DESC
      LIMIT 100
    `;
    records = r.rows as QCRecord[];
    totalTests = records.length;
    passCount = records.filter((x) => x.pass).length;
    failCount = records.filter((x) => !x.pass).length;
    overdueCount = records.filter(
      (x) => x.next_due_at && daysUntil(x.next_due_at)! < 0
    ).length;
  } catch {
    // tabla no existe aún
  }

  const passRate = totalTests > 0 ? Math.round((passCount / totalTests) * 100) : null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Control de Calidad — Medicina Nuclear</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Programas de CC según IAEA Safety Reports Series No. 6, NCRP 182 y protocolos de fabricante.
          Reglamentación: DS 133/1984 MINSAL, NS-06.0 §14 CCHEN.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Total Pruebas"
          value={totalTests}
          href="/quality-control"
          icon={Activity}
          tone="default"
        />
        <KPICard
          label="Aprobadas"
          value={passCount}
          href="/quality-control"
          icon={CheckCircle}
          hint={passRate !== null ? `${passRate}%` : undefined}
          tone={passRate !== null && passRate >= 95 ? "success" : passRate !== null && passRate >= 85 ? "warning" : "danger"}
        />
        <KPICard
          label="Fallidas"
          value={failCount}
          href="/quality-control"
          icon={XCircle}
          tone={failCount === 0 ? "default" : "danger"}
        />
        <KPICard
          label="Vencidas"
          value={overdueCount}
          href="/quality-control"
          icon={Clock}
          tone={overdueCount === 0 ? "default" : "warning"}
        />
      </div>

      {/* Alertas */}
      {failCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>⚠ {failCount} prueba{failCount > 1 ? "s" : ""} fallida{failCount > 1 ? "s" : ""}.</strong>{" "}
          Revisar equipo y registrar acción correctiva. No usar equipo hasta resolver.
        </div>
      )}

      {/* Equipos y protocolos */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Protocolos por Equipo</h2>
        {EQUIPMENT_CATALOG.map((eq) => {
          const eqRecords = records.filter((r) => r.equipment_id === eq.id);
          const eqFails = eqRecords.filter((r) => !r.pass).length;
          const lastRecord = eqRecords[0];

          const iconMap: Record<string, ComponentType<{ className?: string }>> = {
            captus3000: Zap,
            atomlab500: Activity,
            gammacamara: Radio,
          };
          const Icon = iconMap[eq.id] ?? Activity;

          return (
            <div key={eq.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{eq.name}</h3>
                    <p className="text-xs text-muted-foreground">{eq.model}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {lastRecord ? (
                    <>
                      <div>Último CC: {new Date(lastRecord.performed_at).toLocaleDateString("es-CL")}</div>
                      {lastRecord.next_due_at && (
                        <div className={daysUntil(lastRecord.next_due_at)! < 0 ? "text-red-600 font-medium" : daysUntil(lastRecord.next_due_at)! <= 3 ? "text-amber-600" : ""}>
                          Próximo: {new Date(lastRecord.next_due_at).toLocaleDateString("es-CL")}
                          {daysUntil(lastRecord.next_due_at)! < 0 && " ⚠ VENCIDO"}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-600">Sin registros</span>
                  )}
                </div>
              </div>

              {eqFails > 0 && (
                <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {eqFails} prueba(s) fallida(s) en este equipo. Requiere acción correctiva.
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Prueba</th>
                    <th className="pb-2 text-left font-medium">Frecuencia</th>
                    <th className="pb-2 text-left font-medium">Tolerancia</th>
                  </tr>
                </thead>
                <tbody>
                  {eq.tests.map((test, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4">{test.label}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{test.frequency}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{test.tolerance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Historial de registros */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Historial de Controles</h2>
        {records.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay registros de CC aún.</p>
            <p className="text-xs mt-1">Use la API POST /api/quality-control para registrar controles.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Equipo</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Responsable</th>
                  <th className="px-4 py-3 text-left font-medium">Resultado</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Próx. CC</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const days = daysUntil(r.next_due_at);
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{r.equipment_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{qcTypeLabel(r.qc_type)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(r.performed_at).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-4 py-2.5">{r.performed_by}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.result}</td>
                      <td className="px-4 py-2.5">
                        {r.pass ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" /> Aprobado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                            <XCircle className="h-3 w-3" /> Fallido
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {r.next_due_at ? (
                          <span className={days! < 0 ? "text-red-600 font-medium" : days! <= 3 ? "text-amber-600" : "text-muted-foreground"}>
                            {new Date(r.next_due_at).toLocaleDateString("es-CL")}
                            {days! < 0 && " ⚠"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Marco regulatorio */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold mb-3">Marco Regulatorio y Referencias Técnicas</h3>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          {[
            { ref: "IAEA Safety Reports Series No. 6", desc: "Garantía de calidad en equipos de medicina nuclear" },
            { ref: "NCRP Report No. 182 (2017)", desc: "CC en instrumentación para medicina nuclear" },
            { ref: "IAEA-TECDOC-1683", desc: "CC en gamma cámaras y sistemas SPECT" },
            { ref: "DS 133/1984 MINSAL", desc: "Requisitos de QA en instalaciones radiológicas" },
            { ref: "NS-06.0 §14 CCHEN", desc: "Programa de control de calidad de equipos" },
            { ref: "ACR Practice Guideline", desc: "CC en medicina nuclear — estándares ACR" },
          ].map((item) => (
            <div key={item.ref} className="flex gap-2">
              <span className="font-mono text-xs text-accent shrink-0 mt-0.5">▸</span>
              <div>
                <span className="font-medium text-xs">{item.ref}</span>
                <span className="text-xs text-muted-foreground"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
