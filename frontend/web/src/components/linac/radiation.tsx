"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, AlertTriangle, CheckCircle2, FileDown, Bell } from "lucide-react";

const RADIATION_CATEGORIES: { value: string; label: string }[] = [
  { value: "blindaje", label: "Blindajes" },
  { value: "levantamiento", label: "Levant. Radiometrico" },
  { value: "monitoreo_ambiental", label: "Monitoreo Ambiental" },
  { value: "monitor_area", label: "Monitores de Area" },
  { value: "dosimetria_ocupacional", label: "Dosimetria Ocupacional" },
  { value: "instrumentacion", label: "Instrumentacion" },
  { value: "calibracion", label: "Calibraciones" },
  { value: "interlock", label: "Interlocks" },
  { value: "sistema_seguridad", label: "Sistemas de Seguridad" },
];

const RADIATION_FREQUENCIES = ["diaria", "semanal", "mensual", "trimestral", "semestral", "anual", "unica"];

const MEASUREMENT_TYPE_SUGGESTIONS: Record<string, string[]> = {
  blindaje: ["Tasa de dosis en pared primaria", "Tasa de dosis en pared secundaria", "Tasa de dosis en techo", "Fuga de cabezal"],
  levantamiento: ["Levantamiento perimetral de sala", "Levantamiento en puerta laberinto", "Levantamiento en sala contigua"],
  monitoreo_ambiental: ["Dosimetro ambiental TLD", "Monitor de area fijo", "Radon en sala"],
  monitor_area: ["Monitor de area - verificacion funcional", "Monitor de area - calibracion"],
  dosimetria_ocupacional: ["Dosimetro personal mensual", "Dosimetro de anillo", "Dosimetro de cristalino"],
  instrumentacion: ["Verificacion funcional", "Chequeo de bateria", "Chequeo de fuente de verificacion"],
  calibracion: ["Calibracion camara de ionizacion", "Calibracion detector de area", "Calibracion dosimetro de referencia"],
  interlock: ["Interlock de puerta", "Interlock de boton de emergencia", "Interlock de llave de consola"],
  sistema_seguridad: ["Senalizacion luminosa", "Circuito cerrado de television", "Sistema de intercomunicacion"],
};

const SEMAPHORE_COLORS: Record<string, string> = {
  verde: "text-success",
  amarillo: "text-warning",
  rojo: "text-danger",
};
const SEMAPHORE_DOT: Record<string, string> = {
  verde: "bg-success",
  amarillo: "bg-warning",
  rojo: "bg-danger",
};

function exportCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")].concat(
    rows.map((r: any) => headers.map((h: string) => JSON.stringify(r[h] ?? "")).join(","))
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RadiationTab({ unitId, actorEmail }: any) {
  const [category, setCategory] = useState("blindaje");
  const [list, setList] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ status: "conforme" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/linac/radiation?linacId=" + unitId + "&category=" + category);
    const data = await res.json();
    if (data.ok) setList(data.records);
  }, [unitId, category]);

  const loadAlerts = useCallback(async () => {
    const res = await fetch("/api/linac/radiation/alerts?linacId=" + unitId + "&status=abierta");
    const data = await res.json();
    if (data.ok) setAlerts(data.alerts);
  }, [unitId]);

  const loadWorkers = useCallback(async () => {
    const res = await fetch("/api/workers");
    const data = await res.json();
    if (data.workers) setWorkers(data.workers);
  }, []);

  const loadInstruments = useCallback(async () => {
    const res = await fetch("/api/instruments");
    const data = await res.json();
    if (data.instruments) setInstruments(data.instruments);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { loadWorkers(); loadInstruments(); }, [loadWorkers, loadInstruments]);

  function set(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); }

  async function handleSave() {
    if (!form.measurementDate) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("linacId", String(unitId));
      fd.set("category", category);
      Object.entries(form).forEach(([k, v]: [string, any]) => fd.set(k, v ?? ""));
      if (file) fd.set("file", file);
      const res = await fetch("/api/linac/radiation", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) setLastResult(data);
      setForm({ status: "conforme" }); setFile(null);
      load();
      loadAlerts();
    } finally {
      setSaving(false);
    }
  }

  async function resolveAlert(id: number) {
    await fetch("/api/linac/radiation/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "resuelta", actorEmail }),
    });
    loadAlerts();
  }

  function selectInstrument(id: string) {
    const inst = instruments.find((i: any) => String(i.id) === id);
    set("instrumentId", id);
    set("instrumentRef", inst ? inst.code + " - " + inst.name : "");
  }

  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
  const suggestions = MEASUREMENT_TYPE_SUGGESTIONS[category] || [];
  const isOccupational = category === "dosimetria_ocupacional";
  const categoryLabel = (RADIATION_CATEGORIES.find((c) => c.value === category) || { label: category }).label;

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
            <Bell className="h-4 w-4" /> Alertas de Proteccion Radiologica abiertas ({alerts.length})
          </p>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Fecha</th><th className="p-1">Categoria</th>
              <th className="p-1">Semaforo</th><th className="p-1">Mensaje</th><th className="p-1">Accion</th>
            </tr></thead>
            <tbody>
              {alerts.map((a: any) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-1 text-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="p-1 text-foreground capitalize">{a.category}</td>
                  <td className={"p-1 font-medium " + (SEMAPHORE_COLORS[a.semaphore] || "text-foreground")}>{a.semaphore}</td>
                  <td className="p-1 text-muted-foreground">{a.message}</td>
                  <td className="p-1">
                    <button onClick={() => resolveAlert(a.id)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">
                      Resolver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {RADIATION_CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={
              "rounded px-2 py-1 text-xs " +
              (category === c.value ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar: {categoryLabel}</p>
        {suggestions.length > 0 && (
          <div className="mb-2">
            <label className="text-xs text-muted-foreground">Tipo de medicion sugerido</label>
            <select className={inputCls} value="" onChange={(e) => set("measurementType", e.target.value)}>
              <option value="">Seleccionar...</option>
              {suggestions.map((s: string) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input className={inputCls} placeholder="Tipo de medicion" value={form.measurementType || ""} onChange={(e) => set("measurementType", e.target.value)} />
          <input type="date" className={inputCls} value={form.measurementDate || ""} onChange={(e) => set("measurementDate", e.target.value)} />
          <input type="time" className={inputCls} value={form.measurementTime || ""} onChange={(e) => set("measurementTime", e.target.value)} />
          <input className={inputCls} placeholder="Ubicacion" value={form.location || ""} onChange={(e) => set("location", e.target.value)} />
          <input className={inputCls} placeholder="Valor medido" value={form.value || ""} onChange={(e) => set("value", e.target.value)} />
          <input className={inputCls} placeholder="Unidad" value={form.unit || ""} onChange={(e) => set("unit", e.target.value)} />
          {isOccupational && (
            <>
              <input className={inputCls} placeholder="Dosis (valor)" value={form.doseValue || ""} onChange={(e) => set("doseValue", e.target.value)} />
              <input className={inputCls} placeholder="Unidad dosis (mSv)" value={form.doseUnit || ""} onChange={(e) => set("doseUnit", e.target.value)} />
              <select className={inputCls} value={form.workerRut || ""} onChange={(e) => set("workerRut", e.target.value)}>
                <option value="">Trabajador...</option>
                {workers.map((w: any) => (<option key={w.rut} value={w.rut}>{w.name}</option>))}
              </select>
            </>
          )}
          <input className={inputCls} placeholder="Nivel de referencia" value={form.referenceLevel || ""} onChange={(e) => set("referenceLevel", e.target.value)} />
          <input className={inputCls} placeholder="Limite normativo" value={form.limitValue || ""} onChange={(e) => set("limitValue", e.target.value)} />
          <select className={inputCls} value={form.status || "conforme"} onChange={(e) => set("status", e.target.value)}>
            <option value="conforme">Conforme</option>
            <option value="no_conforme">No conforme</option>
          </select>
          <select className={inputCls} value={form.frequency || ""} onChange={(e) => set("frequency", e.target.value)}>
            <option value="">Frecuencia...</option>
            {RADIATION_FREQUENCIES.map((f: string) => (<option key={f} value={f}>{f}</option>))}
          </select>
          <input type="date" className={inputCls} value={form.nextDueDate || ""} onChange={(e) => set("nextDueDate", e.target.value)} title="Proxima fecha / vencimiento" />
          <select className={inputCls} value={form.instrumentId || ""} onChange={(e) => selectInstrument(e.target.value)}>
            <option value="">Instrumento utilizado...</option>
            {instruments.map((i: any) => (<option key={i.id} value={i.id}>{i.code} - {i.name}</option>))}
          </select>
          <input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
          <input type="file" className="text-xs text-foreground" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <input className={inputCls + " mt-2"} placeholder="Observaciones / notas" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
        <button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar"}
        </button>
        {lastResult && (
          <p className={"mt-2 flex items-center gap-1.5 text-xs font-medium " + (SEMAPHORE_COLORS[lastResult.semaphore] || "text-foreground")}>
            {lastResult.semaphore === "verde" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Resultado: semaforo {lastResult.semaphore}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Registros ({categoryLabel})</p>
          <button onClick={() => exportCsv(list, "radiation_" + category + ".csv")} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">
            <FileDown className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">Fecha</th><th className="p-1">Hora</th><th className="p-1">Tipo</th><th className="p-1">Ubicacion</th>
              <th className="p-1">Valor</th><th className="p-1">Trabajador</th><th className="p-1">Instrumento</th>
              <th className="p-1">Vence</th><th className="p-1">Semaforo</th><th className="p-1">Estado</th>
              <th className="p-1">Responsable</th><th className="p-1">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-1 text-foreground">{String(r.measurement_date).slice(0, 10)}</td>
                <td className="p-1 text-foreground">{r.measurement_time || "-"}</td>
                <td className="p-1 text-foreground">{r.measurement_type || "-"}</td>
                <td className="p-1 text-foreground">{r.location || "-"}</td>
                <td className="p-1 text-foreground">{r.value || r.dose_value || "-"} {r.unit || r.dose_unit || ""}</td>
                <td className="p-1 text-foreground">{r.worker_name || "-"}</td>
                <td className="p-1 text-foreground">{r.instrument_name ? r.instrument_code + " - " + r.instrument_name : (r.instrument_ref || "-")}</td>
                <td className="p-1 text-foreground">{r.next_due_date ? String(r.next_due_date).slice(0, 10) : "-"}</td>
                <td className="p-1">
                  <span className={"inline-block h-2.5 w-2.5 rounded-full " + (SEMAPHORE_DOT[r.semaphore] || "bg-muted")} title={r.semaphore} />
                </td>
                <td className={"p-1 font-medium " + (r.status === "conforme" ? "text-success" : "text-danger")}>{r.status}</td>
                <td className="p-1 text-foreground">{r.responsible || "-"}</td>
                <td className="p-1">
                  {r.blob_url && (
                    <div className="flex gap-1">
                      <a href={"/api/linac/download?table=radiation&id=" + r.id} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Eye className="h-3 w-3" /></a>
                      <a href={"/api/linac/download?table=radiation&id=" + r.id + "&dl=1"} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"><Download className="h-3 w-3" /></a>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
