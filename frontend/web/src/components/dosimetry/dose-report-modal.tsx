"use client";
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, X, Loader2, Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";

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

type PdfRow = {
  rowIndex: number;
  worker_run: string;
  worker_rut: string;
  worker_name_report: string;
  worker_name_system: string;
  worker_matched: boolean;
  institucion: string;
  departamento: string;
  year: number | null;
  quarter: number | null;
  period_label: string;
  dosimeter_number: string;
  dosimeter_type: string;
  radiation_type: string;
  proceso: string;
  hp10: number | null;
  hp3: number | null;
  hp007: number | null;
  accum_year_body: number | null;
  accum_12m_body: number | null;
  accum_60m_body: number | null;
  conflict: boolean;
  resolution: string;
};

export function DoseReportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"manual" | "csv" | "pdf">("manual");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<FormState>(emptyManual);
  const [manualState, setManualState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [manualMsg, setManualMsg] = useState("");

  const [csvState, setCsvState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [csvMsg, setCsvMsg] = useState("");
  const [fileName, setFileName] = useState("");

  const [pdfState, setPdfState] = useState<"idle" | "reading" | "ocr" | "analyzing" | "preview" | "saving" | "ok" | "error">("idle");
  const [pdfMsg, setPdfMsg] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const [pdfRows, setPdfRows] = useState<PdfRow[]>([]);
  const [pdfUsedOcr, setPdfUsedOcr] = useState(false);
  const [pdfHash, setPdfHash] = useState("");

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

  function resetPdfTab() {
    setPdfState("idle");
    setPdfMsg("");
    setPdfFileName("");
    setPdfFile(null);
    setPdfPreview(null);
    setPdfRows([]);
    setPdfUsedOcr(false);
    setPdfHash("");
  }

  function close() {
    setOpen(false);
    setForm(emptyManual);
    setManualState("idle");
    setManualMsg("");
    setCsvState("idle");
    setCsvMsg("");
    setFileName("");
    resetPdfTab();
    setTab("manual");
  }

  async function submitManual() {
    if (!form.worker_rut || !form.year || !form.quarter) {
      setManualState("error");
      setManualMsg("Selecciona trabajador, ano y trimestre.");
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
        "Archivo procesado: " + data.totalRows + " filas leidas · " + data.matchedGroups +
          " registros de trabajadores actualizados · " + data.unmatched +
          " filas sin coincidencia (nombres no encontrados en el listado de trabajadores)."
      );
      router.refresh();
    } catch (err) {
      setCsvState("error");
      setCsvMsg("No se pudo leer o procesar el archivo CSV.");
    }
  }

  function setRowResolution(idx: number, resolution: string) {
    setPdfRows((rs) => rs.map((r) => (r.rowIndex === idx ? { ...r, resolution } : r)));
  }

  async function handlePdfFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setPdfFileName(file.name);
    setPdfPreview(null);
    setPdfRows([]);
    setPdfState("reading");
    setPdfMsg("Leyendo PDF...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      setPdfHash(fileHash);

      const pdfjsLib: any = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => it.str ?? "").join(" ") + "\n";
      }

      let usedOcr = false;
      if (text.trim().length < 40 * pdf.numPages) {
        setPdfState("ocr");
        setPdfMsg("Texto no detectado: aplicando reconocimiento OCR (puede tardar unos segundos por pagina)...");
        const Tesseract: any = await import("tesseract.js");
        let ocrText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const { data } = await Tesseract.recognize(canvas, "spa");
            ocrText += (data?.text || "") + "\n";
          }
        }
        text = ocrText;
        usedOcr = true;
      }
      setPdfUsedOcr(usedOcr);

      setPdfState("analyzing");
      setPdfMsg("Analizando contenido del documento...");
      const res = await fetch("/api/dosimetry/import-pdf/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileHash, rawText: text, usedOcr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPdfState("error");
        setPdfMsg(data.error || "No se pudo analizar el documento.");
        return;
      }
      setPdfPreview(data);
      setPdfRows(data.rows || []);
      setPdfState("preview");
      setPdfMsg("");
    } catch (err) {
      setPdfState("error");
      setPdfMsg("No se pudo leer o procesar el archivo PDF.");
    }
  }

  async function confirmPdfImport() {
    if (!pdfFile) return;
    setPdfState("saving");
    setPdfMsg("Guardando importacion...");
    try {
      const fd = new FormData();
      fd.append("file", pdfFile);
      fd.append("rows", JSON.stringify(pdfRows));
      fd.append("usedOcr", String(pdfUsedOcr));
      fd.append("fileHash", pdfHash);
      fd.append("uploadedBy", "Usuario RPMS");
      const res = await fetch("/api/dosimetry/import-pdf/confirm", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPdfState("error");
        setPdfMsg(data.error || "No se pudo guardar la importacion.");
        return;
      }
      setPdfState("ok");
      setPdfMsg(
        "Importacion completada: " + data.created + " nuevo(s) - " + data.updated + " actualizado(s) - " +
          data.duplicated + " duplicado(s) - " + data.skipped + " omitido(s)."
      );
      setPdfPreview(null);
      setPdfRows([]);
      router.refresh();
    } catch {
      setPdfState("error");
      setPdfMsg("No se pudo guardar la importacion.");
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
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-5">
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
            Carga automatica (CSV)
          </button>
          <button
            type="button"
            onClick={() => setTab("pdf")}
            className={"flex-1 rounded px-2 py-1.5 font-medium " + (tab === "pdf" ? "bg-accent text-white" : "text-muted-foreground")}
          >
            Importar PDF
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
                  Ano <span className="text-danger">*</span>
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
                <span className="mb-1 block text-muted-foreground">Acumulado 5 anos - cuerpo (mSv)</span>
                <input
                  type="text"
                  value={form.accum_60m_body}
                  onChange={(e) => update("accum_60m_body", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
              </label>
              <label className="text-[11px]">
                <span className="mb-1 block text-muted-foreground">Institucion</span>
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
              Niveles de referencia (cuerpo entero por trimestre): Registro ≥ 0,1 mSv · Investigacion ≥ 1,6 mSv · Intervencion ≥ 5 mSv. El nivel se calcula automaticamente.
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
              Sube un archivo .csv con el formato estandar del proveedor de dosimetria (columnas INSTITUCION, DEPARTAMENTO, PERIODO, NOMBRE, RUN
              y las columnas de dosis trimestrales/acumuladas). Solo se cargaran filas cuyo RUN coincida con el listado de trabajadores.
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

        {tab === "pdf" && (
          <div>
            {pdfState === "idle" && (
              <>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Sube un archivo PDF con el reporte oficial de dosimetria personal. El sistema extrae el texto automaticamente
                  (usando OCR si el documento es una imagen escaneada), identifica trabajadores, periodos/trimestres y dosis, y
                  muestra una vista previa antes de guardar.
                </p>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center hover:border-accent">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">{pdfFileName || "Selecciona un archivo .pdf"}</span>
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePdfFile} />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent">
                    Cerrar
                  </button>
                </div>
              </>
            )}

            {(pdfState === "reading" || pdfState === "ocr" || pdfState === "analyzing" || pdfState === "saving") && (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{pdfMsg}</span>
              </div>
            )}

            {pdfState === "error" && (
              <div>
                <p className="flex items-start gap-1 text-xs text-danger">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{pdfMsg}</span>
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={resetPdfTab} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent">
                    Intentar de nuevo
                  </button>
                </div>
              </div>
            )}

            {pdfState === "ok" && (
              <div>
                <p className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {pdfMsg}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={resetPdfTab} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent">
                    Importar otro documento
                  </button>
                </div>
              </div>
            )}

            {pdfState === "preview" && pdfPreview && (
              <div>
                <div className="mb-3 rounded-md border border-border bg-background p-3 text-[11px]">
                  <p className="mb-1 font-medium">{pdfFileName}{pdfUsedOcr ? " (procesado con OCR)" : ""}</p>
                  <p className="text-muted-foreground">
                    Trabajadores detectados: {pdfPreview.workersDetected} · Registros encontrados: {pdfPreview.recordsFound} ·{" "}
                    Periodos: {(pdfPreview.periodsIdentified || []).join(", ") || "N/D"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Nuevos: {pdfPreview.newRecords} · Existentes (conflicto): {pdfPreview.existingRecords}
                    {pdfPreview.duplicateFile ? " · Este archivo ya fue importado antes" : ""}
                  </p>
                  {pdfPreview.errors?.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-danger">
                      {pdfPreview.errors.map((e: string, i: number) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {pdfPreview.warnings?.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-warning">
                      {pdfPreview.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted/60 text-left">
                      <tr>
                        <th className="px-2 py-1.5">Trabajador</th>
                        <th className="px-2 py-1.5">RUN</th>
                        <th className="px-2 py-1.5">Periodo</th>
                        <th className="px-2 py-1.5 text-right">Hp(10)</th>
                        <th className="px-2 py-1.5 text-right">Hp(3)</th>
                        <th className="px-2 py-1.5 text-right">Hp(0.07)</th>
                        <th className="px-2 py-1.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pdfRows.map((r) => (
                        <tr key={r.rowIndex}>
                          <td className="px-2 py-1.5">{r.worker_name_system || r.worker_name_report || "(sin nombre)"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{r.worker_run || "-"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{r.period_label || "-"}</td>
                          <td className="px-2 py-1.5 text-right">{r.hp10 ?? "-"}</td>
                          <td className="px-2 py-1.5 text-right">{r.hp3 ?? "-"}</td>
                          <td className="px-2 py-1.5 text-right">{r.hp007 ?? "-"}</td>
                          <td className="px-2 py-1.5">
                            {!r.worker_matched ? (
                              <span className="text-danger">RUN no encontrado</span>
                            ) : r.conflict ? (
                              <select
                                value={r.resolution}
                                onChange={(e) => setRowResolution(r.rowIndex, e.target.value)}
                                className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                              >
                                <option value="actualizar">Actualizar</option>
                                <option value="duplicar">Duplicar</option>
                                <option value="cancelar">Omitir</option>
                              </select>
                            ) : (
                              <span className="text-success">Nuevo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={resetPdfTab} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmPdfImport}
                    className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Confirmar importacion
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
