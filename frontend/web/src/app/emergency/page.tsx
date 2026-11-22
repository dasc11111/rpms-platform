"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown, ChevronUp, Flame, Phone, Wrench, ClipboardCheck,
  AlertTriangle, Shield, CheckCircle2, Plus, Radio, AlertCircle,
  ListOrdered, Bell, Package,
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────
interface Procedure {
  id: number; code: string; title: string; scenario_type: string; severity: string;
  description: string | null; immediate_actions: string[] | null;
  notification_chain: string[] | null; evacuation_zone: string | null;
  ppe_required: string[] | null; estimated_duration_min: number | null;
  last_reviewed: string | null; reviewed_by: string | null; version: string;
}
interface Contact {
  id: number; name: string; role: string; organization: string | null;
  phone_primary: string; phone_secondary: string | null; email: string | null;
  availability: string; contact_order: number; notes: string | null;
}
interface Equipment {
  id: number; name: string; equipment_type: string; location: string;
  quantity: number; unit: string; condition: string;
  last_inspection: string | null; next_inspection: string | null;
  responsible: string | null; notes: string | null;
}
interface Drill {
  id: number; drill_date: string; drill_type: string; scenario: string;
  procedure_title: string | null; participants_count: number;
  duration_min: number | null; coordinator: string | null; overall_rating: string;
  strengths: string | null; improvement_areas: string | null;
  corrective_actions: string[] | null; next_drill_date: string | null;
}
interface EmergencyData {
  procedures: Procedure[]; contacts: Contact[]; equipment: Equipment[]; drills: Drill[];
  stats: {
    procedures_count: number; contacts_count: number;
    equipment_total: number; equipment_out: number; equipment_overdue: number; equipment_soon: number;
    total_drills: number; last_drill: string | null; drills_last_year: number;
  };
}

