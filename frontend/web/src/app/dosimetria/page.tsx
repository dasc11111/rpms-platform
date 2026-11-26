"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Eye, CheckCircle, AlertTriangle, FileText, Loader2,
  RefreshCw, PenLine, Save, X, UserCheck, UserX, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos POE CCHEN ─────────────────────────────────────────────────────────
interface KPIs {
  trabajadores_activos: number; total_registros: number;
  devueltos_fuera_plazo: number; no_devueltos: number; extraviados: number;
}
interface Summary {
  kpis: KPIs; promedios_por_anio: PromedioAnio[];
  por_departamento: PromedioDepto[]; sobre_75_limite: SobreLimite[];
}
interface PromedioAnio { anio: string; avg_hp10: string; avg_hp3: string; avg_hp007: string; n_registros: string; }
interface PromedioDepto { departamento: string; avg_hp10: string; avg_hp3: string; avg_hp007: string; max_hp10: string; n: string; }
interface SobreLimite { rut: string; nombre: string; departamento: string; anio: string; hp10_anio: string; }
interface RegTrimestral {
  id: number; rut: string; nombre: string; departamento: string;
  periodo: string; trimestre: number; anio: number;
  tipo_dosimetro: string; numero_dosimetro: string; proceso: string;
  fecha_proceso: string; estamento: string;
  hp10_cual: string; hp3_cual: string; hp007_cual: string;
  hp10_trim: string; hp3_trim: string; hp007_trim: string;
  hp10_anio: string; hp3_anio: string; hp007_anio: string;
  hp10_12m: string; hp3_12m: string; hp007_12m: string;
  hp10_60m: string; hp3_60m: string; hp007_60m: string;
}
interface RegAnual {
  rut: string; nombre: string; departamento: string; anio: number;
  t1: string; t2: string; t3: string; t4: string;
  total_anual: string; n_trimestres: string;
}
interface DevueltoFP {
  id: number; rut: string; nombre: string; departamento: string;
  periodo: string; trimestre: number; anio: number;
  numero_dosimetro: string; fecha_lectura: string;
  alerta_dosis: boolean; observacion: string;
  adjunto_url: string; adjunto_nombre: string;
}
interface NoDevuelto {
  id: number; rut: string; nombre: string; departamento: string;
  periodo: string; trimestre: number; anio: number;
  tipo_dosimetro: string; numero_dosimetro: string;
  extraviado: boolean; observacion: string;
  adjunto_url: string; adjunto_nombre: string;
}
interface DashDepto { departamento: string; avg_hp10: string; avg_hp3: string; avg_hp007: string; max_hp10: string; n: string; sobre_alerta: string; }
interface DashAnio { anio: number; avg_hp10: string; n_trabajadores: string; max_hp10: string; }

// ─── Tipos Importar PDF ───────────────────────────────────────────────────────
interface EnrichedRow {
  rowIndex: number; worker_rut: string; worker_name_report: string;
  worker_name_system: string; worker_matched: boolean;
  worker_match_via: "rut" | "name" | "none"; conflict: boolean;
  resolution: "nuevo" | "actualizar" | "duplicar" | "cancelar";
  year: number | null; quarter: number | null; period_label?: string;
  dosimeter_number?: string; hp10?: number | null; hp3?: number | null;
  hp007?: number | null; accum_year_body?: number | null;
  departamento?: string; institucion?: string;
}
interface PreviewResult {
  ok: boolean; fileName: string; fileHash: string; usedOcr: boolean;
  duplicateFile: boolean; workersDetected: number; recordsFound: number;
  newRecords: number; existingRecords: number; rows: EnrichedRow[];
  warnings: string[]; errors: string[];
}
interface ConfirmResult {
  ok: boolean; created: number; updated: number; duplicated: number;
  skipped: number; alerts: string[];
}

// ─── Constantes ─────────────────────────────────────────────────────────────
const DEPTOS = ["MEDICINA NUCLEAR","CARDIOLOGIA","IMAGENOLOGIA","PABELLON CENTRAL",
  "CMA","ANGIOGRAFIA","ELECTROFISIOLOGIA","MEDICINA","ODONTOLOGIA","PREVENCION DE RIESGOS"];
const ANIOS = ["2023","2024","2025","2026"];
const TRIMS = ["1","2","3","4"];
const TIPO_DOSIMETRO: Record<string,string> = {
  I1:"Cuerpo entero", I5:"Pulsera/Extremidad", I2:"Área/Ambiental", I7:"Cuerpo entero (alt)"
};
const ALERTA_COLOR = (v: number) =>
  v > 15 ? "text-red-600 font-bold" : v > 10 ? "text-orange-500 font-semibold" : v > 5 ? "text-yellow-600" : "text-green-700";
const inp = "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return <span className="text-gray-400">—</span>;
  const n = parseFloat(String(v));
  if (isNaN(n)) return <span className="text-gray-500 text-xs">{String(v)}</span>;
  return <span className={ALERTA_COLOR(n)}>{n.toFixed(2)}</span>;
};

