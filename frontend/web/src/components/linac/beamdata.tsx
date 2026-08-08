"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, LineChart as LineChartIcon, Plus, Trash2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const MEASUREMENT_TYPES = [
  { value: "factor_salida", label: "Factor de salida" },
  { value: "pdd", label: "PDD" },
  { value: "tpr", label: "TPR" },
  { value: "perfil", label: "Perfil de haz" },
  { value: "simetria", label: "Simetria" },
  { value: "planicidad", label: "Planicidad" },
  { value: "factor_cuna", label: "Factor de cuna" },
  { value: "factor_bandeja", label: "Factor de bandeja" },
  { value: "factor_campo_pequeno", label: "Factor de campo pequeno" },
  { value: "curva", label: "Curva" },
  { value: "matriz", label: "Matriz de datos" },
  { value: "otro", label: "Otro" },
];

const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const labelCls = "text-xs text-muted-foreground";
const CHART_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#a855f7", "#06b6d4"];

export function BeamDataTab({ unitId, unit, actorEmail }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [measurementType, setMeasurementType] = useState("");
  const [modality, setModality] = useState("");
  const [energy, setEnergy] = useState("");
  const [instrument, setInstrument] = useState("");
  const [responsible, setResponsible] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    if (!unitId) return;
    const params = new URLSearchParams({ linacId: String(unitId) });
    if (measurementType) params.set("measurementType", measurementType);
    if (modality) params.set("modality", modality);
    if (energy) params.set("energy", energy);
    if (instrument) params.set("instrument", instrument);
    if (responsible) params.set("responsible", responsible);
    const res = await fetch("/api/linac/beamdata?" + params.toString());
    const data = await res.json();
    if (data.ok) setItems(data.items);
  }, [unitId, measurementType, modality, energy, instrument, responsible]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleCompare() {
    if (selected.length < 2) return;
    const res = await fetch("/api/linac/beamdata?compareIds=" + encodeURIComponent(selected.join(",")));
    const data = await res.json();
    if (data.ok) setCompareData(data.items);
  }

  function exportCsv(item: any) {
    const points = Array.isArray(item.data?.points) ? item.data.points : [];
    let csv = "x,y,unit\n";
    points.forEach((p: any) => { csv += [p.x, p.y, p.unit || ""].join(",") + "\n"; });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (item.measurement_type || "beamdata") + "_" + item.id + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = useMemo(() => {
    if (!compareData) return [];
    const xSet = new Set<number>();
    compareData.forEach((item: any) => {
      const points = Array.isArray(item.data?.points) ? item.data.points : [];
      points.forEach((p: any) => { const x = Number(p.x); if (!Number.isNaN(x)) xSet.add(x); });
    });
    const xs = Array.from(xSet).sort((a, b) => a - b);
    return xs.map((x) => {
      const row: any = { x };
      compareData.forEach((item: any, idx: number) => {
        const points = Array.isArray(item.data?.points) ? item.data.points : [];
        const match = points.find((p: any) => Number(p.x) === x);
        row["s" + idx] = match ? Number(match.y) : null;
      });
      return row;
    });
  }, [compareData]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Filtros</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <select className={inputCls} value={measurementType} onChange={(e) => setMeasurementType(e.target.value)}>
            <option value="">Todos los tipos de medicion</option>
            {MEASUREMENT_TYPES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
          <input className={inputCls} placeholder="Modalidad" value={modality} onChange={(e) => setModality(e.target.value)} />
          <input className={inputCls} placeholder="Energia" value={energy} onChange={(e) => setEnergy(e.target.value)} />
          <input className={inputCls} placeholder="Instrumento" value={instrument} onChange={(e) => setInstrument(e.target.value)} />
          <input className={inputCls} placeholder="Responsable" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
        </div>
      </div>

      <ImportBeamDataPanel unitId={unitId} actorEmail={actorEmail} onSaved={load} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Biblioteca de Beam Data</p>
        <button
          onClick={handleCompare}
          disabled={selected.length < 2}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background disabled:opacity-50"
        >
          <LineChartIcon className="h-3.5 w-3.5" /> Comparar seleccionados ({selected.length})
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1"></th>
              <th className="p-1">Origen</th>
              <th className="p-1">Fecha</th>
              <th className="p-1">Tipo de medicion</th>
              <th className="p-1">Modalidad</th>
              <th className="p-1">Energia</th>
              <th className="p-1">Version</th>
              <th className="p-1">Instrumento</th>
              <th className="p-1">Responsable</th>
              <th className="p-1">Incertidumbre</th>
              <th className="p-1">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => {
              const key = it.source + ":" + it.id;
              return (
                <tr key={key} className="border-t border-border">
                  <td className="p-1"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggleSelect(key)} /></td>
                  <td className="p-1 text-foreground">{it.source === "library" ? "Beam Data" : "Commissioning"}</td>
                  <td className="p-1 text-foreground">{String(it.measurement_date).slice(0, 10)}</td>
                  <td className="p-1 text-foreground">{MEASUREMENT_TYPES.find((m) => m.value === it.measurement_type)?.label || it.measurement_type}</td>
                  <td className="p-1 text-foreground">{it.modality || "-"}</td>
                  <td className="p-1 text-foreground">{it.energy || "-"}</td>
                  <td className="p-1 text-foreground">v{it.version}{!it.is_current && " (historica)"}</td>
                  <td className="p-1 text-foreground">{it.instrument_used || "-"}</td>
                  <td className="p-1 text-foreground">{it.measured_by || "-"}</td>
                  <td className="p-1 text-foreground">{it.uncertainty_value ? it.uncertainty_value + " " + (it.uncertainty_unit || "") : "-"}</td>
                  <td className="p-1">
                    <div className="flex gap-1">
                      {it.blob_url && it.source === "library" && (
                        <a href={"/api/linac/download?table=beam_data&id=" + it.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Vista previa"><Eye className="h-3 w-3" /></a>
                      )}
                      <button onClick={() => exportCsv(it)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background" title="Exportar CSV"><Download className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={11} className="p-2 text-center text-muted-foreground">Sin datos de beam data para los filtros seleccionados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {compareData && compareData.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Comparacion / superposicion de curvas</p>
            <button onClick={() => setCompareData(null)} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">Cerrar</button>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {compareData.map((item: any, idx: number) => (
                <Line
                  key={idx}
                  type="monotone"
                  dataKey={"s" + idx}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  name={(MEASUREMENT_TYPES.find((m) => m.value === item.measurement_type)?.label || item.measurement_type) + " - " + String(item.measurement_date).slice(0, 10) + " (" + item.source + ")"}
                  connectNulls
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ImportBeamDataPanel({ unitId, actorEmail, onSaved }: any) {
  const [measurementType, setMeasurementType] = useState(MEASUREMENT_TYPES[0]!.value);
  const [modality, setModality] = useState("");
  const [energy, setEnergy] = useState("");
  const [measurementDate, setMeasurementDate] = useState("");
  const [measuredBy, setMeasuredBy] = useState("");
  const [instrumentUsed, setInstrumentUsed] = useState("");
  const [uncertaintyType, setUncertaintyType] = useState("");
  const [uncertaintyValue, setUncertaintyValue] = useState("");
  const [uncertaintyUnit, setUncertaintyUnit] = useState("");
  const [points, setPoints] = useState<any[]>([{ x: "", y: "", unit: "" }]);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function setPoint(idx: number, key: string, value: string) {
    setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }
  function addPoint() { setPoints((prev) => [...prev, { x: "", y: "", unit: "" }]); }
  function removePoint(idx: number) { setPoints((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleSave() {
    if (!unitId || !measurementDate) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("linacId", String(unitId));
      form.set("modality", modality);
      form.set("energy", energy);
      form.set("measurementType", measurementType);
      form.set("measurementDate", measurementDate);
      form.set("measuredBy", measuredBy);
      form.set("instrumentUsed", instrumentUsed);
      form.set("uncertaintyType", uncertaintyType);
      form.set("uncertaintyValue", uncertaintyValue);
      form.set("uncertaintyUnit", uncertaintyUnit);
      form.set("notes", notes);
      form.set("createdBy", actorEmail || "");
      form.set("points", JSON.stringify(points.filter((p) => p.x !== "" || p.y !== "")));
      if (file) form.set("file", file);
      await fetch("/api/linac/beamdata", { method: "POST", body: form });
      setModality(""); setEnergy(""); setMeasurementDate(""); setMeasuredBy(""); setInstrumentUsed("");
      setUncertaintyType(""); setUncertaintyValue(""); setUncertaintyUnit(""); setPoints([{ x: "", y: "", unit: "" }]);
      setNotes(""); setFile(null);
      onSaved && onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-sm font-semibold text-foreground">Importar Beam Data</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <select className={inputCls} value={measurementType} onChange={(e) => setMeasurementType(e.target.value)}>
          {MEASUREMENT_TYPES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
        </select>
        <input className={inputCls} placeholder="Modalidad" value={modality} onChange={(e) => setModality(e.target.value)} />
        <input className={inputCls} placeholder="Energia" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        <input type="date" className={inputCls} value={measurementDate} onChange={(e) => setMeasurementDate(e.target.value)} />
        <input className={inputCls} placeholder="Responsable" value={measuredBy} onChange={(e) => setMeasuredBy(e.target.value)} />
        <input className={inputCls} placeholder="Instrumento utilizado" value={instrumentUsed} onChange={(e) => setInstrumentUsed(e.target.value)} />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Tipo de incertidumbre" value={uncertaintyType} onChange={(e) => setUncertaintyType(e.target.value)} />
        <input className={inputCls} placeholder="Valor de incertidumbre" value={uncertaintyValue} onChange={(e) => setUncertaintyValue(e.target.value)} />
        <input className={inputCls} placeholder="Unidad de incertidumbre" value={uncertaintyUnit} onChange={(e) => setUncertaintyUnit(e.target.value)} />
      </div>

      <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Puntos de datos (posicion/campo vs valor medido)</p>
      <div className="space-y-2">
        {points.map((p, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input className={inputCls} placeholder="X (profundidad/campo/posicion)" value={p.x} onChange={(e) => setPoint(idx, "x", e.target.value)} />
            <input className={inputCls} placeholder="Y (valor medido)" value={p.y} onChange={(e) => setPoint(idx, "y", e.target.value)} />
            <input className={inputCls} placeholder="Unidad" value={p.unit} onChange={(e) => setPoint(idx, "unit", e.target.value)} />
            <button onClick={() => removePoint(idx)} className="flex items-center justify-center gap-1 rounded border border-border text-xs text-danger hover:bg-background"><Trash2 className="h-3.5 w-3.5" /> Quitar</button>
          </div>
        ))}
      </div>
      <button onClick={addPoint} className="mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"><Plus className="h-3.5 w-3.5" /> Agregar punto</button>

      <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Archivo de datos original (opcional)</p>
      <input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />

      <textarea className={inputCls + " mt-2"} rows={2} placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button onClick={handleSave} disabled={saving || !unitId} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
        {saving ? "Guardando..." : "Importar a la biblioteca"}
      </button>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada importacion con el mismo tipo de medicion, modalidad y energia genera automaticamente una nueva version. La informacion original nunca se sobrescribe.
      </p>
    </div>
  );
}
