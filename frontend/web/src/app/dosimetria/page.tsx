"use client";

import { useState, useEffect, useRef } from "react";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface KPIs {
  trabajadores_activos: number;
  total_registros: number;
  devueltos_fuera_plazo: number;
  no_devueltos: number;
  extraviados: number;
}
interface Summary {
  kpis: KPIs;
  promedios_por_anio: PromedioAnio[];
  por_departamento: PromedioDepto[];
  sobre_75_limite: SobreLimite[];
}
interface PromedioAnio { anio: string; avg_hp10: string; avg_hp3: string; avg_hp007: string; n_registros: string; }
interface PromedioDepto { departamento: string; avg_hp10: string; avg_hp3: string; avg_hp007: string; max_hp10: string; n: string; }
interface SobreLimite { rut: string; nombre: string; departamento: string; anio: string; hp10_anio: string; }

interface RegTrimestral {
  id: number; rut: string; nombre: string; departamento: string;
  periodo: string; trimestre: number; anio: number;
  tipo_dosimetro: string; numero_dosimetro: string;
  proceso: string; fecha_proceso: string; estamento: string;
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
interface DashDepto {
  departamento: string; avg_hp10: string; avg_hp3: string; avg_hp007: string;
  max_hp10: string; n: string; sobre_alerta: string;
}
interface DashAnio { anio: number; avg_hp10: string; n_trabajadores: string; max_hp10: string; }

// ─── Constantes ─────────────────────────────────────────────────────────────
const DEPTOS = ["MEDICINA NUCLEAR","CARDIOLOGIA","IMAGENOLOGIA","PABELLON CENTRAL",
  "CMA","ANGIOGRAFIA","ELECTROFISIOLOGIA","MEDICINA","ODONTOLOGIA","PREVENCION DE RIESGOS"];
const ANIOS = ["2023","2024","2025","2026"];
const TRIMS = ["1","2","3","4"];
const TIPO_DOSIMETRO: Record<string,string> = { I1:"Cuerpo entero", I5:"Pulsera/Extremidad", I2:"Área/Ambiental", I7:"Cuerpo entero (alt)" };
const ALERTA_COLOR = (v: number) => v > 15 ? "text-red-600 font-bold" : v > 10 ? "text-orange-500 font-semibold" : v > 5 ? "text-yellow-600" : "text-green-700";

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

// ─── Upload adjunto ──────────────────────────────────────────────────────────
function AdjuntoBtn({ registroId, tabla, nombre }: { registroId: number; tabla: string; nombre?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(nombre ?? "");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    // En producción: subir a /api/dosimetria/upload; aquí registramos el nombre
    await new Promise(r => setTimeout(r, 600));
    setUploaded(f.name);
    setUploading(false);
    // Registrar en adjuntos (simulado — en producción se usa FormData → S3/Blob)
    alert(`Adjunto "${f.name}" registrado para ${tabla} #${registroId}.\n\nEn producción se subiría a almacenamiento seguro.`);
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={ref} type="file" accept=".xlsx,.xls,.pdf,.csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
      >
        📎 {uploading ? "Subiendo…" : uploaded ? "Cambiar adjunto" : "Adjuntar Excel/PDF"}
      </button>
      {uploaded && <span className="text-xs text-green-700 truncate max-w-[140px]">✓ {uploaded}</span>}
    </div>
  );
}

// ─── Modal nuevo registro ────────────────────────────────────────────────────
function ModalNuevoRegistro({ tabla, onClose, onSaved }: {
  tabla: "registro"|"devuelto_fp"|"no_devuelto";
  onClose: () => void;
  onSaved: () => void;
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

  const inp = (label: string, key: string, type="text", required=false) => (
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
  const tLabel = titles[tabla];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">➕ {tLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {inp("RUT *","rut","text",true)}
          {inp("Nombre completo *","nombre","text",true)}
          {sel("Departamento *","departamento",Object.fromEntries(DEPTOS.map(d=>[d,d])),true)}
          <div className="col-span-1">
            {sel("Trimestre","trimestre",{"1":"T1","2":"T2","3":"T3","4":"T4"})}
          </div>
          {sel("Año","anio",Object.fromEntries(ANIOS.map(a=>[a,a])))}

          {tabla === "registro" && <>
            {sel("Tipo dosímetro","tipo_dosimetro",TIPO_DOSIMETRO)}
            {inp("N° dosímetro","numero_dosimetro")}
            {sel("Proceso","proceso",{"":"Sin especificar","PH":"PH – Fotón alta energía","PM":"PM – Fotón mediana energía","PL":"PL – Fotón baja energía","BH":"BH – Beta alta","BM":"BM – Beta mediana","BL":"BL – Beta baja"})}
            {inp("Fecha proceso","fecha_proceso","date")}
            <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Dosis Hp(10) — Cuerpo entero</div>
            {inp("Cualitativo Hp(10)","hp10_qual")}
            {inp("Cuantitativo trim. mSv","hp10_trim","number")}
            {inp("Acum. año calendario","hp10_anio","number")}
            <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Dosis Hp(3) — Cristalino</div>
            {inp("Cualitativo Hp(3)","hp3_qual")}
            {inp("Cuantitativo trim. mSv","hp3_trim","number")}
            {inp("Acum. año calendario","hp3_anio","number")}
            <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Dosis Hp(0.07) — Piel</div>
            {inp("Cualitativo Hp(0.07)","hp007_qual")}
            {inp("Cuantitativo trim. mSv","hp007_trim","number")}
            {inp("Acum. año calendario","hp007_anio","number")}
          </>}

          {tabla === "devuelto_fp" && <>
            {inp("N° dosímetro","numero_dosimetro")}
            {inp("Período (ej: T 2-2024)","periodo")}
            {inp("Fecha de lectura","fecha_lectura","date")}
            <div>
              <label className="text-xs font-medium text-gray-600">¿Alerta de dosis?</label>
              <select value={form.alerta_dosis??"false"} onChange={e=>set("alerta_dosis",e.target.value)}
                className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-white">
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>
            <div className="col-span-2">{inp("Observación","observacion")}</div>
          </>}

          {tabla === "no_devuelto" && <>
            {sel("Tipo dosímetro","tipo_dosimetro",TIPO_DOSIMETRO)}
            {inp("N° dosímetro","numero_dosimetro")}
            {inp("Período (ej: T 3-2026)","periodo")}
            <div>
              <label className="text-xs font-medium text-gray-600">¿Extraviado?</label>
              <select value={form.extraviado??"false"} onChange={e=>set("extraviado",e.target.value)}
                className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-white">
                <option value="false">No confirmado</option>
                <option value="true">Sí — extraviado</option>
              </select>
            </div>
            <div className="col-span-2">{inp("Observación","observacion")}</div>
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

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function DosimetriaPage() {
  const [tab, setTab] = useState<"summary"|"trimestral"|"anual"|"devueltos_fp"|"no_devueltos"|"dashboard">("summary");
  const [summary, setSummary] = useState<Summary|null>(null);
  const [registros, setRegistros] = useState<RegTrimestral[]>([]);
  const [regAnual, setRegAnual] = useState<RegAnual[]>([]);
  const [devFP, setDevFP] = useState<DevueltoFP[]>([]);
  const [noDev, setNoDev] = useState<NoDevuelto[]>([]);
  const [dashData, setDashData] = useState<{ por_departamento: DashDepto[]; tendencia_anual: DashAnio[] }|null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"registro"|"devuelto_fp"|"no_devuelto"|null>(null);

  // Filtros
  const [fAnio, setFAnio] = useState("");
  const [fTrim, setFTrim] = useState("");
  const [fDepto, setFDepto] = useState("");
  const [fRut, setFRut] = useState("");

  const fetchData = async () => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const TABS = [
    { key:"summary", label:"📊 Resumen" },
    { key:"trimestral", label:"📋 Trimestral" },
    { key:"anual", label:"📅 Anual" },
    { key:"devueltos_fp", label:"⏰ Devueltos F.P." },
    { key:"no_devueltos", label:"🚫 No Devueltos" },
    { key:"dashboard", label:"📈 Dashboard" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">☢️ Dosimetría Personal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hospital Dr. Hernán Henríquez Aravena — DS 3/1985 · CCHEN NS-05.0 · IAEA GSR Part 3
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white p-1 rounded-xl shadow-sm border flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros globales (excepto summary y dashboard) */}
        {tab !== "summary" && tab !== "dashboard" && (
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

        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3 animate-spin inline-block">⚛️</div>
            <div>Cargando datos…</div>
          </div>
        )}

        {/* ══ SUMMARY ══════════════════════════════════════════════════════════ */}
        {!loading && tab === "summary" && summary && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label:"Trabajadores activos", val:summary.kpis.trabajadores_activos, color:"blue", icon:"👷" },
                { label:"Registros totales", val:summary.kpis.total_registros, color:"indigo", icon:"📋" },
                { label:"Dev. fuera de plazo", val:summary.kpis.devueltos_fuera_plazo, color:"orange", icon:"⏰" },
                { label:"No devueltos", val:summary.kpis.no_devueltos, color:"red", icon:"🚫" },
                { label:"Extraviados", val:summary.kpis.extraviados, color:"rose", icon:"❓" },
              ].map(k => (
                <div key={k.label} className={`bg-white rounded-xl p-4 shadow-sm border border-${k.color}-100`}>
                  <div className="text-2xl mb-1">{k.icon}</div>
                  <div className={`text-3xl font-bold text-${k.color}-600`}>{k.val}</div>
                  <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Promedios por año */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">📅 Dosis promedio Hp(10) por año — Hospital (mSv)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left">Año</th>
                      <th className="px-3 py-2 text-center">Avg Hp(10)</th>
                      <th className="px-3 py-2 text-center">Avg Hp(3)</th>
                      <th className="px-3 py-2 text-center">Avg Hp(0.07)</th>
                      <th className="px-3 py-2 text-center">N° Registros</th>
                      <th className="px-3 py-2">Barra (máx 20 mSv)</th>
                    </tr>
                  </thead>
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

            {/* Por departamento */}
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

            {/* Sobre límite */}
            {summary.sobre_75_limite.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="font-semibold text-red-700 mb-3">⚠️ Trabajadores sobre 75% del límite anual (≥15 mSv)</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-red-600 uppercase">
                    <th className="text-left pb-2">Nombre</th><th>Departamento</th><th>Año</th><th>Hp(10) anio</th>
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

            {/* Leyenda siglas */}
            <div className="bg-gray-50 rounded-xl border p-4">
              <h4 className="font-semibold text-gray-600 mb-3 text-sm">📖 Glosario de siglas</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[["MNR","Mínimo Nivel de Registro (0.01–0.09 mSv)"],["NU","No Usado"],["NS","No Solicitado"],
                  ["NR","No Recepcionado"],["FF","Devuelto fuera de fecha"],["DD","Dosímetro Dañado"],
                  ["PL","Contaminado/Fotón baja energía"],["PH","Fotón alta energía"],["PM","Fotón mediana energía"],
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
              <span className="font-semibold text-gray-700">Resumen anual Hp(10) — cuerpo entero ({regAnual.length} trabajadores)</span>
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
                {regAnual.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-10 text-gray-400">Sin datos</td></tr>
                )}
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
                        {over
                          ? <Badge color="bg-red-100 text-red-700" label="⚠ Sobre 75%" />
                          : total > 10
                          ? <Badge color="bg-orange-100 text-orange-700" label="Moderado" />
                          : <Badge color="bg-green-100 text-green-700" label="Normal" />
                        }
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
                  {devFP.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">Sin registros</td></tr>
                  )}
                  {devFP.map(d => (
                    <tr key={d.id} className="border-t hover:bg-orange-50">
                      <td className="px-3 py-2 font-medium text-orange-700 whitespace-nowrap">{d.periodo}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={d.nombre}>{d.nombre}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{d.rut}</td>
                      <td className="px-3 py-2 text-xs">{d.departamento}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{d.numero_dosimetro}</td>
                      <td className="px-3 py-2 text-xs">{d.fecha_lectura ? new Date(d.fecha_lectura).toLocaleDateString("es-CL") : "—"}</td>
                      <td className="px-3 py-2">
                        {d.alerta_dosis
                          ? <Badge color="bg-red-100 text-red-700" label="⚠ Sí" />
                          : <Badge color="bg-green-100 text-green-700" label="No" />}
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
                  {noDev.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">Sin registros</td></tr>
                  )}
                  {noDev.map(n => (
                    <tr key={n.id} className={`border-t hover:bg-red-50 ${n.extraviado?"bg-rose-50":""}`}>
                      <td className="px-3 py-2 font-medium text-red-700 whitespace-nowrap">{n.periodo}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={n.nombre}>{n.nombre}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{n.rut}</td>
                      <td className="px-3 py-2 text-xs">{n.departamento}</td>
                      <td className="px-3 py-2"><Badge color="bg-indigo-100 text-indigo-700" label={n.tipo_dosimetro} /></td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{n.numero_dosimetro}</td>
                      <td className="px-3 py-2">
                        {n.extraviado
                          ? <Badge color="bg-rose-200 text-rose-800" label="🔴 Extraviado" />
                          : <Badge color="bg-orange-100 text-orange-700" label="⏳ Pendiente" />}
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

        {/* ══ DASHBOARD COMPARATIVO ════════════════════════════════════════════ */}
        {!loading && tab === "dashboard" && dashData && (
          <div className="space-y-5">
            {/* Individual */}
            <div className="bg-white rounded-xl border p-4 flex gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500">RUT trabajador (dashboard individual)</label>
                <input value={fRut} onChange={e=>setFRut(e.target.value)} placeholder="12345678-9"
                  className="block mt-1 px-3 py-1.5 border rounded text-sm w-44" />
              </div>
              <button onClick={fetchData} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Ver historial
              </button>
            </div>

            {/* Por departamento */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">🏥 Comparativo por Departamento — Dosis promedio Hp(10) trimestral</h3>
              <div className="space-y-3">
                {dashData.por_departamento.map((d: DashDepto) => {
                  const avg = parseFloat(d.avg_hp10)||0;
                  const pct = Math.min((avg/20)*100,100);
                  const color = pct>75?"bg-red-500":pct>50?"bg-orange-400":pct>25?"bg-yellow-400":"bg-green-500";
                  return (
                    <div key={d.departamento} className="flex items-center gap-3">
                      <div className="w-48 text-sm text-gray-700 flex-shrink-0 truncate" title={d.departamento}>{d.departamento}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                        <div className={`h-full ${color} rounded-full`} style={{ width:`${pct}%` }} />
                        <span className="absolute left-2 top-0.5 text-xs font-semibold text-white drop-shadow">
                          {avg.toFixed(3)} mSv
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 w-20 text-right">n={d.n} | máx {parseFloat(d.max_hp10||"0").toFixed(2)}</div>
                      {parseInt(d.sobre_alerta)>0 && <Badge color="bg-red-100 text-red-700" label={`⚠ ${d.sobre_alerta} sobre límite`} />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>Normal (0–25% límite)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>Bajo (25–50%)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"></span>Moderado (50–75%)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>Alerta ({'>'}75% = 15 mSv)</span>
              </div>
            </div>

            {/* Tendencia anual */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="font-semibold text-gray-700 mb-4">📈 Tendencia anual — Dosis promedio Hp(10) hospital</h3>
              <div className="flex items-end gap-6 h-32">
                {dashData.tendencia_anual.map((a: DashAnio) => {
                  const v = parseFloat(a.avg_hp10)||0;
                  const h = Math.max(10, (v/2)*100);
                  return (
                    <div key={a.anio} className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-gray-700">{v.toFixed(3)}</span>
                      <div className="w-16 bg-blue-500 rounded-t-md hover:bg-blue-600 transition-colors"
                        style={{ height:`${h}px` }} title={`${a.anio}: ${v.toFixed(3)} mSv | ${a.n_trabajadores} trab.`} />
                      <span className="text-xs text-gray-500">{a.anio}</span>
                      <span className="text-xs text-gray-400">{a.n_trabajadores} trab.</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-gray-400">Escala: promedio hospital por año. Límite ocupacional 20 mSv/año (DS 3/1985 Art. 44).</div>
            </div>

            {/* Promedio hospital */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-5 text-white">
              <h3 className="font-semibold mb-3">🌡️ Promedio hospital global Hp(10)</h3>
              {dashData.tendencia_anual.length > 0 && (() => {
                const ultimo = dashData.tendencia_anual[dashData.tendencia_anual.length-1];
                const v = parseFloat(ultimo?.avg_hp10||"0");
                const pct = (v/20*100).toFixed(1);
                return (
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-5xl font-bold">{v.toFixed(3)}</div>
                      <div className="text-blue-200 text-sm mt-1">mSv promedio — {ultimo?.anio}</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-blue-200 text-sm mb-1">{pct}% del límite anual (20 mSv)</div>
                      <div className="h-4 bg-blue-900 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width:`${pct}%` }} />
                      </div>
                      <div className="text-xs text-blue-300 mt-1">Alerta a 15 mSv | Límite 20 mSv</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Referencia normativa */}
            <div className="bg-gray-50 border rounded-xl p-4 text-xs text-gray-500">
              <strong className="text-gray-700">Marco normativo:</strong>{" "}
              DS 3/1985 (MINSAL) Art. 44 — Límite ocupacional: 20 mSv/año efectivo · 150 mSv/año cristalino · 500 mSv/año piel/extremidades.
              Alerta al 75%: 15 mSv/año Hp(10). CCHEN NS-05.0. IAEA GSR Part 3 (2014) Req. 29. ICRP Pub. 103.
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ModalNuevoRegistro
          tabla={modal}
          onClose={() => setModal(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
