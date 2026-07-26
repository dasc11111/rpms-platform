"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import { INSTRUMENT_STATUS_LABELS } from "@/lib/instruments";

type InstrumentType = { id: number; name: string };

type InstrumentData = {
  id: number;
  code: string;
  name: string;
  type_id?: number | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  service?: string | null;
  unit?: string | null;
  location?: string | null;
  acquisition_date?: string | null;
  provider?: string | null;
  status: string;
  notes?: string | null;
};

type FormState = {
  code: string;
  name: string;
  typeId: string;
  brand: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  service: string;
  unit: string;
  location: string;
  acquisitionDate: string;
  provider: string;
  status: string;
  notes: string;
};

function toForm(i: InstrumentData): FormState {
  return {
    code: i.code ?? "",
    name: i.name ?? "",
    typeId: i.type_id != null ? String(i.type_id) : "",
    brand: i.brand ?? "",
    model: i.model ?? "",
    serialNumber: i.serial_number ?? "",
    manufacturer: i.manufacturer ?? "",
    service: i.service ?? "",
    unit: i.unit ?? "",
    location: i.location ?? "",
    acquisitionDate: i.acquisition_date ? String(i.acquisition_date).slice(0, 10) : "",
    provider: i.provider ?? "",
    status: i.status ?? "operativo",
    notes: i.notes ?? "",
  };
}

const fields: { key: keyof FormState; label: string; required?: boolean }[] = [
  { key: "code", label: "Código interno", required: true },
  { key: "name", label: "Nombre", required: true },
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "serialNumber", label: "Número de serie" },
  { key: "manufacturer", label: "Fabricante" },
  { key: "service", label: "Servicio" },
  { key: "unit", label: "Unidad" },
  { key: "location", label: "Ubicación" },
  { key: "acquisitionDate", label: "Fecha de adquisición (AAAA-MM-DD)" },
  { key: "provider", label: "Proveedor" },
];

export function InstrumentEditModal({ instrument }: { instrument: InstrumentData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(instrument));
  const [types, setTypes] = useState<InstrumentType[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/instruments/types")
      .then((res) => res.json())
      .then((data) => setTypes(data.types ?? []))
      .catch(() => setTypes([]));
  }, [open]);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(toForm(instrument));
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
      const res = await fetch(`/api/instruments/${instrument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo guardar los cambios.");
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
          <h2 className="text-sm font-semibold">Editar instrumento</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {fields.map((f) => (
            <label key={f.key} className={f.key === "name" ? "col-span-2 text-[11px]" : "text-[11px]"}>
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
            <span className="mb-1 block text-muted-foreground">Tipo de instrumento</span>
            <select
              value={form.typeId}
              onChange={(e) => update("typeId", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="">— Sin especificar —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
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
              {Object.entries(INSTRUMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2 text-[11px]">
            <span className="mb-1 block text-muted-foreground">Observaciones</span>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
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
