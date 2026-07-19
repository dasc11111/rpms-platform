"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2 } from "lucide-react";

const emptyForm = {
  rut: "",
  name: "",
  role: "",
  service: "",
  category: "",
  annual_dose: "",
  dv: "",
  sex: "",
  address: "",
  phone: "",
  email: "",
  birth_date: "",
  estamento: "",
  contract_type: "",
  unit: "",
};

type FormState = typeof emptyForm;

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

export function WorkerFormModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function close() {
    setOpen(false);
    setForm(emptyForm);
    setState("idle");
    setMessage("");
  }

  async function submit() {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/workers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo guardar el trabajador.");
        return;
      }
      close();
      router.refresh();
    } catch {
      setState("error");
      setMessage("No se pudo guardar el trabajador. Intenta nuevamente.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-accent"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Nuevo trabajador
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ingreso manual de trabajador</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Si el RUT ingresado corresponde a un trabajador dado de baja anteriormente, sus datos se
          restaurarán automáticamente y volverá a quedar activo (modo recordar).
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
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
