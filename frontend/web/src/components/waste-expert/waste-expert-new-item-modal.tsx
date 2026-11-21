"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea, Select } from "@/components/ui/Form";
import { Alert } from "@/components/ui/Feedback";
import { TIPO_RESIDUO_OPTIONS, UNIDAD_ACTIVIDAD_OPTIONS } from "@/lib/waste-expert-ui";
import type { RadionuclideOption } from "@/components/waste-expert/waste-expert-dashboard";

type FormState = {
  radionuclide_code: string;
  tipo_residuo: string;
  tipo_residuo_otro: string;
  descripcion: string;
  fecha_hora_generacion: string;
  actividad_inicial: string;
  unidad_actividad: string;
  masa_g: string;
  volumen_ml: string;
  superficie_estimada_cm2: string;
  ubicacion: string;
  contenedor: string;
  area_almacenamiento: string;
  responsable: string;
};

const emptyForm: FormState = {
  radionuclide_code: "",
  tipo_residuo: "",
  tipo_residuo_otro: "",
  descripcion: "",
  fecha_hora_generacion: "",
  actividad_inicial: "",
  unidad_actividad: "mCi",
  masa_g: "",
  volumen_ml: "",
  superficie_estimada_cm2: "",
  ubicacion: "",
  contenedor: "",
  area_almacenamiento: "",
  responsable: "",
};

export function WasteExpertNewItemModal({ radionuclides }: { radionuclides: RadionuclideOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  function update<K extends keyof FormState>(field: K, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(emptyForm);
    setState("idle");
    setMessage("");
    setOpen(true);
  }

  async function submit() {
    if (!form.radionuclide_code || !form.tipo_residuo || !form.fecha_hora_generacion) {
      setState("error");
      setMessage("Radionúclido, tipo de residuo y fecha/hora de generación son obligatorios.");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waste-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radionuclide_code: form.radionuclide_code,
          tipo_residuo: form.tipo_residuo,
          tipo_residuo_otro: form.tipo_residuo === "otro" ? form.tipo_residuo_otro || null : null,
          descripcion: form.descripcion || null,
          fecha_hora_generacion: new Date(form.fecha_hora_generacion).toISOString(),
          actividad_inicial: form.actividad_inicial ? Number(form.actividad_inicial) : null,
          unidad_actividad: form.unidad_actividad,
          masa_g: form.masa_g ? Number(form.masa_g) : null,
          volumen_ml: form.volumen_ml ? Number(form.volumen_ml) : null,
          superficie_estimada_cm2: form.superficie_estimada_cm2 ? Number(form.superficie_estimada_cm2) : null,
          ubicacion: form.ubicacion || null,
          contenedor: form.contenedor || null,
          area_almacenamiento: form.area_almacenamiento || null,
          responsable: form.responsable || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo registrar la ficha del residuo.");
        return;
      }
      setOpen(false);
      router.refresh();
      if (data.item?.id) router.push(`/waste-expert/${data.item.id}`);
    } catch {
      setState("error");
      setMessage("No se pudo registrar la ficha del residuo. Intenta nuevamente.");
    }
  }

  return (
    <>
      <Button icon={<Plus className="h-4 w-4" />} onClick={openModal}>
        Nuevo residuo
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva ficha individual de residuo radiactivo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={state === "loading"}>
              Registrar ficha
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Radionúclido" required>
            <Select value={form.radionuclide_code} onChange={(e) => update("radionuclide_code", e.target.value)}>
              <option value="">— Seleccionar —</option>
              {radionuclides.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.symbol || r.code} — {r.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Tipo de residuo" required>
            <Select value={form.tipo_residuo} onChange={(e) => update("tipo_residuo", e.target.value)}>
              <option value="">— Seleccionar —</option>
              {TIPO_RESIDUO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          {form.tipo_residuo === "otro" ? (
            <FormField label="Especificar tipo de residuo" className="col-span-2">
              <Input value={form.tipo_residuo_otro} onChange={(e) => update("tipo_residuo_otro", e.target.value)} />
            </FormField>
          ) : null}
          <FormField label="Fecha y hora de generación" required>
            <Input type="datetime-local" value={form.fecha_hora_generacion} onChange={(e) => update("fecha_hora_generacion", e.target.value)} />
          </FormField>
          <FormField label="Responsable">
            <Input value={form.responsable} onChange={(e) => update("responsable", e.target.value)} />
          </FormField>
          <FormField label="Actividad inicial" hint="Predicción teórica: no reemplaza la medición real.">
            <Input type="number" step="any" value={form.actividad_inicial} onChange={(e) => update("actividad_inicial", e.target.value)} />
          </FormField>
          <FormField label="Unidad de actividad">
            <Select value={form.unidad_actividad} onChange={(e) => update("unidad_actividad", e.target.value)}>
              {UNIDAD_ACTIVIDAD_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Masa (g)">
            <Input type="number" step="any" value={form.masa_g} onChange={(e) => update("masa_g", e.target.value)} />
          </FormField>
          <FormField label="Volumen (ml)">
            <Input type="number" step="any" value={form.volumen_ml} onChange={(e) => update("volumen_ml", e.target.value)} />
          </FormField>
          <FormField label="Superficie estimada (cm²)">
            <Input type="number" step="any" value={form.superficie_estimada_cm2} onChange={(e) => update("superficie_estimada_cm2", e.target.value)} />
          </FormField>
          <FormField label="Ubicación">
            <Input value={form.ubicacion} onChange={(e) => update("ubicacion", e.target.value)} />
          </FormField>
          <FormField label="Contenedor">
            <Input value={form.contenedor} onChange={(e) => update("contenedor", e.target.value)} />
          </FormField>
          <FormField label="Área de almacenamiento">
            <Input value={form.area_almacenamiento} onChange={(e) => update("area_almacenamiento", e.target.value)} />
          </FormField>
          <FormField label="Descripción" className="col-span-2">
            <Textarea value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} rows={2} />
          </FormField>
        </div>
        {message ? (
          <Alert tone={state === "error" ? "danger" : "info"} className="mt-3">
            {message}
          </Alert>
        ) : null}
      </Modal>
    </>
  );
}
