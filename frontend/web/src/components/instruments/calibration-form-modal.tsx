"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Upload } from "lucide-react";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/instruments";

type Company = { id: number; name: string };

type FormState = {
  calibrationDate: string;
  expiryDate: string;
  companyId: string;
  companyName: string;
  certificateNumber: string;
  calibrationFactor: string;
  magnitude: string;
  units: string;
  method: string;
  standardUsed: string;
  notes: string;
  category: string;
};

const emptyForm: FormState = {
  calibrationDate: "",
  expiryDate: "",
  companyId: "",
  companyName: "",
  certificateNumber: "",
  calibrationFactor: "",
  magnitude: "",
  units: "",
  method: "",
  standardUsed: "",
  notes: "",
  category: "certificado",
};

const textFields: { key: keyof FormState; label: string; required?: boolean }[] = [
  { key: "certificateNumber", label: "N° de certificado" },
  { key: "calibrationFactor", label: "Factor de calibración" },
  { key: "magnitude", label: "Magnitud calibrada" },
  { key: "units", label: "Unidades" },
  { key: "method", label: "Método" },
  { key: "standardUsed", label: "Patrón utilizado" },
];

export function CalibrationFormModal({ instrumentId }: { instrumentId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/instruments/companies")
      .then((res) => res.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]));
  }, [open]);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(emptyForm);
    setFiles([]);
    setState("idle");
    setMessage("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function submit() {
    if (!form.calibrationDate) {
      setState("error");
      setMessage("La fecha de calibración es obligatoria.");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const body = new FormData();
      body.append("calibrationDate", form.calibrationDate);
      body.append("expiryDate", form.expiryDate);
      if (form.companyId === "__new__") {
        body.append("companyName", form.companyName);
      } else if (form.companyId) {
        body.append("companyId", form.companyId);
      }
      body.append("certificateNumber", form.certificateNumber);
      body.append("calibrationFactor", form.calibrationFactor);
      body.append("magnitude", form.magnitude);
      body.append("units", form.units);
      body.append("method", form.method);
      body.append("standardUsed", form.standardUsed);
      body.append("notes", form.notes);
      for (const file of files) {
        body.append("files", file);
        body.append("categories", form.category);
      }

      const res = await fetch(`/api/instruments/${instrumentId}/calibrations`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo registrar la calibración.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setState("error");
      setMessage("No se pudo registrar la calibración. Intenta nuevamente.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        Registrar calibración
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Registrar calibración</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="text-[11px]">
            <span className="mb-1 block text-muted-foreground">
              Fecha de calibración<span className="text-danger"> *</span>
            </span>
            <input
              type="date"
              value={form.calibrationDate}
              onChange={(e) => update("calibrationDate", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="text-[11px]">
            <span className="mb-1 block text-muted-foreground">Fecha de vencimiento</span>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => update("expiryDate", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="col-span-2 text-[11px]">
            <span className="mb-1 block text-muted-foreground">Empresa / laboratorio calibrador</span>
            <select
              value={form.companyId}
              onChange={(e) => update("companyId", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="">— Sin especificar —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Otra empresa (especificar)</option>
            </select>
          </label>
          {form.companyId === "__new__" && (
            <label className="col-span-2 text-[11px]">
              <span className="mb-1 block text-muted-foreground">Nombre de la nueva empresa</span>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </label>
          )}
          {textFields.map((f) => (
            <label key={f.key} className="text-[11px]">
              <span className="mb-1 block text-muted-foreground">{f.label}</span>
              <input
                type="text"
                value={form[f.key] as string}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </label>
          ))}
          <label className="col-span-2 text-[11px]">
            <span className="mb-1 block text-muted-foreground">Observaciones</span>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="text-[11px]">
            <span className="mb-1 block text-muted-foreground">Categoría de los documentos</span>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex h-8 cursor-pointer items-center gap-1.5 self-end rounded-md border border-border bg-background px-3 text-xs font-medium hover:border-accent">
            <Upload className="h-3.5 w-3.5" />
            {files.length > 0 ? `${files.length} archivo(s) seleccionado(s)` : "Adjuntar documentos"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
          </label>
        </div>

        {message && (
          <p className={`mt-3 text-xs ${state === "error" ? "text-danger" : "text-success"}`}>{message}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={state === "loading"}
            className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {state === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar calibración
          </button>
        </div>
      </div>
    </div>
  );
}
