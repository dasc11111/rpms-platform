"use client";
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, X, Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

type Worker = { rut: string; name: string; status?: string };

const emptyManual = {
  worker_rut: "",
  year: String(new Date().getFullYear()),
  quarter: "1",
  dose_body: "",
  dose_lens: "",
  dose_skin: "",
  accum_year_body: "",
  accum_12m_body: "",
  accum_60m_body: "",
  accum_60m_lens: "",
  accum_60m_skin: "",
  institucion: "",
  departamento: "",
};

type FormState = typeof emptyManual;

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function findCol(headers: string[], keywords: string[]): number {
  const normed = headers.map(norm);
  return normed.findIndex((h) => keywords.every((k) => h.includes(k)));
}

export function DoseReportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<FormState>(emptyManual);
  const [manualState, setManualState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [manualMsg, setManualMsg] = useState("");

  const [csvState, setCsvState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [csvMsg, setCsvMsg] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (open && workers.length === 0) {
      fetch("/api/workers")
        .then((r) => r.json())
        .then((d) => setWorkers((d.workers || []).filter((w: Worker) => w.status !== "inactive")))
        .catch(() => {});
    }
  }, [open, workers.length]);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function close() {
    setOpen(false);
    setForm(emptyManual);
    setManualState("idle");
    setManualMsg("");
    setCsvState("idle");
    setCsvMsg("");
    setFileName("");
    setTab("manual");
  }

  async function submitManual() {
    if (!form.worker_rut || !form.year || !form.quarter) {
      setManualState("error");
      setManualMsg("Selecciona trabajador, año y trimestre.");
      return;
    }
    setManualState("loading");
    setManualMsg("");
    try {
      const res = await fetch("/api/dosimetry/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setManualState("error");
        setManualMsg(data.error || "No se pudo guardar el reporte.");
        return;
      }
      setManualState("ok");
      setManualMsg("Guardado: " + data.worker_name + " · " + data.period_label + " · Nivel: " + data.level);
      router.refresh();
    } catch {
      setManualState("error");
      setManualMsg("No se pudo guardar el reporte. Intenta nuevamente.");
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setCsvState("loading");
    setCsvMsg("Leyendo archivo...");
    try {
      const text = await file.text();
      const table = parseCSV(text).filter((r) => r.length > 1 && r.some((c) => c.trim() !== ""));
      if (table.length < 2) {
        setCsvState("error");
        setCsvMsg("El archivo no contiene datos.");
        return;
      }
      const headers = table[0] ?? [];
      const runIdxRun = findCol(headers, ["run"]);
      const runIdx = runIdxRun >= 0 ? runIdxRun : findCol(headers, ["rut"]);
      const periodoIdx = findCol(headers, ["periodo"]);
      const institucionIdx = findCol(headers, ["instituci"]);
      const departamentoIdx = findCol(headers, ["departamento"]);
      const doseBodyIdx = findCol(headers, ["cuerpo entero", "cuantitativo"]);
      const doseLensIdx = findCol(headers, ["cristalino", "cuantitativo"]);
      const doseSkinIdx = findCol(headers, ["piel", "cuantitativo"]);
      const accumYearIdx = findCol(headers, ["cuerpo entero", "ano calendario"]);
      const accum12mIdx = findCol(headers, ["cuerpo entero", "12 meses"]);
      const accum60mBodyIdx = findCol(headers, ["cuerpo entero", "60 meses"]);
      const accum60mLensIdx = findCol(headers, ["cristalino", "60 meses"]);
      const accum60mSkinIdx = findCol(headers, ["piel", "60 meses"]);

      if (runIdx < 0 || periodoIdx < 0 || doseBodyIdx < 0) {
        setCsvState("error");
        setCsvMsg("No se reconocieron las columnas esperadas (RUN, PERIODO, dosis). Verifica el formato del archivo.");
        return;
      }

      const get = (r: string[], idx: number) => (idx >= 0 ? r[idx] ?? "" : "");
      const rows = table
        .slice(1)
        .filter((r) => get(r, runIdx).trim() !== "")
        .map((r) => [
          get(r, runIdx),
          get(r, periodoIdx),
          get(r, institucionIdx),
          get(r, departamentoIdx),
          get(r, doseBodyIdx),
          get(r, doseLensIdx),
          get(r, doseSkinIdx),
          get(r, accumYearIdx),
          get(r, accum12mIdx),
          get(r, accum60mBodyIdx),
          get(r, accum60mLensIdx),
          get(r, accum60mSkinIdx),
        ]);

      setCsvMsg("Procesando " + rows.length + " filas...");
      const res = await fetch("/api/dosimetry/import-quarterly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setCsvState("error");
        setCsvMsg(data.error || "No se pudo procesar el archivo.");
        return;
      }
      setCsvState("ok");
      setCsvMsg(
        "Archivo procesado: " + data.totalRows + " filas leídas · " + data.matchedGroups +
          " registros de trabajadores actualizados · " + data.unmatched +
          " filas sin coincidencia (nombres no encontrados en el listado de trabajadores)."
      );
      router.refresh();
    } catch (err) {
      setCsvState("error");
      setCsvMsg("No se pudo leer o procesar el archivo CSV.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-accent"
      >
        <ClipboardPlus className="h-3.5 w-3.5" />
        Ingresar reporte de dosis
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ingreso de reporte de dosis</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-md border border-border p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={"flex-1 rounded px-2 py-1.5 font-medium " + (tab === "manual" ? "bg-accent text-white" : "text-muted-foreground")}
          >
            Ingreso manual
          </button>
          <button
            type="button"
            onClick={() => setTab("csv")}
            className={"flex-1 rounded px-2 py-1.5 font-medium " + (tab === "csv" ? "bg-accent text-white" : "text-muted-foreground")}
          >
            Carga automática (CSV)
          </button>
        </div>

        {tab === "manual" && (
          <div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="col-span-2 text-[11px]">
                <span className="mb-1 block text-muted-foreground">
                  Trabajador <span className="text-danger">*</span>
                </span>
                <select
                  value={form.worker_rut}
                  onChange={(e) => update("worker_rut", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                >
                  <option value="">Selecciona un trabajador...</option>
                  {workers.map((w) => (
                    <option key={w.rut} value={w.rut}>
                      {w.name} ({w.rut})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">
                  Año <span className="text-danger">*</span>
                </span>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => update("year", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">
                  Trimestre <span className="text-danger">*</span>
                </span>
                <select
                  value={form.quarter}
                  onChange={(e) => update("quarter", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                >
                  <option value="1">T1</option>
                  <option value="2">T2</option>
                  <option value="3">T3</option>
                  <option value="4">T4</option>
                </select>
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Dosis cuerpo entero (mSv)</span>
                <input
                  type="text"
                  value={form.dose_body}
                  onChange={(e) => update("dose_body", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Dosis cristalino (mSv)</span>
                <input
                  type="text"
                  value={form.dose_lens}
                  onChange={(e) => update("dose_lens", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Dosis piel (mSv)</span>
                <input
                  type="text"
                  value={form.dose_skin}
                  onChange={(e) => update("dose_skin", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Acumulado 5 años - cuerpo (mSv)</span>
                <input
                  type="text"
                  value={form.accum_60m_body}
                  onChange={(e) => update("accum_60m_body", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Institución</span>
                <input
                  type="text"
                  value={form.institucion}
                  onChange={(e) => update("institucion", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Departamento</span>
                <input
                  type="text"
                  value={form.departamento}
                  onChange={(e) => update("departamento", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Niveles de referencia (cuerpo entero por trimestre): Registro ≥ 0,1 mSv · Investigación ≥ 1,6 mSv · Intervención ≥ 5 mSv. El nivel se calcula automáticamente.
            </p>
            {manualMsg && (
              <p className={"mt-3 flex items-center gap-1 text-xs " + (manualState === "error" ? "text-danger" : "text-success")}>
                {manualState === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {manualMsg}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent">
                Cerrar
              </button>
              <button
                type="button"
                onClick={submitManual}
                disabled={manualState === "loading"}
                className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {manualState === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar reporte
              </button>
            </div>
          </div>
        )}

        {tab === "csv" && (
          <div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Sube un archivo .csv con el formato estándar del proveedor de dosimetría (columnas INSTITUCIÓN, DEPARTAMENTO, PERIODO, NOMBRE, RUN
              y las columnas de dosis trimestrales/acumuladas). Solo se cargarán filas cuyo RUN coincida con el listado de trabajadores.
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center hover:border-accent">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">{fileName || "Selecciona un archivo .csv"}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
            {csvMsg && (
              <p className={"mt-3 flex items-start gap-1 text-xs " + (csvState === "error" ? "text-danger" : csvState === "loading" ? "text-muted-foreground" : "text-success")}>
                {csvState === "loading" && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />}
                {csvState === "error" && <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {csvState === "ok" && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>{csvMsg}</span>
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
