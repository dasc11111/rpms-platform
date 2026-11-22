"use client";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Download, CheckCircle2, AlertTriangle, XCircle,
  Users, Radiation, Shield, GraduationCap, Wrench, Trash2,
  TrendingDown, BarChart3, AlertCircle, Clock, ChevronDown, ChevronUp,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface AnnualReport {
  year: number;
  generated_at: string;
  institution: { name:string; address:string; cchen_license:string; opr_name:string; opr_registration:string; report_period:string; report_year:number };
  summary: { score:number; critical_issues:string[] };
  sections: {
    dosimetry: { workers_monitored:number; collective_dose_mSv:number; avg_dose_mSv:number; max_individual_dose_mSv:number; above_20mSv:number; between_6_20mSv:number; below_1mSv:number; monthly_trend:{month:number;collective:number;max_dose:number;workers:number}[] };
    workers: { total:number; cat_a:number; cat_b:number; active:number; with_dosimeter:number };
    sources: { total:number; active:number; sealed:number; unsealed:number; cat_1:number; cat_2:number; cat_3:number; cat_4:number; cat_5:number };
    incidents: { total:number; ines_0:number; ines_1:number; ines_2plus:number; closed:number; open:number; investigating:number };
    training: { sessions_total:number; sessions_completed:number; total_participants:number; total_training_hours:number };
    instruments: { total:number; operational:number; calibration_due:number; out_of_service:number; overdue_calibration:number };
    waste: { total_entries:number; in_storage:number; cleared:number; disposed:number; vll:number; low:number; intermediate:number };
    compliance: { total:number; compliant:number; partial:number; non_compliant:number; not_applicable:number; compliance_pct:number };
    alara: { objectives_total:number; achieved:number; in_progress:number; overdue:number; avg_progress_pct:number };
    regulatory_reports: { total:number; submitted:number; approved:number; draft:number; this_year:number };
    environmental: { total_readings:number; avg_dose_rate:number; max_dose_rate:number; anomalies:number };
  };
}

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }: { title:string; icon:React.ComponentType<{className?:string}>; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden print:block">
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors print:pointer-events-none">
        <Icon className="h-4 w-4 text-accent shrink-0"/>
        <span className="font-semibold text-sm flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground print:hidden"/> : <ChevronDown className="h-4 w-4 text-muted-foreground print:hidden"/>}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── KPI row ────────────────────────────────────────────────────────────────