// ── config ─────────────────────────────────────────────────────────────────
const SEVERITY_CFG: Record<string, { label:string; color:string; border:string }> = {
  low:     { label:"Baja",    color:"bg-gray-100  text-gray-700",   border:"border-gray-300"  },
  medium:  { label:"Media",   color:"bg-amber-100 text-amber-700",  border:"border-amber-300" },
  high:    { label:"Alta",    color:"bg-orange-100 text-orange-700",border:"border-orange-400"},
  extreme: { label:"Extrema", color:"bg-red-100   text-red-700",    border:"border-red-500"   },
};
const SCENARIO_LABEL: Record<string, string> = {
  spill:"Derrame", loss:"Pérdida", overexposure:"Sobreexposición",
  contamination:"Contaminación", fire:"Incendio", transport:"Transporte", other:"Otro",
};
const CONDITION_CFG: Record<string, { label:string; color:string }> = {
  good:         { label:"Bueno",        color:"bg-emerald-100 text-emerald-700" },
  fair:         { label:"Regular",      color:"bg-amber-100  text-amber-700"   },
  needs_service:{ label:"Necesita serv.",color:"bg-orange-100 text-orange-700" },
  out_of_service:{ label:"Fuera servicio",color:"bg-red-100 text-red-700"      },
};
const RATING_CFG: Record<string, { label:string; color:string }> = {
  excellent:        { label:"Excelente",        color:"bg-emerald-100 text-emerald-700 border-emerald-200" },
  satisfactory:     { label:"Satisfactorio",    color:"bg-blue-100   text-blue-700   border-blue-200"     },
  needs_improvement:{ label:"Mejora necesaria", color:"bg-amber-100  text-amber-700  border-amber-200"    },
  unsatisfactory:   { label:"Insatisfactorio",  color:"bg-red-100    text-red-700    border-red-200"      },
};
const DRILL_TYPE_LABEL: Record<string, string> = { table_top:"Escritorio", functional:"Funcional", full_scale:"Escala completa" };
const EQUIP_TYPE_LABEL: Record<string, string> = { detection:"Detección", ppe:"EPP", decontamination:"Descontaminación", containment:"Contención", communication:"Comunicación" };
const AVAIL_LABEL: Record<string, string> = { "24/7":"24/7", office_hours:"Horario oficina", on_call:"Disponible llamada" };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}
function isPast(d: string | null) { return d ? new Date(d) < new Date() : false; }
function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// ── ProcedureCard ──────────────────────────────────────────────────────────
function ProcedureCard({ p }: { p: Procedure }) {
  const [open, setOpen] = useState(false);
  const sc = SEVERITY_CFG[p.severity] ?? SEVERITY_CFG.medium;
  return (
    <div className={`rounded-lg border-2 ${sc.border} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <Flame className={`h-4 w-4 mt-0.5 shrink-0 ${p.severity==="extreme"?"text-red-500":p.severity==="high"?"text-orange-500":"text-amber-500"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{p.code}</span>
              <span className="text-sm font-semibold">{p.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{SCENARIO_LABEL[p.scenario_type]}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">v{p.version}</span>
            </div>
            {p.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{p.description}</p>}
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              {p.estimated_duration_min && <span>⏱ ~{p.estimated_duration_min} min</span>}
              {p.last_reviewed && <span>📅 Rev. {fmtDate(p.last_reviewed)}</span>}
              {p.reviewed_by && <span>👤 {p.reviewed_by}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-4">
          {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}

          {p.immediate_actions && p.immediate_actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <ListOrdered className="h-3.5 w-3.5 text-accent"/>Acciones Inmediatas
              </h4>
              <ol className="space-y-1">
                {p.immediate_actions.map((a,i)=>(
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent mt-0.5">{i+1}</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {p.notification_chain && p.notification_chain.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-accent"/>Cadena de Notificación
                </h4>
                <ol className="space-y-1">
                  {p.notification_chain.map((n,i)=>(
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 h-4 w-4 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold flex items-center justify-center">{i+1}</span>
                      {n}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {p.ppe_required && p.ppe_required.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-accent"/>EPP Requerido
                </h4>
                <ul className="space-y-0.5">
                  {p.ppe_required.map((e,i)=>(
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0"/>{e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {p.evacuation_zone && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              🚨 Zona de exclusión: {p.evacuation_zone}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DrillCard ──────────────────────────────────────────────────────────────
function DrillCard({ d }: { d: Drill }) {
  const [open, setOpen] = useState(false);
  const rc = RATING_CFG[d.overall_rating] ?? RATING_CFG.satisfactory;
  return (
    <div className={`rounded-lg border ${rc.color.split(" ").find(c=>c.startsWith("border-")) ?? "border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-accent" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{fmtDate(d.drill_date)}</span>
              <span className="text-xs text-muted-foreground">— {DRILL_TYPE_LABEL[d.drill_type]}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${rc.color}`}>{rc.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.scenario}</p>
            <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
              <span>👥 {d.participants_count} participantes</span>
              {d.duration_min && <span>⏱ {d.duration_min} min</span>}
              {d.coordinator && <span>👤 {d.coordinator}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          <p className="text-sm text-muted-foreground">{d.scenario}</p>
          {d.strengths && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 mb-1">✅ Fortalezas:</p>
              <p className="text-xs">{d.strengths}</p>
            </div>
          )}
          {d.improvement_areas && (
            <div>
              <p className="text-xs font-semibold text-amber-600 mb-1">⚠️ Áreas de mejora:</p>
              <p className="text-xs">{d.improvement_areas}</p>
            </div>
          )}
          {d.corrective_actions && d.corrective_actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">📋 Acciones correctivas:</p>
              <ul className="space-y-0.5">
                {d.corrective_actions.map((a,i)=><li key={i} className="text-xs flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>{a}</li>)}
              </ul>
            </div>
          )}
          {d.next_drill_date && <p className="text-xs text-muted-foreground">Próximo simulacro: {fmtDate(d.next_drill_date)}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function EmergencyPage() {
  const [data, setData] = useState<EmergencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"procedures"|"contacts"|"equipment"|"drills">("procedures");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/emergency");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="p-8 text-muted-foreground">Error cargando datos.</p>;

  const { procedures, contacts, equipment, drills, stats } = data;
  const daysSinceLastDrill = daysSince(stats.last_drill);
  const drillWarning = daysSinceLastDrill !== null && daysSinceLastDrill > 365;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Flame className="h-5 w-5 text-red-500"/>Plan de Contingencia Radiológica</h1>
          <p className="text-sm text-muted-foreground">Procedimientos de emergencia · Contactos · Equipamiento · Simulacros</p>
        </div>
      </div>

      {/* Alertas */}
      {(drillWarning || stats.equipment_out > 0 || stats.equipment_overdue > 0) && (
        <div className="flex flex-col gap-2">
          {drillWarning && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">Último simulacro hace {daysSinceLastDrill} días — se recomienda al menos 1 simulacro anual</p>
            </div>
          )}
          {stats.equipment_out > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{stats.equipment_out} equipo(s) de emergencia fuera de servicio</p>
            </div>
          )}
          {stats.equipment_overdue > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">{stats.equipment_overdue} equipo(s) con inspección vencida</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Procedimientos",      value: stats.procedures_count,  icon: Radio,    color:"" },
          { label:"Contactos emergencia",value: stats.contacts_count,    icon: Phone,    color:"" },
          { label:"Equipos disponibles", value: `${stats.equipment_total - stats.equipment_out}/${stats.equipment_total}`,icon:Package,color: stats.equipment_out>0?"text-red-600":"" },
          { label:"Simulacros año",      value: stats.drills_last_year,  icon: ClipboardCheck, color: drillWarning?"text-amber-600":"" },
        ].map(k=>{
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3">
              <Icon className="h-5 w-5 text-accent shrink-0" />
              <div>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([
          ["procedures","Procedimientos",String(procedures.length)],
          ["contacts","Contactos",String(contacts.length)],
          ["equipment","Equipamiento",String(equipment.length)],
          ["drills","Simulacros",String(drills.length)],
        ] as const).map(([t,label,count])=>(
          <button key={t} onClick={()=>setTab(t as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab===t?"border-accent text-accent":"border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
            <span className="rounded-full bg-muted px-1.5 text-[10px]">{count}</span>
          </button>
        ))}
      </div>

      {/* Procedures */}
      {tab === "procedures" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Ordenados por severidad (extrema → baja)</p>
          {procedures.map(p=><ProcedureCard key={p.id} p={p}/>)}
        </div>
      )}

      {/* Contacts */}
      {tab === "contacts" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">En orden de notificación</p>
          {contacts.map(c=>(
            <div key={c.id} className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">{c.contact_order}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.role}</span>
                  {c.organization && <span className="text-[10px] text-muted-foreground">· {c.organization}</span>}
                </div>
                <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{c.phone_primary}</span>
                  {c.phone_secondary && <span>{c.phone_secondary}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${c.availability==="24/7"?"bg-emerald-100 text-emerald-700":"bg-muted text-muted-foreground"}`}>
                {AVAIL_LABEL[c.availability]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Equipment */}
      {tab === "equipment" && (
        <div className="flex flex-col gap-2">
          {equipment.map(e=>{
            const cc = CONDITION_CFG[e.condition] ?? CONDITION_CFG.good;
            const inspOverdue = isPast(e.next_inspection);
            return (
              <div key={e.id} className={`flex items-center gap-4 rounded-lg border ${inspOverdue?"border-red-300 bg-red-50/40":e.condition==="out_of_service"?"border-red-300 bg-red-50/40":"border-border bg-surface"} px-4 py-3`}>
                <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{e.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cc.color}`}>{cc.label}</span>
                    <span className="text-[10px] text-muted-foreground">{EQUIP_TYPE_LABEL[e.equipment_type]}</span>
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>📍 {e.location}</span>
                    <span>{e.quantity} {e.unit}</span>
                    {e.next_inspection && <span className={inspOverdue?"text-red-600 font-medium":""}>{inspOverdue?"⚠️ Insp. vencida":"Próx. insp."} {fmtDate(e.next_inspection)}</span>}
                    {e.responsible && <span>👤 {e.responsible}</span>}
                  </div>
                </div>
                {inspOverdue && <AlertCircle className="h-4 w-4 text-red-500 shrink-0"/>}
              </div>
            );
          })}
        </div>
      )}

      {/* Drills */}
      {tab === "drills" && (
        <div className="flex flex-col gap-3">
          {drills.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
              <p className="text-sm text-muted-foreground">Sin simulacros registrados</p>
            </div>
          ) : drills.map(d=><DrillCard key={d.id} d={d}/>)}
          {stats.last_drill && (
            <p className="text-xs text-muted-foreground text-center">
              Último simulacro: {fmtDate(stats.last_drill)} ({daysSinceLastDrill} días)
            </p>
          )}
        </div>
      )}

      {/* Normativa */}
      <div className="rounded-md bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
        Normativa: DS 3/1985 Arts. 46-55 · IAEA GSR Part 7 — Preparación y Respuesta para Emergencias Nucleares o Radiológicas (2015) · OIEA EPR-Medical 2010 · DS 594/1999 (Ambientes de Trabajo)
      </div>
    </div>
  );
}
