"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea, Select } from "@/components/ui/Form";
import { Alert } from "@/components/ui/Feedback";

const CHECKLIST: { key: string; label: string }[] = [
  { key: "criterio_contaminacion_vigente", label: "Criterio de contaminación aplicado, identificado y vigente" },
  { key: "instrumento_calibracion_vigente", label: "Instrumento y calibración vigentes para el radionúclido" },
  { key: "medicion_valida_consistente", label: "Última medición válida y consistente con la predicción teórica" },
  { key: "sin_bloqueos_activos", label: "Sin bloqueos automáticos activos registrados en el historial" },
  { key: "documentacion_completa", label: "Documentación y trazabilidad completas para esta ficha" },
];

export function WasteExpertAuthorizeModal({ wasteItemId, estado }: { wasteItemId: number; estado: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"verificacion" | "liberacion">("verificacion");
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  function openModal() {
    setTipo(estado === "pendiente_verificacion" ? "verificacion" : "liberacion");
    setAutorizadoPor("");
    setObservaciones("");
    setChecklist({});
    setState("idle");
    setMessage("");
    setOpen(true);
  }

  function toggleCheck(key: string) {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  }

  async function submit() {
    if (!autorizadoPor) {
      setState("error");
      setMessage("El campo 'Autorizado por' es obligatorio.");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/waste-items/${wasteItemId}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          autorizado_por: autorizadoPor,
          observaciones: observaciones || null,
          criterios_verificados: checklist,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo registrar la autorización.");
        return;
      }
      setState("success");
      setMessage(`Autorización registrada. Nuevo estado de la ficha: ${data.estado}.`);
      router.refresh();
    } catch {
      setState("error");
      setMessage("No se pudo registrar la autorización. Intenta nuevamente.");
    }
  }

  return (
    <>
      <Button variant="success" icon={<ShieldCheck className="h-4 w-4" />} onClick={openModal}>
        Verificar / Autorizar
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Verificación y autorización"
        footer={
          state === "success" ? (
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} loading={state === "loading"}>
                Registrar
              </Button>
            </>
          )
        }
      >
        {state === "success" ? (
          <Alert tone="success" title="Registrado">
            {message}
          </Alert>
        ) : (
          <div className="space-y-3">
            <Alert tone="warning" title="Principio de precaución">
              La liberación exige que la última medición cumpla explícitamente un criterio configurado y vigente, y
              que la ficha no esté bloqueada. Ante cualquier duda, use "Verificación" en vez de "Liberación".
            </Alert>
            <FormField label="Tipo de autorización" required>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as "verificacion" | "liberacion")}>
                <option value="verificacion">Verificación</option>
                <option value="liberacion">Liberación</option>
              </Select>
            </FormField>
            <FormField label="Autorizado por" required>
              <Input value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} />
            </FormField>
            <FormField label="Criterios verificados" hint="Marque los puntos efectivamente revisados antes de autorizar.">
              <div className="space-y-1.5 rounded-md border border-border p-2">
                {CHECKLIST.map((item) => (
                  <label key={item.key} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[item.key])}
                      onChange={() => toggleCheck(item.key)}
                      className="mt-0.5"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="Observaciones">
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
            </FormField>
          </div>
        )}
        {message && state === "error" ? (
          <Alert tone="danger" className="mt-3">
            {message}
          </Alert>
        ) : null}
      </Modal>
    </>
  );
}