function KpiRow({ items }: { items:{label:string;value:string|number;sub?:string;color?:string}[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(k=>(
        <div key={k.label} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className={`text-xl font-bold ${k.color??""}`}>{k.value}</p>
          <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
          {k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AnnualReportPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<AnnualReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    const r = await fetch(`/api/annual-report?year=${y}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="p-8 text-muted-foreground">Error cargando datos.</p>;

  const { institution, summary, sections: s } = data;
  const sc = summary.score >= 85 ? "text-emerald-600" : summary.score >= 65 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex flex-col gap-5 p-6 print:p-2 print:gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:flex-col">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 print:text-lg"><FileText className="h-5 w-5 text-accent print:hidden"/>Informe Anual de Protección Radiológica</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 Art. 36 — Informe Anual Obligatorio</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
            {[currentYear, currentYear-1, currentYear-2].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={()=>window.print()} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm hover:opacity-90">
            <Download className="h-4 w-4"/>Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Portada */}
      <div className="rounded-lg border border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Institución</p>
            <p className="font-bold text-lg leading-tight">{institution.name}</p>
            <p className="text-sm text-muted-foreground">{institution.address}</p>
            <div className="mt-2 flex gap-4 flex-wrap text-xs">
              <span>📋 Licencia: <strong>{institution.cchen_license}</strong></span>
              <span>👤 EPR: <strong>{institution.opr_registration}</strong></span>
              <span>📅 Período: <strong>{institution.report_period}</strong></span>
            </div>
          </div>
          <div className="text-center border-l border-blue-200 pl-5">
            <p className="text-xs text-muted-foreground mb-1">Score del Programa</p>
            <p className={`text-5xl font-black ${sc}`}>{summary.score}</p>
            <p className="text-xs text-muted-foreground">/ 100 pts</p>
          </div>
        </div>
        {summary.critical_issues.length > 0 && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-2.5">
            <p className="text-xs font-semibold text-red-700 mb-1">⚠ Hallazgos críticos del período:</p>
            <ul className="space-y-0.5">
              {summary.critical_issues.map((c,i)=><li key={i} className="text-xs text-red-700">• {c}</li>)}
            </ul>
          </div>
        )}
        {summary.critical_issues.length === 0 && (
          <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0"/>
            <p className="text-xs text-emerald-700">Sin hallazgos críticos en el período — Programa en estado satisfactorio</p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">Generado: {fmtDate(data.generated_at)}</p>
      </div>

      {/* Sections */}
      {/* 1. Dosimetría */}
      <Section title="1. Dosimetría Personal — Resultados del Período" icon={Radiation}>
        {Number(s.dosimetry.above_20mSv) > 0 && (
          <div className="mb-3 rounded-md bg-red-50 border border-red-200 p-2.5 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600 shrink-0"/>
            <p className="text-sm text-red-700"><strong>{s.dosimetry.above_20mSv} trabajador(es)</strong> superaron el límite de 20 mSv/año — Requiere investigación inmediata</p>
          </div>
        )}
        <KpiRow items={[
          { label:"Trabajadores monitoreados", value: s.dosimetry.workers_monitored },
          { label:"Dosis colectiva (mSv)", value: s.dosimetry.collective_dose_mSv, sub:"Σ período" },
          { label:"Dosis media individual", value: `${s.dosimetry.avg_dose_mSv} mSv`, color: Number(s.dosimetry.avg_dose_mSv)>6?"text-amber-600":"" },
          { label:"Dosis máxima individual", value: `${s.dosimetry.max_individual_dose_mSv} mSv`, color: Number(s.dosimetry.max_individual_dose_mSv)>20?"text-red-600":Number(s.dosimetry.max_individual_dose_mSv)>6?"text-amber-600":"text-emerald-600" },
          { label:"Sobre límite 20 mSv", value: s.dosimetry.above_20mSv, color: Number(s.dosimetry.above_20mSv)>0?"text-red-600":"" },
          { label:"Entre 6–20 mSv", value: s.dosimetry.between_6_20mSv, color: Number(s.dosimetry.between_6_20mSv)>0?"text-amber-600":"" },
          { label:"Por debajo de 1 mSv", value: s.dosimetry.below_1mSv, sub:"Dosis muy baja" },
          { label:"Límite reglamentario", value:"20 mSv/año", sub:"DS 3/1985" },
        ]}/>
        {s.dosimetry.monthly_trend?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold mb-2">Tendencia mensual dosis colectiva (mSv)</p>
            <div className="flex items-end gap-1 h-16">
              {s.dosimetry.monthly_trend.map(m=>{
                const months = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const max = Math.max(...s.dosimetry.monthly_trend.map(x=>Number(x.collective)), 1);
                const h = Math.round((Number(m.collective)/max)*100);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full bg-blue-500/20 rounded-sm flex items-end" style={{height:"52px"}}>
                      <div className="w-full bg-blue-500 rounded-sm transition-all" style={{height:`${h}%`}} title={`${m.collective} mSv`}/>
                    </div>
                    <span className="text-[9px] text-muted-foreground">{months[m.month]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* 2. Personal */}
      <Section title="2. Personal Ocupacionalmente Expuesto (POE)" icon={Users}>
        <KpiRow items={[
          { label:"POE total registrado", value: s.workers.total },
          { label:"Categoría A", value: s.workers.cat_a, sub:"Control trimestral" },
          { label:"Categoría B", value: s.workers.cat_b, sub:"Control anual" },
          { label:"Con dosímetro asignado", value: s.workers.with_dosimeter },
        ]}/>
        <p className="text-xs text-muted-foreground mt-2">Categorización según DS 3/1985 Art. 15 — Límite Cat. A: 20 mSv/año | Cat. B: 6 mSv/año</p>
      </Section>

      {/* 3. Fuentes */}
      <Section title="3. Inventario de Fuentes Radiactivas" icon={Radiation}>
        <KpiRow items={[
          { label:"Fuentes totales", value: s.sources.total },
          { label:"Activas", value: s.sources.active, color:"text-emerald-600" },
          { label:"Selladas", value: s.sources.sealed },
          { label:"No selladas", value: s.sources.unsealed },
        ]}/>
        <div className="mt-2 flex gap-2 flex-wrap">
          {[1,2,3,4,5].map(c=>{
            const val = s.sources[`cat_${c}` as keyof typeof s.sources] as number;
            if (!val) return null;
            const colors = ["","bg-red-100 text-red-700","bg-orange-100 text-orange-700","bg-amber-100 text-amber-700","bg-green-100 text-green-700","bg-blue-100 text-blue-700"];
            return <span key={c} className={`text-xs px-2 py-0.5 rounded-full ${colors[c]}`}>Cat. {c}: {val}</span>;
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Categorización IAEA — Categoría 1 mayor peligrosidad</p>
      </Section>

      {/* 4. Incidentes */}
      <Section title="4. Incidentes Radiológicos" icon={AlertTriangle}>
        {Number(s.incidents.ines_2plus) > 0 && (
          <div className="mb-3 rounded-md bg-red-50 border border-red-200 p-2.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0"/>
            <p className="text-sm text-red-700"><strong>{s.incidents.ines_2plus} incidente(s) INES ≥ 2</strong> — Deben reportarse a CCHEN</p>
          </div>
        )}
        <KpiRow items={[
          { label:"Total incidentes", value: s.incidents.total },
          { label:"INES 0 (Desviación)", value: s.incidents.ines_0 },
          { label:"INES 1 (Anomalía)", value: s.incidents.ines_1, color: Number(s.incidents.ines_1)>0?"text-amber-600":"" },
          { label:"INES ≥ 2", value: s.incidents.ines_2plus, color: Number(s.incidents.ines_2plus)>0?"text-red-600":"" },
          { label:"Cerrados", value: s.incidents.closed, color:"text-emerald-600" },
          { label:"Abiertos", value: s.incidents.open, color: Number(s.incidents.open)>0?"text-amber-600":"" },
          { label:"En investigación", value: s.incidents.investigating },
          { label:"Tasa resolución", value: s.incidents.total > 0 ? `${Math.round(s.incidents.closed/s.incidents.total*100)}%` : "—", color:"text-blue-600" },
        ]}/>
      </Section>

      {/* 5. Capacitación */}
      <Section title="5. Capacitación y Competencias en Protección Radiológica" icon={GraduationCap}>
        <KpiRow items={[
          { label:"Sesiones realizadas", value: `${s.training.sessions_completed}/${s.training.sessions_total}` },
          { label:"Total participantes", value: s.training.total_participants },
          { label:"Horas de capacitación", value: s.training.total_training_hours, sub:"horas·persona" },
          { label:"Cumplimiento plan", value: s.training.sessions_total > 0 ? `${Math.round(s.training.sessions_completed/s.training.sessions_total*100)}%` : "—", color:"text-emerald-600" },
        ]}/>
      </Section>

      {/* 6. Instrumentos */}
      <Section title="6. Instrumentos de Medición y Calibración" icon={Wrench}>
        {Number(s.instruments.overdue_calibration) > 0 && (
          <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 shrink-0"/>
            <p className="text-sm text-amber-700"><strong>{s.instruments.overdue_calibration} instrumento(s)</strong> con calibración vencida</p>
          </div>
        )}
        <KpiRow items={[
          { label:"Instrumentos totales", value: s.instruments.total },
          { label:"Operativos", value: s.instruments.operational, color:"text-emerald-600" },
          { label:"Calibración requerida", value: s.instruments.calibration_due, color: Number(s.instruments.calibration_due)>0?"text-amber-600":"" },
          { label:"Fuera de servicio", value: s.instruments.out_of_service, color: Number(s.instruments.out_of_service)>0?"text-red-600":"" },
        ]}/>
      </Section>

      {/* 7. Residuos */}
      <Section title="7. Gestión de Residuos Radiactivos" icon={Trash2}>
        <KpiRow items={[
          { label:"Entradas registradas", value: s.waste.total_entries },
          { label:"En almacenamiento", value: s.waste.in_storage },
          { label:"Liberados (10 T½)", value: s.waste.cleared, color:"text-emerald-600" },
          { label:"Dispuestos", value: s.waste.disposed },
          { label:"Muy bajo nivel", value: s.waste.vll },
          { label:"Bajo nivel", value: s.waste.low },
          { label:"Nivel intermedio", value: s.waste.intermediate, color: Number(s.waste.intermediate)>0?"text-amber-600":"" },
        ]}/>
        <p className="text-xs text-muted-foreground mt-2">Criterio liberación: 10 semividas (T½×10) — IAEA GSR Part 5 / DS 3/1985 Art. 56</p>
      </Section>

      {/* 8. Cumplimiento */}
      <Section title="8. Cumplimiento Normativo NS-06.0" icon={Shield}>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <p className={`text-4xl font-black ${s.compliance.compliance_pct>=90?"text-emerald-600":s.compliance.compliance_pct>=70?"text-amber-600":"text-red-600"}`}>{s.compliance.compliance_pct}%</p>
            <p className="text-xs text-muted-foreground">Cumplimiento</p>
          </div>
          <div className="flex-1">
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              <div className="bg-emerald-500" style={{width:`${(s.compliance.compliant/Math.max(s.compliance.total,1))*100}%`}}/>
              <div className="bg-amber-400" style={{width:`${(s.compliance.partial/Math.max(s.compliance.total,1))*100}%`}}/>
              <div className="bg-red-500" style={{width:`${(s.compliance.non_compliant/Math.max(s.compliance.total,1))*100}%`}}/>
              <div className="bg-gray-200" style={{width:`${(s.compliance.not_applicable/Math.max(s.compliance.total,1))*100}%`}}/>
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
              <span>✓ Cumple: {s.compliance.compliant}</span>
              <span>◑ Parcial: {s.compliance.partial}</span>
              <span>✗ No cumple: {s.compliance.non_compliant}</span>
              <span>— N/A: {s.compliance.not_applicable}</span>
            </div>
          </div>
        </div>
      </Section>

      {/* 9. ALARA */}
      <Section title="9. Programa ALARA — Optimización de la Dosis Colectiva" icon={TrendingDown}>
        <KpiRow items={[
          { label:"Objetivos ALARA", value: s.alara.objectives_total },
          { label:"Logrados", value: s.alara.achieved, color:"text-emerald-600" },
          { label:"En progreso", value: s.alara.in_progress },
          { label:"Atrasados", value: s.alara.overdue, color: Number(s.alara.overdue)>0?"text-red-600":"" },
        ]}/>
        <p className="text-xs text-muted-foreground mt-1">Avance promedio: {s.alara.avg_progress_pct}% — Principio ALARA: "As Low As Reasonably Achievable"</p>
      </Section>

      {/* 10. Monitoreo ambiental */}
      <Section title="10. Monitoreo Ambiental" icon={BarChart3}>
        <KpiRow items={[
          { label:"Lecturas registradas", value: s.environmental.total_readings },
          { label:"Tasa dosis promedio", value: `${s.environmental.avg_dose_rate} μSv/h` },
          { label:"Tasa dosis máxima", value: `${s.environmental.max_dose_rate} μSv/h` },
          { label:"Anomalías detectadas", value: s.environmental.anomalies, color: Number(s.environmental.anomalies)>0?"text-amber-600":"" },
        ]}/>
      </Section>

      {/* 11. Reportes regulatorios */}
      <Section title="11. Declaraciones y Reportes a CCHEN" icon={FileText}>
        <KpiRow items={[
          { label:"Reportes año en curso", value: s.regulatory_reports.this_year },
          { label:"Enviados a CCHEN", value: s.regulatory_reports.submitted, color:"text-emerald-600" },
          { label:"Aprobados", value: s.regulatory_reports.approved },
          { label:"En borrador", value: s.regulatory_reports.draft, color: Number(s.regulatory_reports.draft)>0?"text-amber-600":"" },
        ]}/>
      </Section>

      {/* Firma */}
      <div className="rounded-lg border border-border bg-surface p-4 print:mt-8">
        <p className="text-xs font-semibold mb-4">Firmas y Responsabilidades</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { title:"Encargado de Protección Radiológica", name: institution.opr_name, reg: institution.opr_registration },
            { title:"Director Médico / Jefe de Servicio", name:"", reg:"" },
            { title:"Representante Legal", name:"", reg:"" },
          ].map((s,i)=>(
            <div key={i} className="flex flex-col gap-1">
              <p className="text-[10px] text-muted-foreground font-semibold">{s.title}</p>
              <div className="border-b border-border pb-6 mb-1"/>
              {s.name ? <p className="text-xs">{s.name}</p> : <p className="text-xs text-muted-foreground">Nombre y firma</p>}
              {s.reg && <p className="text-[10px] text-muted-foreground">Reg. {s.reg}</p>}
              <p className="text-[10px] text-muted-foreground">Fecha: _______________</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground print:fixed print:bottom-2 print:w-full">
        Informe generado por RPMS — Sistema de Gestión de Protección Radiológica · {fmtDate(data.generated_at)} · Período {data.year}
      </div>
    </div>
  );
}
