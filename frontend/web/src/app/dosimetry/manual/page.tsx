"use client";

import { useState } from "react";
import { PlusCircle, CheckCircle } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400";

const QUARTERS = [1, 2, 3, 4];
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const TIPOS = ["C.E.", "extremidades", "cristalino", "otro"];
const RADIACIONES = ["Rayos X", "Rayos Gamma", "Beta", "Neutrones", "Mixta", "Otro"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>{children}</div>;
}

export default function DosimetryManualPage() {
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    worker_rut: "", year: String(new Date().getFullYear()), quarter: "1", tipo: "C.E.",
    dose_body: "", dose_lens: "", dose_skin: "",
    accum_year_body: "", accum_12m_body: "", accum_60m_body: "", accum_60m_lens: "", accum_60m_skin: "",
    institucion: "", departamento: "", dosimetro: "", radiacion: "Rayos X",
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }));

  const save = async () => {
    if (!form.worker_rut.trim() || !form.year || !form.quarter) { setMsg("RUT, año y trimestre son obligatorios."); return; }
    setSaving(true); setMsg(""); setOk(false);
    const r = await fetch("/api/dosimetry/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        year: Number(form.year), quarter: Number(form.quarter),
        dose_body: form.dose_body ? Number(form.dose_body) : 0,
        dose_lens: form.dose_lens ? Number(form.dose_lens) : 0,
        dose_skin: form.dose_skin ? Number(form.dose_skin) : 0,
        accum_year_body: form.accum_year_body ? Number(form.accum_year_body) : 0,
        accum_12m_body: form.accum_12m_body ? Number(form.accum_12m_body) : 0,
        accum_60m_body: form.accum_60m_body ? Number(form.accum_60m_body) : 0,
        accum_60m_lens: form.accum_60m_lens ? Number(form.accum_60m_lens) : 0,
        accum_60m_skin: form.accum_60m_skin ? Number(form.accum_60m_skin) : 0,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.ok) { setOk(true); setMsg("Registro guardado correctamente."); }
    else setMsg(d.error ?? "Error al guardar.");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><PlusCircle className="h-6 w-6 text-blue-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ingreso Manual de Dosis</h1>
            <p className="text-sm text-gray-600">Registro trimestral individual de dosimetría personal</p>
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {ok && <CheckCircle className="h-4 w-4 shrink-0" />}
            {msg}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2">Identificación del trabajador</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Field label="RUT del trabajador *"><input className={inp} value={form.worker_rut} onChange={f("worker_rut")} placeholder="12.345.678-9" /></Field></div>
            <Field label="Institución"><input className={inp} value={form.institucion} onChange={f("institucion")} /></Field>
            <Field label="Departamento"><input className={inp} value={form.departamento} onChange={f("departamento")} /></Field>
          </div>

          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2 pt-2">Período</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Año *">
              <select className={inp} value={form.year} onChange={f("year")}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="Trimestre *">
              <select className={inp} value={form.quarter} onChange={f("quarter")}>
                {QUARTERS.map(q => <option key={q} value={q}>T{q}</option>)}
              </select>
            </Field>
            <Field label="Tipo dosímetro">
              <select className={inp} value={form.tipo} onChange={f("tipo")}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Dosímetro (N° serie)"><input className={inp} value={form.dosimetro} onChange={f("dosimetro")} placeholder="D-12345" /></Field>
            <Field label="Tipo radiación">
              <select className={inp} value={form.radiacion} onChange={f("radiacion")}>
                {RADIACIONES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2 pt-2">Dosis del trimestre (mSv)</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Hp(10) cuerpo"><input className={inp} type="number" step="0.01" min="0" value={form.dose_body} onChange={f("dose_body")} placeholder="0.00" /></Field>
            <Field label="Hp(3) cristalino"><input className={inp} type="number" step="0.01" min="0" value={form.dose_lens} onChange={f("dose_lens")} placeholder="0.00" /></Field>
            <Field label="Hp(0.07) piel"><input className={inp} type="number" step="0.01" min="0" value={form.dose_skin} onChange={f("dose_skin")} placeholder="0.00" /></Field>
          </div>

          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-2 pt-2">Dosis acumuladas (mSv)</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Acum. año cal. Hp(10)"><input className={inp} type="number" step="0.01" min="0" value={form.accum_year_body} onChange={f("accum_year_body")} placeholder="0.00" /></Field>
            <Field label="Acum. 12 meses Hp(10)"><input className={inp} type="number" step="0.01" min="0" value={form.accum_12m_body} onChange={f("accum_12m_body")} placeholder="0.00" /></Field>
            <Field label="Acum. 60 meses Hp(10)"><input className={inp} type="number" step="0.01" min="0" value={form.accum_60m_body} onChange={f("accum_60m_body")} placeholder="0.00" /></Field>
            <Field label="Acum. 60m Hp(3)"><input className={inp} type="number" step="0.01" min="0" value={form.accum_60m_lens} onChange={f("accum_60m_lens")} placeholder="0.00" /></Field>
            <Field label="Acum. 60m Hp(0.07)"><input className={inp} type="number" step="0.01" min="0" value={form.accum_60m_skin} onChange={f("accum_60m_skin")} placeholder="0.00" /></Field>
          </div>

          <div className="pt-2">
            <button onClick={save} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg">
              {saving ? "Guardando…" : "Guardar registro de dosis"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>DS N°133/1984 y DS N°95/2005 MINSAL — Límites de dosis ocupacional: Hp(10) 20 mSv/año, Hp(3) 150 mSv/año. CCHEN ORD sobre registros individuales de dosis. Planilla oficial CCHEN "Resumen - 908.xlsm" — columnas de importación.</p>
        </div>
      </div>
    </div>
  );
}
