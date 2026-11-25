"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Star, X,
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

// ── types ──────────────────────────────────────────────────────────────────
interface VendorService {
  id: number; service_code: string; service_type: string; description: string | null;
  expiry_date: string | null; status: string; last_service: string | null; next_service: string | null;
}
interface Vendor {
  id: number; vendor_code: string; name: string; rut: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  vendor_type: string; services: string | null;
  cchen_authorized: boolean; cchen_auth_number: string | null; cchen_auth_expiry: string | null;
  iso_certified: boolean; iso_cert_number: string | null;
  status: string; evaluation_score: number | null;
  last_evaluation: string | null; next_evaluation: string | null;
  observations: string | null; cchen_expired: boolean; eval_overdue: boolean;
  services_list: VendorService[];
}
interface Stats {
  total:number; cchen_authorized:number; cchen_expired:number; iso_certified:number;
  eval_overdue:number; avg_score:number;
}

// ── config ─────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string,string> = {
  regulatory:"Regulador/CCHEN", calibration:"Calibración", equipment:"Equipo/Mantención",
  transport:"Transporte", waste:"Residuos", dosimetry:"Dosimetría", service:"Servicio general", other:"Otro",
};
const TYPE_COLOR: Record<string,string> = {
  regulatory:"bg-purple-100 text-purple-700", calibration:"bg-blue-100 text-blue-700",
  equipment:"bg-cyan-100 text-cyan-700", transport:"bg-orange-100 text-orange-700",
  waste:"bg-red-100 text-red-700", dosimetry:"bg-indigo-100 text-indigo-700",
  service:"bg-gray-100 text-gray-700",
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
}
function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score>=90?"text-emerald-600":score>=70?"text-amber-600":"text-red-600";
  return <span className={`font-bold text-sm ${color}`}>{score}/100</span>;
}