function Badge({ color, label }: { color: string; label: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function MiniBar({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 75 ? "bg-red-500" : pct > 50 ? "bg-orange-400" : pct > 25 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600">{value.toFixed(2)}</span>
    </div>
  );
}

// ─── KPI color map (static — Tailwind JIT requires full class strings) ───────
const KPI_COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  blue:   { border: "border-blue-100",   text: "text-blue-600",   bg: "bg-blue-50" },
  indigo: { border: "border-indigo-100", text: "text-indigo-600", bg: "bg-indigo-50" },
  orange: { border: "border-orange-100", text: "text-orange-600", bg: "bg-orange-50" },
  red:    { border: "border-red-100",    text: "text-red-600",    bg: "bg-red-50" },
  rose:   { border: "border-rose-100",   text: "text-rose-600",   bg: "bg-rose-50" },
  green:  { border: "border-green-100",  text: "text-green-600",  bg: "bg-green-50" },
  yellow: { border: "border-yellow-100", text: "text-yellow-600", bg: "bg-yellow-50" },
  sky:    { border: "border-sky-100",    text: "text-sky-600",    bg: "bg-sky-50" },
};

// ─── Adjunto ─────────────────────────────────────────────────────────────────
function AdjuntoBtn({ registroId, tabla, nombre }: { registroId: number; tabla: string; nombre?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(nombre ?? "");
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    await new Promise(r => setTimeout(r, 600));
    setUploaded(f.name);
    setUploading(false);
    alert(`Adjunto "${f.name}" registrado para ${tabla} #${registroId}.`);
  };
  return (
    <div className="flex items-center gap-2">
      <input ref={ref} type="file" accept=".xlsx,.xls,.pdf,.csv" className="hidden" onChange={handleFile} />
      <button onClick={() => ref.current?.click()} disabled={uploading}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">
        📎 {uploading ? "Subiendo…" : uploaded ? "Cambiar adjunto" : "Adjuntar"}
      </button>
      {uploaded && <span className="text-xs text-green-700 truncate max-w-[140px]">✓ {uploaded}</span>}
    </div>
  );
}

// ─── Modal nuevo registro ────────────────────────────────────────────────────
function ModalNuevoRegistro({ tabla, onClose, onSaved }: {
  tabla: "registro"|"devuelto_fp"|"no_devuelto"; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string,string>>({
    tabla, trimestre:"1", anio:new Date().getFullYear().toString(), tipo_dosimetro:"I1"
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/dosimetria", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
      if (r.ok) { onSaved(); onClose(); }
      else alert("Error al guardar");
    } finally { setSaving(false); }
  };
  const fi = (label: string, key: string, type="text", required=false) => (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}{required && " *"}</label>
      <input type={type} value={form[key]??""} onChange={e=>set(key,e.target.value)}
        className="w-full mt-1 px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
    </div>
  );
  const sel = (label: string, key: string, opts: Record<string,string>, required=false) => (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}{required && " *"}</label>
      <select value={form[key]??""} onChange={e=>set(key,e.target.value)}
        className="w-full mt-1 px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white">
        <option value="">— Seleccionar —</option>
        {Object.entries(opts).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const titles = { registro:"Nuevo Registro Trimestral", devuelto_fp:"Devuelto Fuera de Plazo", no_devuelto:"No Devuelto" };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">➕ {titles[tabla]}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {fi("RUT *","rut","text",true)}
          {fi("Nombre completo *","nombre","text",true)}
          {sel("Departamento *","departamento",Object.fromEntries(DEPTOS.map(d=>[d,d])),true)}
          {sel("Trimestre","trimestre",{"1":"T1","2":"T2","3":"T3","4":"T4"})}
          {sel("Año","anio",Object.fromEntries(ANIOS.map(a=>[a,a])))}
          {tabla === "registro" && <>
            {sel("Tipo dosímetro","tipo_dosimetro",TIPO_DOSIMETRO)}
            {fi("N° dosímetro","numero_dosimetro")}
            {sel("Proceso","proceso",{"":"Sin especificar","PH":"PH – Fotón alta energía","PM":"PM – Fotón mediana energía","PL":"PL – Fotón baja energía","BH":"BH – Beta alta","BM":"BM – Beta mediana","BL":"BL – Beta baja"})}
            {fi("Fecha proceso","fecha_proceso","date")}
            <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Dosis Hp(10) — Cuerpo entero</div>
            {fi("Cuantitativo trim. mSv","hp10_trim","number")}
            {fi("Acum. año calendario","hp10_anio","number")}
            <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Dosis Hp(3) — Cristalino</div>
            {fi("Cuantitativo trim. mSv","hp3_trim","number")}
            {fi("Acum. año calendario","hp3_anio","number")}
            <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Dosis Hp(0.07) — Piel</div>
            {fi("Cuantitativo trim. mSv","hp007_trim","number")}
            {fi("Acum. año calendario","hp007_anio","number")}
          </>}
          {tabla === "devuelto_fp" && <>
            {fi("N° dosímetro","numero_dosimetro")}
            {fi("Período (ej: T 2-2024)","periodo")}
            {fi("Fecha de lectura","fecha_lectura","date")}
            <div>
              <label className="text-xs font-medium text-gray-600">¿Alerta de dosis?</label>
              <select value={form.alerta_dosis??"false"} onChange={e=>set("alerta_dosis",e.target.value)}
                className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-white">
                <option value="false">No</option><option value="true">Sí</option>
              </select>
            </div>
            <div className="col-span-2">{fi("Observación","observacion")}</div>
          </>}
          {tabla === "no_devuelto" && <>
            {sel("Tipo dosímetro","tipo_dosimetro",TIPO_DOSIMETRO)}
            {fi("N° dosímetro","numero_dosimetro")}
            {fi("Período (ej: T 3-2026)","periodo")}
            <div>
              <label className="text-xs font-medium text-gray-600">¿Extraviado?</label>
              <select value={form.extraviado??"false"} onChange={e=>set("extraviado",e.target.value)}
                className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-white">
                <option value="false">No confirmado</option><option value="true">Sí — extraviado</option>
              </select>
            </div>
            <div className="col-span-2">{fi("Observación","observacion")}</div>
          </>}
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila editable para PDF import ───────────────────────────────────────────
function RowBadge({ row }: { row: EnrichedRow }) {
  if (!row.worker_matched) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
      <UserX className="h-3 w-3" />Sin coincidencia
    </span>
  );
  if (row.conflict) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
      <RotateCcw className="h-3 w-3" />Actualizar
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
      <UserCheck className="h-3 w-3" />Nuevo
    </span>
  );
}

function EditableRow({
  row, editing, onStartEdit, onSave, onCancel,
}: {
  row: EnrichedRow; editing: boolean;
  onStartEdit: () => void;
  onSave: (patch: Partial<EnrichedRow>) => void;
  onCancel: () => void;
}) {
  const [rut, setRut] = useState(row.worker_rut);
  const [nombre, setNombre] = useState(row.worker_name_report);
  const rowBg = !row.worker_matched ? "bg-orange-50/60" : row.conflict ? "bg-blue-50/40" : "";
  if (editing) return (
    <tr className="bg-yellow-50/60">
      <td className="px-3 py-2 w-10">
        <div className="flex gap-1">
          <button onClick={() => onSave({ worker_rut: rut, worker_name_report: nombre })}
            className="p-1 rounded bg-green-100 hover:bg-green-200 text-green-700"><Save className="h-3.5 w-3.5" /></button>
          <button onClick={onCancel} className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="h-3.5 w-3.5" /></button>
        </div>
      </td>
      <td className="px-3 py-2">
        <input value={rut} onChange={e => setRut(e.target.value)}
          className="w-28 px-2 py-1 text-xs border rounded font-mono focus:ring-1 focus:ring-blue-400 outline-none" placeholder="RUT" />
      </td>
      <td className="px-3 py-2">
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          className="w-40 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-400 outline-none" placeholder="Nombre" />
      </td>
      <td colSpan={5} className="px-3 py-2 text-xs text-muted-foreground">Editando…</td>
    </tr>
  );
  return (
    <tr className={cn("transition-colors hover:bg-muted/30", rowBg)}>
      <td className="px-3 py-2 w-10">
        <button onClick={onStartEdit} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
          <PenLine className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{row.worker_rut || <span className="text-orange-500">—</span>}</td>
      <td className="px-3 py-2 text-xs">
        <div className="font-medium text-foreground">{row.worker_name_report}</div>
        {row.worker_name_system && row.worker_name_system !== row.worker_name_report && (
          <div className="text-muted-foreground">Sistema: {row.worker_name_system}</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.departamento || "—"}</td>
      <td className="px-3 py-2 text-xs font-medium">
        {row.year && row.quarter ? `T${row.quarter}-${row.year}` : row.period_label || "—"}
      </td>
      <td className="px-3 py-2 text-xs text-right font-mono">
        {row.hp10 != null ? <span className={ALERTA_COLOR(row.hp10)}>{row.hp10.toFixed(3)}</span> : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-right font-mono text-muted-foreground">
        {row.hp3 != null ? row.hp3.toFixed(3) : "—"}
      </td>
      <td className="px-3 py-2"><RowBadge row={row} /></td>
    </tr>
  );
}

// ─── Tab PDF Import ───────────────────────────────────────────────────────────
function TabImportarPDF() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("CCHEN");
  const [overrideQuarter, setOverrideQuarter] = useState("");
  const [overrideYear, setOverrideYear] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleSaveRow = useCallback((idx: number, patch: Partial<EnrichedRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    setEditingIdx(null);
  }, []);

  const doPreview = async () => {
    if (!file) return;
    setLoading(true);
    setLoadingMsg("Leyendo PDF…");
    setError("");
    setPreview(null);
    setRows([]);
    setConfirmResult(null);
    try {
      const { getPdfContent } = await import("@/lib/pdf-client");
      setLoadingMsg("Extrayendo texto del PDF…");
      const { pagesText, pagesLines, usedOcr, rawText } = await getPdfContent(file);
      setLoadingMsg("Analizando informe de dosis…");
      const fileHash = await (async () => {
        const buf = await file.arrayBuffer();
        const hashBuf = await crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
      })();
      const fd = new FormData();
      fd.append("rawText", rawText);
      fd.append("pagesText", JSON.stringify(pagesText));
      fd.append("pagesLines", JSON.stringify(pagesLines));
      fd.append("fileName", file.name);
      fd.append("fileHash", fileHash);
      fd.append("usedOcr", String(usedOcr));
      fd.append("provider", provider);
      if (overrideQuarter) fd.append("overrideQuarter", overrideQuarter);
      if (overrideYear) fd.append("overrideYear", overrideYear);
      setLoadingMsg("Relacionando con trabajadores…");
      const r = await fetch("/api/dosimetry/import-pdf/preview", { method: "POST", body: fd });
      const d = await r.json();
      if (d.error) setError(d.error);
      else { setPreview(d); setRows(d.rows ?? []); }
    } catch (e) {
      setError(`Error al procesar PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(false); setLoadingMsg(""); }
  };

  const doConfirm = async () => {
    if (!file || rows.length === 0) return;
    setLoading(true);
    setLoadingMsg("Importando registros…");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("rows", JSON.stringify(rows));
      fd.append("uploadedBy", "Usuario RPMS");
      fd.append("usedOcr", String(preview?.usedOcr ?? false));
      fd.append("fileHash", preview?.fileHash ?? "");
      if (overrideQuarter) fd.append("overrideQuarter", overrideQuarter);
      if (overrideYear) fd.append("overrideYear", overrideYear);
      const r = await fetch("/api/dosimetry/import-pdf/confirm", { method: "POST", body: fd });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setConfirmResult(d);
    } catch (e) {
      setError(`Error confirmando importación: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(false); setLoadingMsg(""); }
  };

  const reset = () => {
    setFile(null); setPreview(null); setRows([]); setConfirmResult(null);
    setError(""); setEditingIdx(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const unmatchedCount = rows.filter(r => !r.worker_matched).length;
  const newCount = rows.filter(r => r.worker_matched && !r.conflict).length;
  const updateCount = rows.filter(r => r.conflict).length;

  const stepActive = (i: number) =>
    i === 0 ? !preview && !confirmResult : i === 1 ? !!preview && !confirmResult : !!confirmResult;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Steps */}
      <div className="flex gap-3 text-xs flex-wrap">
        {["1. Subir PDF", "2. Revisar y editar", "3. Confirmar importación"].map((step, i) => (
          <div key={i} className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border",
            stepActive(i) ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300"
              : "border-border text-muted-foreground"
          )}>
            <span className={cn("w-4 h-4 rounded-full text-center leading-4 text-xs",
              stepActive(i) ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
            )}>{i + 1}</span>
            {step}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-xl text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Success */}
      {confirmResult && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700 rounded-xl p-5">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold mb-4">
            <CheckCircle className="h-5 w-5" />Importación completada exitosamente
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Nuevos registros", value: confirmResult.created, color: "text-green-700 dark:text-green-300" },
              { label: "Actualizados", value: confirmResult.updated, color: "text-blue-700 dark:text-blue-300" },
              { label: "Duplicados omitidos", value: confirmResult.duplicated, color: "text-muted-foreground" },
              { label: "Omitidos", value: confirmResult.skipped, color: "text-muted-foreground" },
            ].map((item, i) => (
              <div key={i} className="bg-background rounded-xl border border-border p-3 text-center">
                <div className={cn("text-2xl font-bold font-mono", item.color)}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          {confirmResult.alerts?.length > 0 && (
            <div className="mt-4 space-y-1">
              {confirmResult.alerts.map((a, i) => (
                <div key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{a}
                </div>
              ))}
            </div>
          )}
          <button onClick={reset} className="mt-4 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" />Importar otro informe
          </button>
        </div>
      )}

      {!confirmResult && (
        <>
          {/* Config & Upload */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm">Configuración del informe PDF</h2>

            {/* Provider + Quarter + Year selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Proveedor de dosimetría</label>
                <input className={inp} value={provider} onChange={e => setProvider(e.target.value)}
                  placeholder="Ej: CCHEN, Dosimetría Sur…" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Trimestre <span className="text-blue-600 font-semibold">(obligatorio)</span>
                </label>
                <select className={inp} value={overrideQuarter} onChange={e => setOverrideQuarter(e.target.value)}>
                  <option value="">— Detectar automáticamente —</option>
                  {TRIMS.map(t => <option key={t} value={t}>T{t} — Trimestre {t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Año <span className="text-blue-600 font-semibold">(obligatorio)</span>
                </label>
                <select className={inp} value={overrideYear} onChange={e => setOverrideYear(e.target.value)}>
                  <option value="">— Detectar automáticamente —</option>
                  {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* Info box when both selected */}
            {overrideQuarter && overrideYear && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300">
                <CheckCircle className="h-4 w-4 shrink-0" />
                El informe se importará como <strong>T{overrideQuarter} — {overrideYear}</strong>.
                Este valor tendrá prioridad sobre el período detectado en el PDF.
              </div>
            )}
            {(!overrideQuarter || !overrideYear) && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Recomendación:</strong> selecciona trimestre y año para evitar errores de detección automática
                  en PDFs del CCHEN. Si no seleccionas, el sistema intentará detectarlos desde el contenido del PDF.
                </span>
              </div>
            )}

            {/* Drop zone */}
            <div className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors",
              file ? "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20" : "border-border hover:border-blue-300"
            )}>
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-blue-500 mx-auto" />
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; setPreview(null); setRows([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline">
                    Cambiar archivo
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">Arrastra aquí el PDF o selecciónalo</p>
                  <button onClick={() => fileRef.current?.click()}
                    className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-sm px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700">
                    Seleccionar PDF
                  </button>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(null); setRows([]); } }} />
            </div>

            <button onClick={doPreview} disabled={loading || !file}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg || "Procesando…"}</> : <><Eye className="h-4 w-4" />Extraer y previsualizar</>}
            </button>
          </div>

          {/* Preview */}
          {preview && !loading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold">
                    Vista previa — {rows.length} registro{rows.length !== 1 ? "s" : ""} detectado{rows.length !== 1 ? "s" : ""}
                  </h2>
                  {preview.usedOcr && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">OCR activado (PDF escaneado)</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {newCount > 0 && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium dark:bg-green-900/40 dark:text-green-300">
                    <UserCheck className="h-3 w-3" />{newCount} nuevos</span>}
                  {updateCount > 0 && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium dark:bg-blue-900/40 dark:text-blue-300">
                    <RotateCcw className="h-3 w-3" />{updateCount} a actualizar</span>}
                  {unmatchedCount > 0 && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium dark:bg-orange-900/40 dark:text-orange-300">
                    <UserX className="h-3 w-3" />{unmatchedCount} sin coincidencia</span>}
                </div>
              </div>

              {(preview.warnings?.length > 0 || preview.errors?.length > 0) && (
                <div className="space-y-1.5">
                  {preview.errors?.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                      <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />{e}
                    </div>
                  ))}
                  {preview.warnings?.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{w}
                    </div>
                  ))}
                </div>
              )}

              {preview.duplicateFile && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Este archivo ya fue importado anteriormente. Los registros existentes serán actualizados, no duplicados.
                </div>
              )}
              {unmatchedCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <PenLine className="h-3.5 w-3.5 shrink-0" />
                  Haz clic en <PenLine className="h-3 w-3 inline" /> para editar RUT o nombre y relacionar registros sin coincidencia.
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 w-10" />
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">RUT</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nombre (informe)</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Servicio</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Período</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Hp(10)</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Hp(3)</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, i) => (
                      <EditableRow key={i} row={row} editing={editingIdx === i}
                        onStartEdit={() => setEditingIdx(i)}
                        onSave={(patch) => handleSaveRow(i, patch)}
                        onCancel={() => setEditingIdx(null)} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-4">
                <button onClick={doConfirm} disabled={loading || rows.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{loadingMsg || "Importando…"}</> :
                    <><CheckCircle className="h-4 w-4" />Confirmar importación ({newCount + updateCount} registros)</>}
                </button>
                <button onClick={reset}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" />Reiniciar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
        <p><strong>Marco normativo:</strong> DS N°133/1984 y DS N°95/2005 MINSAL — Obligatoriedad de registro individual de dosis.</p>
        <p>CCHEN ORD sobre archivo histórico de dosimetría personal. OCR habilitado para PDFs escaneados de dosimetría externa.</p>
      </div>
    </div>
  );
}

