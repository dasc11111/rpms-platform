"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";

type WorkerData = {
  rut: string;
  name: string;
  role?: string | null;
  service?: string | null;
  category?: string | null;
  annual_dose?: string | number | null;
  dv?: string | null;
  sex?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  estamento?: string | null;
  contract_type?: string | null;
  unit?: string | null;
};

type FormState = {
  rut: string;
  name: string;
  role: string;
  service: string;
  category: string;
  annual_dose: string;
  dv: string;
  sex: string;
  address: string;
  phone: string;
  email: string;
  birth_date: string;
  estamento: string;
  contract_type: string;
  unit: string;
};

const fields: { key: keyof FormState; label: string; required?: boolean }[] = [
  { key: "rut", label: "RUT (ej: 12.345.678-9)", required: true },
  { key: "name", label: "Nombre completo", required: true },
  { key: "role", label: "Cargo / descripción" },
  { key: "service", label: "Servicio" },
  { key: "unit", label: "Unidad" },
  { key: "estamento", label: "Estamento" },
  { key: "contract_type", label: "Calidad contractual" },
  { key: "category", label: "Categoría (ICRP)" },
  { key: "annual_dose", label: "Dosis anual (mSv)" },
  { key: "sex", label: "Sexo" },
  { key: "birth_date", label: "Fecha nacimiento" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo electrónico" },
  { key: "address", label: "Dirección particular" },
];

function toForm(worker: WorkerData): FormState {
  return {
    rut: worker.rut ?? "",
    name: worker.name ?? "",
    role: worker.role ?? "",
    service: worker.service ?? "",
    category: worker.category ?? "",
    annual_dose: worker.annual_dose != null ? String(worker.annual_dose) : "",
    dv: worker.dv ?? "",
    sex: worker.sex ?? "",
    address: worker.address ?? "",
    phone: worker.phone ?? "",
    email: worker.email ?? "",
    birth_date: worker.birth_date ?? "",
    estamento: worker.estamento ?? "",
    contract_type: worker.contract_type ?? "",
    unit: worker.unit ?? "",
  };
}

export function WorkerEditModal({ worker }: { worker: WorkerData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(worker));
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(toForm(worker));
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
      const res = await fetch("/api/workers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, original_rut: worker.rut }),
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
          <h2 className="text-sm font-semibold">Editar datos del trabajador</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Corrige los datos que estén equivocados y guarda los cambios.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {fields.map((f) => (
            <label key={f.key} className={f.key === "name" || f.key === "address" ? "col-span-2 text-[11px]" : "text-[11px]"}>
              <span className="mb-1 block text-muted-foreground">
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </span>
              <input
                type="text"
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </label>
          ))}
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
