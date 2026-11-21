"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, AlertTriangle } from "lucide-react";

const emptyForm = {
  workerRut: "",
  workerName: "",
  service: "",
  unit: "",
  deliveryDate: new Date().toISOString().slice(0, 10),
  estimatedReturnDate: "",
  observations: "",
};

type FormState = typeof emptyForm;

const fields: { key: keyof FormState; label: string; required?: boolean }[] = [
  { key: "workerRut", label: "RUN trabajador", required: true },
  { key: "workerName", label: "Nombre trabajador", required: true },
  { key: "service", label: "Servicio" },
  { key: "unit", label: "Unidad" },
];

export function DosimeterAssignModal({ dosimeterId, code }: { dosimeterId: number; code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [state, setState] = useState<"idle" | "loading" | "error" | "conflict">("idle");
  const [message, setMessage] = useState("");
  const [conflictInfo, setConflictInfo] = useState<{ workerName: string | null } | null>(null);

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(emptyForm);
    setState("idle");
    setMessage("");
    setConflictInfo(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function submit(override = false) {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/dosimeters/${dosimeterId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, override }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "already_assigned") {
        setState("conflict");
        setConflictInfo({ workerName: data.currentWorkerName ?? data.currentWorkerRut ?? "otro trabajador" });
        setMessage(`Este dosimetro ya esta asignado a ${data.currentWorkerName ?? data.currentWorkerRut}. Confirma explicitamente si deseas reasignarlo.`);
        return;
      }
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo asignar el dosimetro.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setState("error");
      setMessage("No se pudo asignar el dosimetro. Intenta nuevamente.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:border-accent"
      >
        <UserPlus className="h-3 w-3" />
        Asignar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Asignar dosimetro {code}</h2>
          <button type="button" onClick={close} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {fields.map((f) => (
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
            <span className="mb-1 block text-muted-foreground">Fecha de entrega</span>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={(e) => update("deliveryDate", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </label>
          <label className="text-[11px]">
            <span className="mb-1 block text-muted-foreground">Fecha estimada de devolucion</span>
            <input
              type="date"
              value={form.estimatedReturnDate}
              onChange={(e) => update("estimatedReturnDate", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </label>
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
          <div className={`mt-3 flex items-start gap-1.5 text-xs ${state === "error" ? "text-danger" : "text-warning"}`}>
            {state === "conflict" && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>{message}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-accent"
          >
            Cancelar
          </button>
          {state === "conflict" ? (
            <button
              type="button"
              onClick={() => submit(true)}
              className="flex items-center gap-1.5 rounded-md border border-danger bg-danger px-3 py-1.5 text-xs font-medium text-white"
            >
              Confirmar reemplazo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={state === "loading"}
              className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {state === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Asignar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
