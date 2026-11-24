"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
  ShieldAlert, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, X,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Risk {
  id:number; risk_code:string; title:string; risk_category:string; area:string|null;
  process:string|null; hazard:string|null; potential_harm:string|null; exposed_workers:string|null;
  probability:number; consequence:number; risk_score:number; risk_level:string;
  existing_controls:string|null; additional_controls:string|null;
  residual_probability:number|null; residual_consequence:number|null;
  residual_score:number|null; residual_level:string|null;
  responsible:string|null; alara_measures:string|null; regulatory_ref:string|null;
  observations:string|null;
}
interface Stats {
  total:number; critical:number; high:number; medium:number; low:number;
  occupational:number; public_risk:number; accidental:number; avg_score:number; avg_residual:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string,string> = {
  critical:"bg-red-200 text-red-800", high:"bg-orange-100 text-orange-700",
  medium:"bg-amber-100 text-amber-700", low:"bg-emerald-100 text-emerald-700",
};
const LEVEL_LABEL: Record<string,string> = {
  critical:"Crítico", high:"Alto", medium:"Medio", low:"Bajo",
};
const CAT_LABEL: Record<string,string> = {
  occupational:"Ocupacional", public:"Público general", accidental:"Accidental/emergencia",
  environmental:"Ambiental", patient:"Paciente",
};
const CAT_COLOR: Record<string,string> = {
  occupational:"bg-blue-100 text-blue-700", public:"bg-purple-100 text-purple-700",
  accidental:"bg-red-100 text-red-700", environmental:"bg-teal-100 text-teal-700",
  patient:"bg-indigo-100 text-indigo-700",
};

function scoreColor(score:number) {
  if (score>=20) return "text-red-700 font-bold";
  if (score>=12) return "text-orange-600 font-bold";
  if (score>=6)  return "text-amber-600 font-semibold";
  return "text-emerald-600";
}
function cellColor(p:number,c:number) {
  const s=p*c;
  if(s>=20) return "bg-red-500 text-white";
  if(s>=12) return "bg-orange-400 text-white";
  if(s>=6)  return "bg-amber-300";
  return "bg-emerald-200";
}

// ── RiskMatrix (5x5) ───────────────────────────────────────────────────────
function RiskMatrix({ risks }: { risks:Risk[] }) {
  const rows = [5,4,3,2,1];
  const cols = [1,2,3,4,5];
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs font-semibold mb-2">Matriz de Riesgo (Probabilidad × Consecuencia)</p>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[10px]" style={{minWidth:"280px"}}>
          <thead>
            <tr>
              <th className="text-muted-foreground pr-2 text-right w-16">Prob ↑ / Cons →</th>
              {cols.map(c=><th key={c} className="w-10 h-8 text-center text-muted-foreground">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(p=>(
              <tr key={p}>
                <td className="text-muted-foreground text-right pr-2 h-8">{p}</td>
                {cols.map(c=>{
                  const count = risks.filter(r=>r.probability===p&&r.consequence===c).length;
                  return (
                    <td key={c} className={`text-center h-8 w-10 border border-white/40 rounded-sm ${cellColor(p,c)}`}>
                      {count>0 && <span className="font-bold">{count}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 mt-2 text-[9px] flex-wrap">
        {[["bg-red-500","≥20 Crítico"],["bg-orange-400","12-19 Alto"],["bg-amber-300","6-11 Medio"],["bg-emerald-200","<6 Bajo"]].map(([bg,l])=>(
          <span key={l} className="flex items-center gap-1"><span className={`inline-block w-2.5 h-2.5 rounded-sm ${bg}`}/>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ── RiskCard ───────────────────────────────────────────────────────────────
function RiskCard({ risk, onEdit }: { risk:Risk; onEdit:(r:Risk)=>void }) {
  const [open, setOpen] = useState(false);
  const lc = LEVEL_COLOR[risk.risk_level] ?? LEVEL_COLOR.medium;
  const cc = CAT_COLOR[risk.risk_category] ?? CAT_COLOR.occupational;
  const isCritical = risk.risk_level === "critical" || risk.risk_level === "high";

  return (
    <div className={`rounded-lg border ${isCritical?"border-orange-300":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${isCritical?"text-orange-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{risk.risk_code}</span>
              <span className="text-sm font-semibold">{risk.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${lc}`}>{LEVEL_LABEL[risk.risk_level]??risk.risk_level}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${cc}`}>{CAT_LABEL[risk.risk_category]??risk.risk_category}</span>
              <span className={`text-xs shrink-0 ${scoreColor(risk.risk_score)}`}>{risk.probability}×{risk.consequence}={risk.risk_score}</span>
              {risk.residual_score!=null && <span className="text-[10px] text-muted-foreground shrink-0">→ residual: {risk.residual_score}</span>}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {risk.area && <span>📍 {risk.area}</span>}
              {risk.exposed_workers && <span className="ml-2">👥 {risk.exposed_workers}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 gap-2 text-xs">
            {risk.hazard && <div><span className="font-semibold">Peligro: </span><span className="text-muted-foreground">{risk.hazard}</span></div>}
            {risk.potential_harm && <div><span className="font-semibold">Daño potencial: </span><span className="text-muted-foreground">{risk.potential_harm}</span></div>}
            {risk.existing_controls && <div><span className="font-semibold">Controles actuales: </span><span className="text-muted-foreground">{risk.existing_controls}</span></div>}
            {risk.additional_controls && <div><span className="font-semibold">Controles adicionales: </span><span className="text-muted-foreground">{risk.additional_controls}</span></div>}
            {risk.alara_measures && <div><span className="font-semibold">Medidas ALARA: </span><span className="text-muted-foreground">{risk.alara_measures}</span></div>}
            {risk.regulatory_ref && <div><span className="font-semibold">Ref. normativa: </span><span className="text-muted-foreground">{risk.regulatory_ref}</span></div>}
          </div>
          {risk.residual_score!=null && (
            <div className="flex gap-4 text-xs rounded bg-muted/30 px-3 py-2">
              <span>Riesgo inherente: <strong className={scoreColor(risk.risk_score)}>{risk.risk_score}</strong></span>
              <span>Riesgo residual: <strong className={scoreColor(risk.residual_score)}>{risk.residual_score}</strong></span>
              {risk.residual_level && <span>Nivel residual: <strong className={LEVEL_COLOR[risk.residual_level]?.split(" ")[1]??""}>{LEVEL_LABEL[risk.residual_level]}</strong></span>}
            </div>
          )}
          <div className="flex gap-2 pt-1 border-t border-border/40">
            <button onClick={()=>onEdit(risk)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RiskModal ──────────────────────────────────────────────────────────────
function RiskModal({ risk, onClose, onSave }: { risk:Partial<Risk>|null; onClose:()=>void; onSave:(d:Partial<Risk>)=>void }) {
  const [form, setForm] = useState<Partial<Risk>>({
    risk_category:"occupational", probability:2, consequence:2, risk_level:"medium",
    residual_probability:1, residual_consequence:1, residual_level:"low", ...risk,
  });
  const set = (k:keyof Risk, v:string|number) => setForm(f=>({...f,[k]:v}));

  const compLevel = (p:number,c:number):string => {
    const s=p*c;
    if(s>=20) return "critical"; if(s>=12) return "high"; if(s>=6) return "medium"; return "low";
  };
  const updateProb = (v:number) => setForm(f=>({...f,probability:v,risk_level:compLevel(v,f.consequence??2)}));
  const updateCons = (v:number) => setForm(f=>({...f,consequence:v,risk_level:compLevel(f.probability??2,v)}));
  const updateRProb = (v:number) => setForm(f=>({...f,residual_probability:v,residual_level:compLevel(v,f.residual_consequence??2)}));
  const updateRCons = (v:number) => setForm(f=>({...f,residual_consequence:v,residual_level:compLevel(f.residual_probability??2,v)}));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{risk?.id?"Editar riesgo":"Registrar riesgo radiológico"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Título *
              <input value={form.title??""} onChange={e=>set("title",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Categoría
              <select value={form.risk_category??""} onChange={e=>set("risk_category",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Área
              <input value={form.area??""} onChange={e=>set("area",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Probabilidad (1-5)
              <input type="number" min={1} max={5} value={form.probability??2} onChange={e=>updateProb(Number(e.target.value))}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Consecuencia (1-5)
              <input type="number" min={1} max={5} value={form.consequence??2} onChange={e=>updateCons(Number(e.target.value))}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <div className="col-span-2 flex items-center gap-3 text-xs rounded bg-muted/30 px-3 py-2">
              <span>Puntaje: <strong className={scoreColor((form.probability??2)*(form.consequence??2))}>{(form.probability??2)*(form.consequence??2)}</strong></span>
              <span>Nivel: <strong>{LEVEL_LABEL[form.risk_level??"medium"]}</strong></span>
            </div>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Peligro / Fuente de riesgo
              <textarea value={form.hazard??""} onChange={e=>set("hazard",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Controles existentes
              <textarea value={form.existing_controls??""} onChange={e=>set("existing_controls",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Prob. residual (1-5)
              <input type="number" min={1} max={5} value={form.residual_probability??1} onChange={e=>updateRProb(Number(e.target.value))}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Cons. residual (1-5)
              <input type="number" min={1} max={5} value={form.residual_consequence??1} onChange={e=>updateRCons(Number(e.target.value))}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Medidas ALARA
              <textarea value={form.alara_measures??""} onChange={e=>set("alara_measures",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Responsable
              <input value={form.responsible??""} onChange={e=>set("responsible",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Ref. normativa
              <input value={form.regulatory_ref??""} onChange={e=>set("regulatory_ref",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted/40">Cancelar</button>
          <button onClick={()=>onSave(form)} className="text-sm px-3 py-1.5 rounded bg-accent text-accent-foreground hover:opacity-90">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function RisksPage() {
  const [data, setData]       = useState<{ rows:Risk[]; stats:Stats }|null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<Partial<Risk>|null|false>(false);
  const [filterCat, setFilterCat]     = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const load = useCallback(async (c=filterCat, l=filterLevel) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (c) p.set("cat",c);
    if (l) p.set("level",l);
    const res = await fetch(`/api/risks?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterCat, filterLevel]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Risk>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/risks", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const rows = data?.rows ?? [];
  const highRisk = rows.filter(r=>r.risk_level==="critical"||r.risk_level==="high");

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <RiskModal risk={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-accent"/>Gestión de Riesgos Radiológicos</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Identificación, evaluación y control de riesgos radiológicos · Matriz probabilidad × consecuencia (5×5)</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Registrar riesgo
        </button>
      </div>

      {/* Alertas */}
      {highRisk.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
          <p className="text-sm text-orange-700"><strong>{highRisk.length} riesgo(s)</strong> en nivel Alto o Crítico — verificar controles ALARA implementados</p>
        </div>
      )}

      {/* Matriz + KPIs en fila */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data && <RiskMatrix risks={rows}/>}
        {st && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Total riesgos",   value:st.total },
              { label:"Crítico",         value:st.critical,     color:"text-red-700" },
              { label:"Alto",            value:st.high,         color:"text-orange-600" },
              { label:"Medio",           value:st.medium,       color:"text-amber-600" },
              { label:"Bajo",            value:st.low,          color:"text-emerald-600" },
              { label:"Ocupacional",     value:st.occupational, color:"text-blue-600" },
              { label:"Público",         value:st.public_risk,  color:"text-purple-600" },
              { label:"Accidental",      value:st.accidental,   color:"text-red-500" },
            ].map(k=>(
              <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
                <p className={`text-2xl font-bold ${k.color??""}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="risks"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);load(e.target.value,filterLevel);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterLevel} onChange={e=>{setFilterLevel(e.target.value);load(filterCat,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los niveles</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="medium">Medio</option>
          <option value="low">Bajo</option>
        </select>
      </div>

      {/* Lista ordenada por puntaje desc */}
      <div className="flex flex-col gap-2">
        {rows.length===0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin riesgos registrados</p>
          </div>
        ) : rows.map(r=><RiskCard key={r.id} risk={r} onEdit={r=>setModal(r)}/>)}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500"/>
        <p className="text-[10px] text-muted-foreground">
          Normativa: CCHEN NS-06.0 §4.5 (Gestión de riesgos) · IAEA GSR Part 3 (Protección radiológica) · Revisión anual obligatoria de la matriz · Principio ALARA
        </p>
      </div>
    </div>
  );
}