// ── VendorCard ─────────────────────────────────────────────────────────────
function VendorCard({ v, onEdit }: { v:Vendor; onEdit:(v:Vendor)=>void }) {
  const [open, setOpen] = useState(false);
  const tc = TYPE_COLOR[v.vendor_type] ?? TYPE_COLOR.service;
  const hasIssue = v.cchen_expired || v.eval_overdue;

  return (
    <div className={`rounded-lg border ${hasIssue?"border-orange-300":v.cchen_authorized?"border-blue-200":"border-border"} bg-surface overflow-hidden`}>
      <button onClick={()=>setOpen(o=>!o)} className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <Building2 className={`h-4 w-4 mt-0.5 shrink-0 ${v.cchen_authorized?"text-blue-500":"text-muted-foreground"}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{v.vendor_code}</span>
              <span className="text-sm font-semibold">{v.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tc}`}>{TYPE_LABEL[v.vendor_type]??v.vendor_type}</span>
              {v.cchen_authorized && !v.cchen_expired && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">✓ CCHEN auth.</span>}
              {v.cchen_expired && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">⚠ Auth. CCHEN vencida</span>}
              {v.iso_certified && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">ISO cert.</span>}
              {v.eval_overdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">Eval. pendiente</span>}
              {v.evaluation_score != null && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="h-3 w-3 text-amber-400"/>
                  <ScoreBar score={v.evaluation_score}/>
                </div>
              )}
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
              {v.contact_name && <span>👤 {v.contact_name}</span>}
              {v.contact_email && <span>✉ {v.contact_email}</span>}
              {v.cchen_auth_number && <span>CCHEN: {v.cchen_auth_number}</span>}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {v.services && (
            <div>
              <p className="text-xs font-semibold mb-1">Servicios prestados:</p>
              <p className="text-xs text-muted-foreground">{v.services}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {v.rut && <div><span className="text-muted-foreground">RUT: </span>{v.rut}</div>}
            {v.contact_phone && <div><span className="text-muted-foreground">Tel.: </span>{v.contact_phone}</div>}
            {v.cchen_auth_expiry && <div><span className="text-muted-foreground">Auth. CCHEN vence: </span><span className={v.cchen_expired?"text-red-600 font-semibold":""}>{fmtDate(v.cchen_auth_expiry)}</span></div>}
            {v.iso_cert_number && <div><span className="text-muted-foreground">Cert. ISO: </span>{v.iso_cert_number}</div>}
            {v.last_evaluation && <div><span className="text-muted-foreground">Última evaluación: </span>{fmtDate(v.last_evaluation)}</div>}
            {v.next_evaluation && <div><span className="text-muted-foreground">Próxima evaluación: </span><span className={v.eval_overdue?"text-orange-600 font-semibold":""}>{fmtDate(v.next_evaluation)}</span></div>}
          </div>
          {v.services_list?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5">Contratos / servicios vigentes:</p>
              <div className="flex flex-col gap-1">
                {v.services_list.map((s:VendorService)=>{
                  const isExpired = s.expiry_date && new Date(s.expiry_date)<new Date();
                  return (
                    <div key={s.id} className={`rounded px-2 py-1.5 text-xs ${isExpired?"bg-red-50 border border-red-200":"bg-muted/30"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] text-muted-foreground">{s.service_code}</span>
                        {isExpired && <span className="text-[9px] text-red-600 font-semibold">VENCIDO</span>}
                      </div>
                      <p>{s.description}</p>
                      <div className="flex gap-2 text-muted-foreground mt-0.5">
                        {s.last_service && <span>Último: {fmtDate(s.last_service)}</span>}
                        {s.next_service && <span>Próximo: {fmtDate(s.next_service)}</span>}
                        {s.expiry_date && <span>Contrato vence: {fmtDate(s.expiry_date)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {v.observations && <p className="text-xs text-muted-foreground italic">{v.observations}</p>}
          <div className="flex gap-2 pt-1 border-t border-border/40 flex-wrap">
            <RowPdfActions module="vendors" ownerType="vendor" ownerId={String(v.id)} size="xs" />
            <button onClick={()=>onEdit(v)} className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded hover:opacity-90">Editar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
function VendorModal({ v, onClose, onSave }: { v:Partial<Vendor>|null; onClose:()=>void; onSave:(d:Partial<Vendor>)=>void }) {
  const [form, setForm] = useState<Partial<Vendor>>({
    vendor_type:"service", status:"active", cchen_authorized:false, iso_certified:false, ...v,
  });
  const set = (k: keyof Vendor, val: string|boolean|number) => setForm(f=>({...f,[k]:val}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">{v?.id?"Editar proveedor":"Registrar proveedor"}</h2>
          <button onClick={onClose}><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs">Nombre / Razón social *
              <input value={form.name??""} onChange={e=>set("name",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">RUT
              <input value={form.rut??""} onChange={e=>set("rut",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" placeholder="76.123.456-7"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Tipo
              <select value={form.vendor_type??""} onChange={e=>set("vendor_type",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm">
                {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Contacto
              <input value={form.contact_name??""} onChange={e=>set("contact_name",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Email
              <input type="email" value={form.contact_email??""} onChange={e=>set("contact_email",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs">Servicios prestados
              <textarea value={form.services??""} onChange={e=>set("services",e.target.value)}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm" rows={2}/>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.cchen_authorized} onChange={e=>set("cchen_authorized",e.target.checked)} className="h-4 w-4"/>
              Autorizado por CCHEN
            </label>
            {form.cchen_authorized && (<>
              <label className="flex flex-col gap-1 text-xs">N° autorización CCHEN
                <input value={form.cchen_auth_number??""} onChange={e=>set("cchen_auth_number",e.target.value)}
                  className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
              </label>
              <label className="flex flex-col gap-1 text-xs">Vencimiento autorización
                <input type="date" value={form.cchen_auth_expiry??""} onChange={e=>set("cchen_auth_expiry",e.target.value)}
                  className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
              </label>
            </>)}
            <label className="flex flex-col gap-1 text-xs">Puntuación evaluación (0-100)
              <input type="number" min={0} max={100} value={form.evaluation_score??""} onChange={e=>set("evaluation_score",Number(e.target.value))}
                className="rounded border border-border bg-muted/20 px-2 py-1.5 text-sm"/>
            </label>
            <label className="flex flex-col gap-1 text-xs">Próxima evaluación
              <input type="date" value={form.next_evaluation??""} onChange={e=>set("next_evaluation",e.target.value)}
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const [data, setData] = useState<{ rows:Vendor[]; stats:Stats }|null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Vendor>|null|false>(false);
  const [filterType, setFilterType] = useState("");
  const [filterCchen, setFilterCchen] = useState("");

  const load = useCallback(async (t=filterType, c=filterCchen) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (t) p.set("type",t);
    if (c) p.set("cchen",c);
    const res = await fetch(`/api/vendors?${p}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterType, filterCchen]);

  useEffect(()=>{ load(); },[load]);

  const handleSave = async (form: Partial<Vendor>) => {
    const method = form.id ? "PATCH" : "POST";
    await fetch("/api/vendors", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setModal(false); load();
  };

  if (loading && !data) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
  const st = data?.stats;
  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-5 p-6">
      {modal !== false && (
        <VendorModal v={modal} onClose={()=>setModal(false)} onSave={handleSave}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-accent"/>Gestión de Proveedores Radiológicos</h1>
          <p className="text-sm text-muted-foreground">CCHEN NS-06.0 — Proveedores de servicios, calibración y transporte de material radiactivo · Código PROV-NNN</p>
        </div>
        <button onClick={()=>setModal(null)} className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm hover:opacity-90">
          <Plus className="h-4 w-4"/>Agregar proveedor
        </button>
      </div>

      {/* Alertas */}
      {st && (Number(st.cchen_expired)>0 || Number(st.eval_overdue)>0) && (
        <div className="flex flex-col gap-2">
          {Number(st.cchen_expired)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0"/>
              <p className="text-sm text-red-700"><strong>{st.cchen_expired} proveedor(es)</strong> con autorización CCHEN vencida — no deben operar hasta renovar</p>
            </div>
          )}
          {Number(st.eval_overdue)>0 && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0"/>
              <p className="text-sm text-orange-700"><strong>{st.eval_overdue} proveedor(es)</strong> con evaluación de desempeño pendiente</p>
            </div>
          )}
        </div>
      )}

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="vendors"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label:"Total proveedores",  value:st.total },
            { label:"Auth. CCHEN",        value:st.cchen_authorized, color:"text-blue-600" },
            { label:"Auth. CCHEN vencida",value:st.cchen_expired,    color: st.cchen_expired>0?"text-red-600":"text-muted-foreground" },
            { label:"Certificados ISO",   value:st.iso_certified,    color:"text-purple-600" },
            { label:"Eval. pendiente",    value:st.eval_overdue,     color: st.eval_overdue>0?"text-orange-600":"" },
            { label:"Puntuación promedio",value:`${st.avg_score??0}/100`,color: (st.avg_score??0)>=80?"text-emerald-600":"text-amber-600" },
          ].map(k=>(
            <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
              <p className={`text-2xl font-bold ${k.color??""}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);load(e.target.value,filterCchen);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterCchen} onChange={e=>{setFilterCchen(e.target.value);load(filterType,e.target.value);}}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <option value="">Auth. CCHEN: todos</option>
          <option value="true">Autorizados CCHEN</option>
          <option value="false">Sin autorización CCHEN</option>
        </select>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Sin proveedores registrados</p>
          </div>
        ) : rows.map(v=><VendorCard key={v.id} v={v} onEdit={v=>setModal(v)}/>)}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500"/>
        <p className="text-[10px] text-muted-foreground">
          Normativa: CCHEN NS-06.0 (Gestión de proveedores) · DS 3/1985 (autorizaciones CCHEN) · IAEA SSR-6 (transporte) · Evaluación anual requerida
        </p>
      </div>
    </div>
  );
}
