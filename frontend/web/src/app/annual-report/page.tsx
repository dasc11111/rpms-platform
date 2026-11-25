"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Summary {
  totalWorkers:number; activePoe:number; dosimetryRecords:number; avgDose:number; maxDose:number;
  workersOver15:number; workersOver20:number;
  totalIncidents:number; reportedCchen:number;
  trainingEvents:number; trainedWorkers:number; avgTrainingHours:number;
  committeeMeetings:number; openAgreements:number;
  auditsTotal:number; auditsClosed:number; openFindings:number;
  docsTotal:number; docsApproved:number; docsOverdue:number;
  vendorsTotal:number; vendorsCchen:number; vendorsExpired:number;
  risksTotal:number; risksHigh:number;
  changesTotal:number; instrTotal:number; instrExpiredCalib:number;
  complianceScore:number;
}
interface DoseMonth { month:number; avg_dose:number; count:number; }
interface ComplianceItem { section:string; ok:boolean; }
interface ReportData { year:number; summary:Summary; doseMonthly:DoseMonth[]; complianceItems:ComplianceItem[]; }

// ── helpers ─────────────────────────────────────────────────────────────────
const MONTH_LABEL = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function MiniBar({ value, max, color="bg-accent" }: { value:number; max:number; color?:string }) {
  const pct = max > 0 ? Math.min(value/max*100,100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{width:`${pct}%`}}/>
    </div>
  );
}