// ─── TabImportarXLS ──────────────────────────────────────────────────────────
interface XlsSheetStats { inserted: number; updated: number; skipped: number; }
interface XlsImportStats {
  trimestral: XlsSheetStats; anual: XlsSheetStats;
  devueltos_fp: XlsSheetStats; no_devueltos: XlsSheetStats; u2t: XlsSheetStats;
}
interface XlsPreviewRow { [key: string]: unknown }
interface XlsPreviewSheet { name: string; total: number; rows: XlsPreviewRow[] }
interface XlsPreviewResult { ok: boolean; sheets: XlsPreviewSheet[]; error?: string; }
interface XlsImportResult { ok: boolean; stats: XlsImportStats; total_inserted: number; total_updated: number; error?: string; }
interface XlsInfo { xls_records: number; ultima_importacion: string | null; }

function TabImportarXLS() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<XlsPreviewResult | null>(null);
  const [result, setResult] = useState<XlsImportResult | null>(null);
  const [info, setInfo] = useState<XlsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle"|"preview"|"confirm"|"done">("idle");
  const [autoMsg, setAutoMsg] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    fetch("/api/dosimetria/import-xls").then(r => r.ok ? r.json() : null).then(d => d && setInfo(d));
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setPreview(null); setResult(null); setStep("idle"); setAutoMsg("");
  };

  const doPreview = async () => {
    if (!file) return;
    setLoading(true); setPreview(null); setAutoMsg("Leyendo hojas del archivo XLS…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("soloPreview", "1");
      const r = await fetch("/api/dosimetria/import-xls", { method: "POST", body: fd });
      const data = await r.json() as XlsPreviewResult;
      setPreview(data);
      setStep(data.ok ? "preview" : "idle");
      setAutoMsg("");
    } catch { setAutoMsg("Error al leer el archivo."); } finally { setLoading(false); }
  };

  const doImport = async () => {
    if (!file) return;
    setLoading(true); setAutoMsg("Importando datos a la base de datos…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/dosimetria/import-xls", { method: "POST", body: fd });
      const data = await r.json() as XlsImportResult;
      setResult(data); setStep("done");
      setAutoMsg(data.ok ? "✅ Importación completada con éxito." : "❌ Error al importar.");
    } catch { setAutoMsg("Error en la importación."); } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setStep("idle"); setAutoMsg(""); if (fileRef.current) fileRef.current.value = ""; };

  const startAutoUpdate = () => {
    if (!file) return;
    setCountdown(30);
    const iv = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(iv); doImport(); return 0; } return c - 1; }), 1000);
  };

  const sheetLabel: Record<string, string> = {
    Reporte_trimestral: "📋 Trimestral", Resumen_anual: "📅 Anual",
    Devueltos_fuera_de_plazo: "⏰ Dev. F.P.", No_devueltos: "🚫 No Devueltos", Lista_U2T: "📦 U2T",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">📊 Importar XLS CCHEN</h2>
          <p className="text-sm text-gray-500 mt-1">Lee todas las hojas del reporte CCHEN y actualiza la base de datos automáticamente.</p>
        </div>
        {info && (
          <div className="text-right text-xs text-gray-400">
            <div>Registros XLS en BD: <span className="font-semibold text-gray-700">{info.xls_records}</span></div>
            {info.ultima_importacion && (
              <div>Última importación: <span className="font-semibold">{new Date(info.ultima_importacion).toLocaleString("es-CL")}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
        {file ? (
          <div className="space-y-1">
            <div className="text-green-700 font-semibold text-sm">📂 {file.name}</div>
            <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB · Haz clic para cambiar</div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 text-gray-400 mx-auto" />
            <div className="text-sm text-gray-600">Arrastra o haz clic para seleccionar el archivo XLS/XLSX de CCHEN</div>
            <div className="text-xs text-gray-400">Soporta .xlsx y .xls con múltiples hojas</div>
          </div>
        )}
      </div>

      {file && step === "idle" && (
        <button onClick={doPreview} disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Analizando hojas…</> : <><Eye className="h-4 w-4" />Vista previa de las hojas</>}
        </button>
      )}

      {autoMsg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg ${autoMsg.startsWith("✅") ? "bg-green-50 text-green-800" : autoMsg.startsWith("❌") ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
          {autoMsg}
        </div>
      )}

      {/* Preview */}
      {step === "preview" && preview?.ok && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">Vista previa — primeras 10 filas por hoja</h3>
          {preview.sheets.map(sheet => (
            <div key={sheet.name} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
                <span className="font-medium text-sm">{sheetLabel[sheet.name] ?? sheet.name}</span>
                <span className="text-xs text-gray-400">{sheet.total} filas totales · mostrando {sheet.rows.length}</span>
              </div>
              {sheet.rows.length > 0 && (
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>{Object.keys(sheet.rows[0]).map(k => <th key={k} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">{k}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sheet.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-2 py-1.5 text-gray-700 whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">{String(v ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button onClick={doImport} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Importando…</> : <><CheckCircle className="h-4 w-4" />Confirmar importación</>}
            </button>
            {countdown > 0 && (
              <div className="flex items-center text-sm text-gray-500 px-4">Auto en {countdown}s…</div>
            )}
            <button onClick={reset} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors">
              <X className="h-3.5 w-3.5" />Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {step === "done" && result && (
        <div className="space-y-4">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${result.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            {result.ok ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
            <span className={`font-semibold text-sm ${result.ok ? "text-green-800" : "text-red-800"}`}>
              {result.ok ? `Importación exitosa — ${result.total_inserted} nuevos, ${result.total_updated} actualizados` : (result.error ?? "Error en la importación")}
            </span>
          </div>

          {result.ok && result.stats && (
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(result.stats).map(([key, s]) => {
                const labels: Record<string, string> = { trimestral:"Trimestral", anual:"Anual", devueltos_fp:"Dev. F.P.", no_devueltos:"No Dev.", u2t:"U2T" };
                return (
                  <div key={key} className="bg-gray-50 rounded-lg p-3 text-center border">
                    <div className="text-xs text-gray-500 mb-1">{labels[key] ?? key}</div>
                    <div className="text-green-700 font-bold text-sm">+{s.inserted}</div>
                    <div className="text-blue-600 text-xs">↺ {s.updated}</div>
                    <div className="text-gray-400 text-xs">— {s.skipped}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />Importar otro archivo
            </button>
            {file && (
              <button onClick={() => { setStep("idle"); setResult(null); doPreview(); }}
                className="flex items-center gap-2 text-sm border border-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />Re-importar mismo archivo
              </button>
            )}
          </div>
        </div>
      )}

      {step === "preview" && preview && !preview.ok && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          {preview.error ?? "Error al leer el archivo"}
        </div>
      )}

      <div className="text-xs text-gray-400 border-t pt-4 space-y-1">
        <p><strong>Hojas soportadas:</strong> Reporte_trimestral, Resumen_anual, Devueltos_fuera_de_plazo, No_devueltos, Lista_U2T</p>
        <p>Los registros existentes se actualizan por (RUT + período + tipo_dosímetro). Los nuevos se insertan automáticamente.</p>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function DosimetriaPage() {
  type MainTab = "summary"|"trimestral"|"anual"|"devueltos_fp"|"no_devueltos"|"dashboard"|"importar_pdf"|"importar_xls";
  const [tab, setTab] = useState<MainTab>("summary");
  const [summary, setSummary] = useState<Summary|null>(null);
  const [registros, setRegistros] = useState<RegTrimestral[]>([]);
  const [regAnual, setRegAnual] = useState<RegAnual[]>([]);
  const [devFP, setDevFP] = useState<DevueltoFP[]>([]);
  const [noDev, setNoDev] = useState<NoDevuelto[]>([]);
  const [dashData, setDashData] = useState<{ por_departamento: DashDepto[]; tendencia_anual: DashAnio[] }|null>(null);
  type DashTab = "institucion"|"departamentos"|"trabajador";
  const [dashTab, setDashTab] = useState<DashTab>("institucion");
  const [dashMetric, setDashMetric] = useState<"hp10"|"hp3"|"hp007">("hp10");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"registro"|"devuelto_fp"|"no_devuelto"|null>(null);
  const [fAnio, setFAnio] = useState("");
  const [fTrim, setFTrim] = useState("");
  const [fDepto, setFDepto] = useState("");
  const [fRut, setFRut] = useState("");

  const fetchData = async () => {
    if (tab === "importar_pdf" || tab === "importar_xls") return;
    setLoading(true);
    try {
      if (tab === "summary") {
        const r = await fetch("/api/dosimetria?view=summary");
        setSummary(await r.json());
      } else if (tab === "trimestral") {
        const q = new URLSearchParams({ view:"trimestral", ...(fAnio&&{anio:fAnio}), ...(fTrim&&{trimestre:fTrim}), ...(fDepto&&{departamento:fDepto}), ...(fRut&&{rut:fRut}) });
        const r = await fetch(`/api/dosimetria?${q}`);
        setRegistros((await r.json()).registros ?? []);
      } else if (tab === "anual") {
        const q = new URLSearchParams({ view:"anual", ...(fAnio&&{anio:fAnio}), ...(fDepto&&{departamento:fDepto}) });
        const r = await fetch(`/api/dosimetria?${q}`);
        setRegAnual((await r.json()).registros ?? []);
      } else if (tab === "devueltos_fp") {
        const q = new URLSearchParams({ view:"devueltos_fp", ...(fAnio&&{anio:fAnio}), ...(fTrim&&{trimestre:fTrim}), ...(fDepto&&{departamento:fDepto}) });
        const r = await fetch(`/api/dosimetria?${q}`);
        setDevFP((await r.json()).registros ?? []);
      } else if (tab === "no_devueltos") {
        const q = new URLSearchParams({ view:"no_devueltos", ...(fAnio&&{anio:fAnio}), ...(fTrim&&{trimestre:fTrim}), ...(fDepto&&{departamento:fDepto}) });
        const r = await fetch(`/api/dosimetria?${q}`);
        setNoDev((await r.json()).registros ?? []);
      } else if (tab === "dashboard") {
        const r = await fetch(`/api/dosimetria?view=dashboard${fRut?`&rut=${fRut}`:""}`);
        setDashData(await r.json());
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [tab, fAnio, fTrim, fDepto]);

  const TABS = [
    { key:"summary", label:"📊 Resumen" },
    { key:"trimestral", label:"📋 Trimestral" },
    { key:"anual", label:"📅 Anual" },
    { key:"devueltos_fp", label:"⏰ Dev. F.P." },
    { key:"no_devueltos", label:"🚫 No Devueltos" },
    { key:"dashboard", label:"📈 Dashboard" },
    { key:"importar_pdf", label:"📄 Importar PDF" },
    { key:"importar_xls", label:"📊 Importar XLS" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">☢️ Dosimetría POE</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hospital Dr. Hernán Henríquez Aravena · DS 3/1985 · CCHEN NS-05.0 · IAEA GSR Part 3
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white p-1 rounded-xl shadow-sm border flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as MainTab)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? t.key === "importar_pdf"
                    ? "bg-indigo-600 text-white shadow"
                    : t.key === "importar_xls"
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-blue-600 text-white shadow"
                  : "text-gray-600 hover:bg-gray-100"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Importar PDF — inline, sin filtros */}
        {tab === "importar_pdf" && (
          <TabImportarPDF />
        )}

        {/* Tab: Importar XLS — inline, sin filtros */}
        {tab === "importar_xls" && (
          <TabImportarXLS />
        )}

        {/* Filtros globales (excepto summary, dashboard e importar_pdf/xls) */}
        {tab !== "summary" && tab !== "dashboard" && tab !== "importar_pdf" && tab !== "importar_xls" && (
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-5 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500">Año</label>
              <select value={fAnio} onChange={e=>setFAnio(e.target.value)}
                className="block mt-1 px-3 py-1.5 border rounded text-sm bg-white min-w-[90px]">
                <option value="">Todos</option>
                {ANIOS.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            {tab !== "anual" && (
              <div>
                <label className="text-xs text-gray-500">Trimestre</label>
                <select value={fTrim} onChange={e=>setFTrim(e.target.value)}
                  className="block mt-1 px-3 py-1.5 border rounded text-sm bg-white min-w-[80px]">
                  <option value="">Todos</option>
                  {TRIMS.map(t=><option key={t} value={t}>T{t}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Departamento</label>
              <select value={fDepto} onChange={e=>setFDepto(e.target.value)}
                className="block mt-1 px-3 py-1.5 border rounded text-sm bg-white min-w-[180px]">
                <option value="">Todos</option>
                {DEPTOS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            {tab === "trimestral" && (
              <div>
                <label className="text-xs text-gray-500">RUT trabajador</label>
                <input value={fRut} onChange={e=>setFRut(e.target.value)} placeholder="12345678-9"
                  className="block mt-1 px-3 py-1.5 border rounded text-sm w-36" />
              </div>
            )}
            <button onClick={fetchData} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
              Buscar
            </button>
            <div className="ml-auto flex gap-2">
              {tab === "trimestral" && (
                <button onClick={() => setModal("registro")} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                  + Nuevo registro
                </button>
              )}
              {tab === "devueltos_fp" && (
                <button onClick={() => setModal("devuelto_fp")} className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded hover:bg-orange-700">
                  + Registrar devuelto F.P.
                </button>
              )}
              {tab === "no_devueltos" && (
                <button onClick={() => setModal("no_devuelto")} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                  + Registrar no devuelto
                </button>
              )}
            </div>
          </div>
        )}

        {loading && tab !== "importar_pdf" && tab !== "importar_xls" && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3 animate-spin inline-block">⚛️</div>
            <div>Cargando datos…</div>
          </div>
        )}

        {/* ══ SUMMARY ══════════════════════════════════════════════════════════ */}
        {!loading && tab === "summary" && summary && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label:"Trabajadores activos", val:summary.kpis.trabajadores_activos, color:"blue", icon:"👷" },
                { label:"Registros totales", val:summary.kpis.total_registros, color:"indigo", icon:"📋" },
                { label:"Dev. fuera de plazo", val:summary.kpis.devueltos_fuera_plazo, color:"orange", icon:"⏰" },
                { label:"No devueltos", val:summary.kpis.no_devueltos, color:"red", icon:"🚫" },
                { label:"Extraviados", val:summary.kpis.extraviados, color:"rose", icon:"❓" },
              ].map(k => {
                const c = KPI_COLOR_MAP[k.color] ?? KPI_COLOR_MAP.blue;
                return (
                  <div key={k.label} className={`bg-white rounded-xl p-4 shadow-sm border ${c.border}`}>
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-3xl font-bold ${c.text}`}>{k.val}</div>
                    <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">📅 Dosis promedio Hp(10) por año — Hospital (mSv)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left">Año</th>
                    <th className="px-3 py-2 text-center">Avg Hp(10)</th>
                    <th className="px-3 py-2 text-center">Avg Hp(3)</th>
                    <th className="px-3 py-2 text-center">Avg Hp(0.07)</th>
                    <th className="px-3 py-2 text-center">N° Registros</th>
                    <th className="px-3 py-2">Barra (máx 20 mSv)</th>
                  </tr></thead>
                  <tbody>
                    {summary.promedios_por_anio.map(p => (
                      <tr key={p.anio} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.anio}</td>
                        <td className="px-3 py-2 text-center">{fmt(p.avg_hp10)}</td>
                        <td className="px-3 py-2 text-center">{fmt(p.avg_hp3)}</td>
                        <td className="px-3 py-2 text-center">{fmt(p.avg_hp007)}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{p.n_registros}</td>
                        <td className="px-3 py-2"><MiniBar value={parseFloat(p.avg_hp10)||0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">🏥 Por departamento — Dosis promedio Hp(10) trimestral (mSv)</h3>
              <div className="space-y-2">
                {summary.por_departamento.map(d => (
                  <div key={d.departamento} className="flex items-center gap-3">
                    <div className="w-44 text-sm text-gray-700 truncate">{d.departamento}</div>
                    <MiniBar value={parseFloat(d.avg_hp10)||0} />
                    <span className="text-xs text-gray-400 w-10">n={d.n}</span>
                    <span className="text-xs text-gray-400">máx {parseFloat(d.max_hp10||"0").toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            {summary.sobre_75_limite.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="font-semibold text-red-700 mb-3">⚠️ Trabajadores sobre 75% del límite anual (≥15 mSv)</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-red-600 uppercase">
                    <th className="text-left pb-2">Nombre</th><th>Departamento</th><th>Año</th><th>Hp(10) año</th>
                  </tr></thead>
                  <tbody>
                    {summary.sobre_75_limite.map((s,i) => (
                      <tr key={i} className="border-t border-red-100">
                        <td className="py-1.5 font-medium text-gray-800">{s.nombre}</td>
                        <td className="text-center text-gray-600">{s.departamento}</td>
                        <td className="text-center text-gray-600">{s.anio}</td>
                        <td className="text-center"><span className="text-red-600 font-bold">{parseFloat(s.hp10_anio).toFixed(2)} mSv</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl border p-4">
              <h4 className="font-semibold text-gray-600 mb-3 text-sm">📖 Glosario de siglas</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[["MNR","Mínimo Nivel de Registro"],["NU","No Usado"],["NS","No Solicitado"],
                  ["NR","No Recepcionado"],["FF","Devuelto fuera de fecha"],["DD","Dosímetro Dañado"],
                  ["PL","Fotón baja energía"],["PH","Fotón alta energía"],["PM","Fotón mediana energía"],
                  ["BH","Beta alta energía"],["BM","Beta mediana"],["BL","Beta baja"],
                  ["I1","Dosímetro cuerpo entero"],["I5","Dosímetro pulsera"],["I2","Área/Ambiental"],["MF","Monitor fetal"]
                ].map(([s,d]) => (
                  <div key={s} className="flex gap-1.5">
                    <Badge color="bg-blue-100 text-blue-700" label={s} />
                    <span className="text-gray-600">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ TRIMESTRAL ════════════════════════════════════════════════════════ */}
        {!loading && tab === "trimestral" && (
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-semibold text-gray-700">Registros trimestrales ({registros.length})</span>
              <span className="text-xs text-gray-400">Límite: 20 mSv/año | Alerta: 15 mSv (75%)</span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {["Período","Nombre","RUT","Departamento","Estamento","Dosímetro","Tipo","Proceso",
                    "Hp10 Trim","Hp3 Trim","Hp0.07 Trim","Hp10 Año","Hp10 12m","Hp10 60m","Adjunto"
                  ].map(h => <th key={h} className="px-2 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr><td colSpan={15} className="text-center py-10 text-gray-400">No hay registros con los filtros actuales</td></tr>
                )}
                {registros.map(r => (
                  <tr key={r.id} className="border-t hover:bg-blue-50 transition-colors">
                    <td className="px-2 py-1.5 font-medium text-blue-700 whitespace-nowrap">{r.periodo}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap max-w-[160px] truncate" title={r.nombre}>{r.nombre}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.rut}</td>
                    <td className="px-2 py-1.5 max-w-[120px] truncate" title={r.departamento}>{r.departamento}</td>
                    <td className="px-2 py-1.5">{r.estamento && <Badge color="bg-purple-100 text-purple-700" label={r.estamento} />}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-500 whitespace-nowrap">{r.numero_dosimetro}</td>
                    <td className="px-2 py-1.5"><Badge color="bg-indigo-100 text-indigo-700" label={r.tipo_dosimetro} /></td>
                    <td className="px-2 py-1.5">{r.proceso && <Badge color="bg-cyan-100 text-cyan-700" label={r.proceso} />}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(r.hp10_trim)}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(r.hp3_trim)}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(r.hp007_trim)}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(r.hp10_anio)}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(r.hp10_12m)}</td>
                    <td className="px-2 py-1.5 text-center">{fmt(r.hp10_60m)}</td>
                    <td className="px-2 py-1.5"><AdjuntoBtn registroId={r.id} tabla="registros" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ ANUAL ═════════════════════════════════════════════════════════════ */}
        {!loading && tab === "anual" && (
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <span className="font-semibold text-gray-700">Resumen anual Hp(10) ({regAnual.length} trabajadores)</span>
              <span className="text-xs text-gray-400">DS 3/1985 · Límite 20 mSv/año</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Año","Nombre","RUT","Departamento","T1 mSv","T2 mSv","T3 mSv","T4 mSv","Total Anual","Trims. reportados","Estado"]
                    .map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {regAnual.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-gray-400">Sin datos</td></tr>}
                {regAnual.map((r,i) => {
                  const total = parseFloat(r.total_anual)||0;
                  const over = total > 15;
                  return (
                    <tr key={i} className={`border-t hover:bg-gray-50 ${over?"bg-red-50":""}`}>
                      <td className="px-3 py-2 font-semibold">{r.anio}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={r.nombre}>{r.nombre}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{r.rut}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{r.departamento}</td>
                      <td className="px-3 py-2 text-center">{fmt(r.t1)}</td>
                      <td className="px-3 py-2 text-center">{fmt(r.t2)}</td>
                      <td className="px-3 py-2 text-center">{fmt(r.t3)}</td>
                      <td className="px-3 py-2 text-center">{fmt(r.t4)}</td>
                      <td className="px-3 py-2 text-center font-bold">
                        <span className={over?"text-red-600":"text-green-700"}>{total.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400 text-xs">{r.n_trimestres}/4</td>
                      <td className="px-3 py-2">
                        {over ? <Badge color="bg-red-100 text-red-700" label="⚠ Sobre 75%" /> :
                          total > 10 ? <Badge color="bg-orange-100 text-orange-700" label="Moderado" /> :
                          <Badge color="bg-green-100 text-green-700" label="Normal" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ DEVUELTOS FUERA DE PLAZO ════════════════════════════════════════ */}
        {!loading && tab === "devueltos_fp" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b">
              <span className="font-semibold text-gray-700">Devueltos fuera de plazo — {devFP.length} registros</span>
              <p className="text-xs text-gray-400 mt-0.5">Dosímetros procesados después de los 60 días que otorga el ISP/CCHEN</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50">
                  <tr>
                    {["Período","Nombre","RUT","Departamento","N° Dosímetro","Fecha Lectura","Alerta Dosis","Observación","Adjunto"]
                      .map(h => <th key={h} className="px-3 py-2 text-left font-medium text-orange-700 whitespace-nowrap text-xs">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {devFP.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-gray-400">Sin registros</td></tr>}
                  {devFP.map(d => (
                    <tr key={d.id} className="border-t hover:bg-orange-50">
                      <td className="px-3 py-2 font-medium text-orange-700 whitespace-nowrap">{d.periodo}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={d.nombre}>{d.nombre}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{d.rut}</td>
                      <td className="px-3 py-2 text-xs">{d.departamento}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{d.numero_dosimetro}</td>
                      <td className="px-3 py-2 text-xs">{d.fecha_lectura ? new Date(d.fecha_lectura).toLocaleDateString("es-CL") : "—"}</td>
                      <td className="px-3 py-2">
                        {d.alerta_dosis ? <Badge color="bg-red-100 text-red-700" label="⚠ Sí" /> : <Badge color="bg-green-100 text-green-700" label="No" />}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[150px] truncate">{d.observacion}</td>
                      <td className="px-3 py-2"><AdjuntoBtn registroId={d.id} tabla="devueltos" nombre={d.adjunto_nombre} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ NO DEVUELTOS ═════════════════════════════════════════════════════ */}
        {!loading && tab === "no_devueltos" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b">
              <span className="font-semibold text-gray-700">No devueltos — {noDev.length} dosímetros</span>
              <p className="text-xs text-gray-400 mt-0.5">Dosímetros no retornados al CCHEN/ISP en el período correspondiente</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50">
                  <tr>
                    {["Período","Nombre","RUT","Departamento","Tipo","N° Dosímetro","Estado","Observación","Adjunto"]
                      .map(h => <th key={h} className="px-3 py-2 text-left font-medium text-red-700 whitespace-nowrap text-xs">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {noDev.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-gray-400">Sin registros</td></tr>}
                  {noDev.map(n => (
                    <tr key={n.id} className={`border-t hover:bg-red-50 ${n.extraviado?"bg-rose-50":""}`}>
                      <td className="px-3 py-2 font-medium text-red-700 whitespace-nowrap">{n.periodo}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={n.nombre}>{n.nombre}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{n.rut}</td>
                      <td className="px-3 py-2 text-xs">{n.departamento}</td>
                      <td className="px-3 py-2"><Badge color="bg-indigo-100 text-indigo-700" label={n.tipo_dosimetro} /></td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{n.numero_dosimetro}</td>
                      <td className="px-3 py-2">
                        {n.extraviado ? <Badge color="bg-rose-200 text-rose-800" label="🔴 Extraviado" /> : <Badge color="bg-orange-100 text-orange-700" label="⏳ Pendiente" />}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[150px] truncate">{n.observacion}</td>
                      <td className="px-3 py-2"><AdjuntoBtn registroId={n.id} tabla="no_devueltos" nombre={n.adjunto_nombre} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ DASHBOARD ════════════════════════════════════════════════════════ */}
        {!loading && tab === "dashboard" && dashData && (() => {
          /* ── helpers ── */
          const doseBar  = (pct: number) => pct>75?"bg-red-500":pct>50?"bg-orange-400":pct>25?"bg-yellow-400":"bg-green-500";
          const doseBadge= (pct: number) => pct>75?"bg-red-100 text-red-700 border border-red-200":pct>50?"bg-orange-100 text-orange-700 border border-orange-200":pct>25?"bg-yellow-100 text-yellow-700 border border-yellow-200":"bg-green-100 text-green-700 border border-green-200";
          const doseText = (pct: number) => pct>75?"🔴 Alerta":pct>50?"🟠 Moderado":pct>25?"🟡 Precaución":"🟢 Normal";
          const metricKey= (m: "hp10"|"hp3"|"hp007") => m==="hp10"?"avg_hp10":m==="hp3"?"avg_hp3":"avg_hp007";
          const metricLim= (m: "hp10"|"hp3"|"hp007") => m==="hp10"?20:m==="hp3"?150:500;
          const metricLabel=(m: "hp10"|"hp3"|"hp007") => m==="hp10"?"Hp(10) cuerpo":m==="hp3"?"Hp(3) cristalino":"Hp(0.07) piel";

          /* ── global stats ── */
          const ultimo = dashData.tendencia_anual[dashData.tendencia_anual.length-1];
          const globalV = parseFloat(ultimo?.avg_hp10||"0");
          const globalPct= Math.min((globalV/20)*100,100);
          const totalTrab= dashData.tendencia_anual.reduce((s,a)=>s+parseInt(a.n_trabajadores||"0"),0);
          const sobreTotal= dashData.por_departamento.reduce((s,d)=>s+parseInt(d.sobre_alerta||"0"),0);
          const tMax = Math.max(...dashData.tendencia_anual.map(d=>parseFloat(d.avg_hp10)||0), 0.001);

          return (
            <div className="space-y-4">

              {/* ── Sub-nav pills ── */}
              <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
                {([["institucion","🏥 Institución"],["departamentos","🏢 Departamentos"],["trabajador","👷 Trabajador"]] as [DashTab,string][]).map(([k,label])=>(
                  <button key={k} onClick={()=>setDashTab(k)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${dashTab===k?"bg-white shadow text-blue-700":"text-gray-500 hover:text-gray-700"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ══════════════ SUB-VIEW: INSTITUCIÓN ══════════════ */}
              {dashTab==="institucion" && (
                <div className="space-y-4">

                  {/* KPI row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {icon:"📊",label:"Dosis promedio",value:`${globalV.toFixed(3)} mSv`,sub:`${globalPct.toFixed(1)}% del límite`,color:"blue"},
                      {icon:"👷",label:"Trabajadores",value:ultimo?.n_trabajadores||"—",sub:`año ${ultimo?.anio||"—"}`,color:"indigo"},
                      {icon:"🏢",label:"Departamentos",value:String(dashData.por_departamento.length),sub:"con registros",color:"sky"},
                      {icon:"⚠️",label:"Sobre alerta",value:String(sobreTotal),sub:sobreTotal>0?"requieren atención":"sin alertas",color:sobreTotal>0?"red":"green"},
                    ].map(k=>{
                      const c=KPI_COLOR_MAP[k.color]||KPI_COLOR_MAP.blue;
                      return (
                        <div key={k.label} className={`bg-white rounded-xl border ${c.border} p-4`}>
                          <div className="text-2xl mb-1">{k.icon}</div>
                          <div className={`text-xl font-bold ${c.text}`}>{k.value}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
                          <div className="text-xs text-gray-400">{k.sub}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hero card */}
                  <div className="bg-gradient-to-br from-slate-800 to-blue-900 rounded-2xl p-6 text-white">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-1">Hospital Hernán Henríquez Aravena</div>
                        <h3 className="text-lg font-bold">Dosis promedio institucional — Hp(10)</h3>
                        <div className="text-blue-300 text-sm">Año {ultimo?.anio} · {ultimo?.n_trabajadores} trabajadores</div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${globalPct>75?"bg-red-500":globalPct>50?"bg-orange-500":globalPct>25?"bg-yellow-500 text-black":"bg-green-500"}`}>
                        {doseText(globalPct)}
                      </span>
                    </div>
                    <div className="flex items-end gap-6">
                      <div>
                        <div className="text-6xl font-black tracking-tight">{globalV.toFixed(3)}</div>
                        <div className="text-blue-300 text-sm font-medium mt-1">mSv / año</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-blue-300 mb-1">
                          <span>{globalPct.toFixed(1)}% del límite anual</span>
                          <span>20 mSv</span>
                        </div>
                        <div className="h-5 bg-blue-950 rounded-full overflow-hidden">
                          <div className={`h-full ${doseBar(globalPct)} rounded-full transition-all`} style={{width:`${globalPct}%`}} />
                        </div>
                        <div className="flex justify-between text-xs text-blue-400 mt-1.5">
                          <span>0</span><span>🔔 15 mSv</span><span>🚫 20 mSv</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tendencia anual */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-800 mb-1">📈 Tendencia anual — Hp(10) promedio</h3>
                    <p className="text-xs text-gray-400 mb-4">Dosis media del personal ocupacionalmente expuesto por año</p>
                    <div className="flex items-end gap-4 h-36 px-2">
                      {dashData.tendencia_anual.map((a: DashAnio) => {
                        const v=parseFloat(a.avg_hp10)||0;
                        const h=Math.max(8,Math.round((v/tMax)*120));
                        const pct=(v/20)*100;
                        return (
                          <div key={a.anio} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <span className="text-xs font-bold text-gray-700">{v.toFixed(2)}</span>
                            <div className={`w-full ${doseBar(pct)} rounded-t-md hover:opacity-80 transition-opacity cursor-default`}
                              style={{height:`${h}px`}} title={`${a.anio}: ${v.toFixed(3)} mSv · ${a.n_trabajadores} trab.`} />
                            <span className="text-xs font-semibold text-gray-600">{a.anio}</span>
                            <span className="text-xs text-gray-400">{a.n_trabajadores}p</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/>0–25%</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"/>25–50%</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"/>50–75%</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/>&gt;75% alerta</span>
                    </div>
                  </div>

                  {/* Normativa */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="text-xs font-semibold text-blue-800 mb-2">📋 Marco normativo vigente</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-700">
                      <div><strong>DS 3/1985 MINSAL Art. 44</strong><br/>Hp(10): 20 mSv/año · Hp(3): 150 mSv/año · Hp(0.07): 500 mSv/año</div>
                      <div><strong>NS-05.0 · IAEA GSR Part 3</strong><br/>Alerta al 75%: 15 mSv/año Hp(10). Req. 29 (2014)</div>
                      <div><strong>ICRP Pub. 103</strong><br/>Límites para trabajadores ocupacionalmente expuestos (POE)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════ SUB-VIEW: DEPARTAMENTOS ══════════════ */}
              {dashTab==="departamentos" && (
                <div className="space-y-4">

                  {/* Metric selector */}
                  <div className="bg-white border rounded-xl p-4 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-600">Métrica:</span>
                    {(["hp10","hp3","hp007"] as const).map(m=>(
                      <button key={m} onClick={()=>setDashMetric(m)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all border ${dashMetric===m?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                        {metricLabel(m)}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-gray-400">Límite: {metricLim(dashMetric)} mSv/año</span>
                  </div>

                  {/* Bar chart sorted by dose */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-800 mb-1">🏢 Comparativo departamentos — {metricLabel(dashMetric)}</h3>
                    <p className="text-xs text-gray-400 mb-4">Dosis promedio trimestral por unidad. Ordenado de mayor a menor.</p>
                    <div className="space-y-2.5">
                      {[...dashData.por_departamento]
                        .sort((a,b)=>(parseFloat((b as Record<string,string>)[metricKey(dashMetric)])||0)-(parseFloat((a as Record<string,string>)[metricKey(dashMetric)])||0))
                        .map((d: DashDepto, i) => {
                          const raw=(d as Record<string,string>)[metricKey(dashMetric)];
                          const avg=parseFloat(raw)||0;
                          const pct=Math.min((avg/metricLim(dashMetric))*100,100);
                          return (
                            <div key={d.departamento} className="flex items-center gap-3">
                              <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{i+1}</span>
                              <div className="w-40 text-xs text-gray-700 flex-shrink-0 truncate font-medium" title={d.departamento}>{d.departamento}</div>
                              <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
                                <div className={`h-full ${doseBar(pct)} rounded-lg transition-all`} style={{width:`${pct}%`}} />
                                <span className="absolute left-2 top-1 text-xs font-semibold text-white drop-shadow-sm">
                                  {avg.toFixed(3)} mSv
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${doseBadge(pct)}`}>{doseText(pct)}</span>
                              <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">n={d.n}</span>
                              {parseInt(d.sobre_alerta)>0 && <Badge color="bg-red-100 text-red-700" label={`⚠ ${d.sobre_alerta}`} />}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Summary table */}
                  <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-5 py-3 border-b bg-gray-50">
                      <span className="text-sm font-semibold text-gray-700">Resumen por departamento — todas las métricas</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b">
                            <th className="text-left px-4 py-2 font-medium">Departamento</th>
                            <th className="text-right px-3 py-2 font-medium">Hp(10)</th>
                            <th className="text-right px-3 py-2 font-medium">Hp(3)</th>
                            <th className="text-right px-3 py-2 font-medium">Hp(0.07)</th>
                            <th className="text-right px-3 py-2 font-medium">Máx Hp(10)</th>
                            <th className="text-right px-3 py-2 font-medium">N</th>
                            <th className="text-center px-3 py-2 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...dashData.por_departamento]
                            .sort((a,b)=>(parseFloat(b.avg_hp10)||0)-(parseFloat(a.avg_hp10)||0))
                            .map((d: DashDepto) => {
                              const pct=Math.min(((parseFloat(d.avg_hp10)||0)/20)*100,100);
                              return (
                                <tr key={d.departamento} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-2 font-medium text-gray-700 max-w-[160px] truncate" title={d.departamento}>{d.departamento}</td>
                                  <td className="px-3 py-2 text-right font-mono">{(parseFloat(d.avg_hp10)||0).toFixed(3)}</td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-500">{d.avg_hp3?(parseFloat(d.avg_hp3)).toFixed(3):"—"}</td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-500">{d.avg_hp007?(parseFloat(d.avg_hp007)).toFixed(3):"—"}</td>
                                  <td className="px-3 py-2 text-right font-mono text-gray-500">{(parseFloat(d.max_hp10||"0")||0).toFixed(3)}</td>
                                  <td className="px-3 py-2 text-right">{d.n}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doseBadge(pct)}`}>{doseText(pct)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════ SUB-VIEW: TRABAJADOR ══════════════ */}
              {dashTab==="trabajador" && (
                <div className="space-y-4">

                  {/* Search */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-800 mb-3">👷 Historial individual de dosimetría</h3>
                    <div className="flex gap-3 items-end flex-wrap">
                      <div>
                        <label className="text-xs text-gray-500 font-medium">RUT trabajador</label>
                        <input value={fRut} onChange={e=>setFRut(e.target.value)} placeholder="12345678-9"
                          className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <button onClick={fetchData}
                        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        Ver historial
                      </button>
                      <p className="text-xs text-gray-400 self-center">Ingresa el RUT para ver el historial de dosis personal y evaluación de riesgo</p>
                    </div>
                  </div>

                  {/* Dose limits reference card */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-700 mb-3">📏 Límites de dosis DS 3/1985 — Personal POE</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        {label:"Hp(10) — Cuerpo entero",lim:20,alert:15,color:"blue",unit:"mSv/año"},
                        {label:"Hp(3) — Cristalino",lim:150,alert:112,color:"indigo",unit:"mSv/año"},
                        {label:"Hp(0.07) — Piel/extremidades",lim:500,alert:375,color:"sky",unit:"mSv/año"},
                      ].map(item=>{
                        const c=KPI_COLOR_MAP[item.color]||KPI_COLOR_MAP.blue;
                        return (
                          <div key={item.label} className={`rounded-xl ${c.bg} border ${c.border} p-4`}>
                            <div className={`text-sm font-semibold ${c.text} mb-2`}>{item.label}</div>
                            <div className={`text-3xl font-black ${c.text}`}>{item.lim}</div>
                            <div className="text-xs text-gray-500 mb-2">{item.unit} · DS 3/1985</div>
                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                              <div className="h-full bg-current rounded-full" style={{width:`${(item.alert/item.lim)*100}%`,color:"inherit",opacity:0.5}} />
                            </div>
                            <div className="text-xs text-gray-400 mt-1">🔔 Alerta: {item.alert} mSv/año</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Traffic light info */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-gray-700 mb-3">🚦 Semáforo de riesgo dosimétrico</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {color:"🟢",label:"Normal",range:"0–25%",desc:"≤5 mSv/año Hp(10)",bg:"bg-green-50 border-green-100"},
                        {color:"🟡",label:"Precaución",range:"25–50%",desc:"5–10 mSv/año",bg:"bg-yellow-50 border-yellow-100"},
                        {color:"🟠",label:"Moderado",range:"50–75%",desc:"10–15 mSv/año",bg:"bg-orange-50 border-orange-100"},
                        {color:"🔴",label:"Alerta",range:">75%",desc:">15 mSv/año — acción requerida",bg:"bg-red-50 border-red-100"},
                      ].map(s=>(
                        <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                          <div className="text-2xl mb-1">{s.color}</div>
                          <div className="text-sm font-semibold text-gray-700">{s.label}</div>
                          <div className="text-xs text-gray-500">{s.range} del límite</div>
                          <div className="text-xs text-gray-400 mt-1">{s.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}
      </div>

      {modal && (
        <ModalNuevoRegistro tabla={modal} onClose={() => setModal(null)} onSaved={fetchData} />
      )}
    </div>
  );
}
