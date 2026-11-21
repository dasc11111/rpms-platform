"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import { DOSIMETER_TYPE_LABELS, DOSIMETER_STATUS_LABELS } from "@/lib/dosimeters";

type DosimeterData = {
  id: number;
  code: string;
  type: string;
  status: string;
  worker_rut?: string | null;
  worker_name?: string | null;
  service?: string | null;
  unit?: string | null;
  delivery_date?: string | null;
  estimated_return_date?: string | null;
  actual_return_date?: string | null;
  observations?: string | null;
};

type FormState = {
  code: string;
  type: string;
  status: string;
  workerRut: string;
  workerName: string;
  service: string;
  unit: string;
  deliveryDate: string;
  estimatedReturnDate: string;
  actualReturnDate: string;
  observations: string;
};

function toForm(d: DosimeterData): FormState {
  return {
    code: d.code ?? "",
    type: d.type ?? "cuerpo_entero",
    status: d.status ?? "disponible",
    workerRut: d.worker_rut ?? "",
    workerName: d.worker_name ?? "",
    service: d.service ?? "",
    unit: d.unit ?? "",
    deliveryDate: d.delivery_date ? String(d.delivery_date).slice(0, 10) : "",
    estimatedReturnDate: d.estimated_return_date ? String(d.estimated_return_date).slice(0, 10) : "",
    actualReturnDate: d.actual_return_date ? String(d.actual_return_date).slice(0, 10) : "",
    observations: d.observations ?? "",
  };
}

const textFields: { key: keyof FormState; label: string; required?: boolean }[] = [
  { key: "code", label: "Codigo XA", required: true },
  { key: "workerRut", label: "RUN trabajador" },
  { key: "workerName", label: "Trabajador asignado" },
  { key: "service", label: "Servicio" },
  { key: "unit", label: "Unidad" },
];

const dateFields: { key: keyof FormState; label: string }[] = [
  { key: "deliveryDate", label: "Fecha de entrega" },
  { key: "estimatedReturnDate", label: "Fecha estimada de devolucion" },
  { key: "actualReturnDate", label: "Fecha efectiva de devolucion" },
];

export function DosimeterEditModal({ dosimeter }: { dosimeter: DosimeterData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(dosimeter));
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(toForm(dosimeter));
    setState("idle");
    setMessage("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function submit() {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/dosimeters/${dosimeter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error === "code_already_exists" ? "Ya existe un dosimetro con ese codigo XA." : data.error || "No se pudo guardar los cambios.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setState("error");
      setMessage("No se pudo guardar los cambios. Intenta nuevamente.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:border-accent"
      >
        <Pencil className="h-3 w-3" />
        Editar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Editar dosimetro</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {textFields.map((f) => (
            <label key={f.key} className="text-[11px]">
              <span className="mb-1 block text-muted-foreground">
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </span>
              <input
                type="text"
                value={form[f.key] as string}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </label>
          ))}
          <label className="text-[11px]">
            <span className="mb-1 block text-muted-foreground">Tipo de dosimetro</span>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              {Object.entries(DOSIMETER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px]">
            <span className="mb-1 block text-muted-foreground">Estado</span>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              {Object.entries(DOSIMETER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {dateFields.map((f) => (
            <label key={f.key} className="text-[11px]">
              <span className="mb-1 block text-muted-foreground">{f.label}</span>
              <input
                type="date"
                value={form[f.key] as string}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </label>
          ))}
          <label className="col-span-2 text-[11px]">
            <span className="mb-1 block text-muted-foreground">Observaciones</span>
            <textarea
              value={form.observations}
              onChange={(e) => update("observations", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
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
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