function KpiBlock({ label, value, sub, warn=false, ok=true }: { label:string; value:string|number; sub?:string; warn?:boolean; ok?:boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn?"border-orange-300 bg-orange-50/60":ok?"border-border bg-surface":"border-red-200 bg-red-50/40"}`}>
      <p className={`text-2xl font-bold ${warn?"text-orange-600":!ok?"text-red-600":""}`}>{value}</p>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border/60 px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function AnnualReportPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]     = useState(currentYear);
  const [data, setData]     = useState<ReportData|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/annual-report?year=${year}`)
      .then(r=>r.json())
      .then(d=>{ setData(d); setLoading(false); })
      .catch(()=>setLoading(false));
  }, [year]);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Error cargando informe</div>;

  const { summary: s, doseMonthly, complianceItems } = data;
  const maxMonthDose = Math.max(...doseMonthly.map(d=>d.avg_dose), 0.001);

  return (
    <div className="flex flex-col gap-5 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-accent"/>Informe Anual Integrado PR</h1>
          <p className="text-sm text-muted-foreground">Hospital Dr. Hernán Henríquez Aravena — Servicio Medicina Nuclear · Programa de Protección Radiológica NS-06.0</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
            {[currentYear, currentYear-1, currentYear-2].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={()=>window.print()} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
            <Download className="h-4 w-4"/>Imprimir
          </button>
        </div>
      </div>

      {/* Compliance global */}
      <div className={`rounded-lg border px-4 py-3 flex items-center gap-4 ${s.complianceScore>=80?"border-emerald-200 bg-emerald-50/50":"border-orange-200 bg-orange-50/50"}`}>
        {s.complianceScore>=80 ? <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0"/> : <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0"/>}
        <div className="flex-1">
          <p className="font-semibold text-sm">Cumplimiento NS-06.0 — Año {year}</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${s.complianceScore>=80?"bg-emerald-500":"bg-orange-400"}`} style={{width:`${s.complianceScore}%`}}/>
            </div>
            <span className={`font-bold text-lg ${s.complianceScore>=80?"text-emerald-700":"text-orange-600"}`}>{s.complianceScore}%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground shrink-0">{complianceItems.filter(c=>c.ok).length}/{complianceItems.length} secciones OK</p>
      </div>

      {/* §1 Personal expuesto */}
      <Section title="1. Personal Ocupacionalmente Expuesto (POE)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiBlock label="Total trabajadores" value={s.totalWorkers}/>
          <KpiBlock label="POE activos" value={s.activePoe}/>
          <KpiBlock label="Registros dosim. año" value={s.dosimetryRecords}/>
          <KpiBlock label="Dosis promedio anual" value={`${s.avgDose?.toFixed(2)} mSv`} sub="Límite: 20 mSv/año" ok={s.avgDose<10}/>
          <KpiBlock label="Dosis máxima individual" value={`${s.maxDose?.toFixed(2)} mSv`} warn={s.maxDose>15} ok={s.maxDose<20}/>
          <KpiBlock label="POE > 15 mSv" value={s.workersOver15} warn={s.workersOver15>0} ok={s.workersOver15===0} sub="Alerta: > límite de acción"/>
          {s.workersOver20>0 && <KpiBlock label="POE > 20 mSv ⚠" value={s.workersOver20} ok={false} sub="Excede límite regulatorio"/>}
        </div>
      </Section>

      {/* §2 Dosis mensuales */}
      {doseMonthly.length > 0 && (
        <Section title="2. Tendencia de Dosis Efectiva Mensual Promedio">
          <div className="space-y-1.5">
            {doseMonthly.map(d=>(
              <div key={d.month} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-7 text-right shrink-0">{MONTH_LABEL[d.month]}</span>
                <div className="flex-1">
                  <MiniBar value={d.avg_dose} max={maxMonthDose}
                    color={d.avg_dose > 1.5?"bg-orange-400": d.avg_dose > 0.8?"bg-amber-400":"bg-emerald-400"}/>
                </div>
                <span className="text-xs font-mono w-20 text-right shrink-0">{d.avg_dose.toFixed(3)} mSv</span>
                <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">({d.count} reg.)</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* §3 Incidentes */}
      <Section title="3. Incidentes y Eventos Radiológicos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiBlock label="Total incidentes" value={s.totalIncidents} ok={s.totalIncidents===0}/>
          <KpiBlock label="Reportados a CCHEN" value={s.reportedCchen} sub="Obligatorio según normativa"/>
          {s.totalIncidents > s.reportedCchen && (
            <KpiBlock label="Sin reportar a CCHEN" value={s.totalIncidents-s.reportedCchen} ok={false} warn/>
          )}
        </div>
      </Section>

      {/* §4 Capacitación */}
      <Section title="4. Capacitación del Personal">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiBlock label="Eventos de capacitación" value={s.trainingEvents}/>
          <KpiBlock label="Trabajadores capacitados" value={s.trainedWorkers}
            ok={s.trainedWorkers >= s.activePoe * 0.8} sub={`Meta: ≥80% POE (${Math.ceil(s.activePoe*0.8)})`}/>
          <KpiBlock label="Horas promedio/evento" value={`${s.avgTrainingHours?.toFixed(1) ?? 0} h`}/>
          <KpiBlock label="% POE capacitado" value={`${s.activePoe ? Math.round(s.trainedWorkers/s.activePoe*100) : 0}%`}
            ok={(s.trainedWorkers/Math.max(s.activePoe,1))>=0.8}/>
        </div>
      </Section>

      {/* §5 Comité PR */}
      <Section title="5. Comité de Protección Radiológica">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiBlock label="Sesiones realizadas" value={s.committeeMeetings}
            ok={s.committeeMeetings>=4} sub="Mínimo 4 anuales NS-06.0"/>
          <KpiBlock label="Acuerdos pendientes" value={s.openAgreements}
            warn={s.openAgreements>5} ok={s.openAgreements===0}/>
        </div>
      </Section>

      {/* §6 Auditorías */}
      <Section title="6. Auditorías Internas del Programa">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiBlock label="Auditorías planificadas" value={s.auditsTotal}/>
          <KpiBlock label="Auditorías cerradas" value={s.auditsClosed} ok={s.auditsClosed===s.auditsTotal}/>
          <KpiBlock label="Hallazgos abiertos" value={s.openFindings}
            warn={s.openFindings>3} ok={s.openFindings===0}/>
        </div>
      </Section>

      {/* §7 Documentación */}
      <Section title="7. Sistema de Gestión Documental">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiBlock label="Documentos totales" value={s.docsTotal}/>
          <KpiBlock label="Documentos vigentes" value={s.docsApproved}
            ok={s.docsApproved===s.docsTotal} sub={`${s.docsTotal ? Math.round(s.docsApproved/s.docsTotal*100) : 0}% del total`}/>
          <KpiBlock label="Revisiones vencidas" value={s.docsOverdue}
            ok={s.docsOverdue===0} warn={s.docsOverdue>0}/>
        </div>
      </Section>

      {/* §8 Proveedores e instrumentos */}
      <Section title="8. Proveedores e Instrumentos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiBlock label="Proveedores activos" value={s.vendorsTotal}/>
          <KpiBlock label="Auth. CCHEN" value={s.vendorsCchen}/>
          <KpiBlock label="Auth. CCHEN vencida" value={s.vendorsExpired}
            ok={s.vendorsExpired===0} warn={s.vendorsExpired>0}/>
          <KpiBlock label="Instrumentos" value={s.instrTotal}/>
          <KpiBlock label="Calibraciones vencidas" value={s.instrExpiredCalib}
            ok={s.instrExpiredCalib===0} warn={s.instrExpiredCalib>0}/>
          <KpiBlock label="Cambios al programa" value={s.changesTotal}/>
          <KpiBlock label="Riesgos identificados" value={s.risksTotal}/>
          <KpiBlock label="Riesgos alto/crítico" value={s.risksHigh}
            warn={s.risksHigh>0} ok={s.risksHigh===0}/>
        </div>
      </Section>

      {/* §9 Checklist cumplimiento NS-06.0 */}
      <Section title="9. Lista de Verificación Cumplimiento NS-06.0">
        <div className="flex flex-col gap-1.5">
          {complianceItems.map((c,i)=>(
            <div key={i} className={`flex items-center gap-3 rounded px-3 py-2 text-xs ${c.ok?"bg-emerald-50 border border-emerald-100":"bg-red-50 border border-red-200"}`}>
              {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0"/> : <XCircle className="h-4 w-4 text-red-500 shrink-0"/>}
              <span className={c.ok?"text-emerald-800":"text-red-800"}>{c.section}</span>
              <span className="ml-auto font-semibold shrink-0">{c.ok?"✓ Conforme":"✗ No conforme"}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-emerald-500"/>
        <p>Informe generado por RPMS · Hospital Dr. Hernán Henríquez Aravena, Temuco · Año {year} · CCHEN NS-06.0</p>
      </div>
    </div>
  );
}
