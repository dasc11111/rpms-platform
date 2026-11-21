"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Form";
import { Alert } from "@/components/ui/Feedback";
import { TIPO_MEDICION_OPTIONS, AREA_TIPO_OPTIONS, decisionMetrologicaLabel } from "@/lib/waste-expert-ui";

type Calibration = {
  id: number;
  instrumento: string;
  metodo: string;
  geometria: string | null;
  vigente: boolean;
};

type FormState = {
  tipo_medicion: string;
  fecha: string;
  hora: string;
  instrumento: string;
  calibration_id: string;
  cps_bruto: string;
  cps_fondo: string;
  tiempo_medicion_s: string;
  tiempo_fondo_s: string;
  area_medicion_cm2: string;
  area_tipo: string;
  tipo_superficie: string;
  tasa_dosis_bruta_usv_h: string;
  tasa_dosis_fondo_usv_h: string;
  limite_tasa_dosis_usv_h: string;
  distancia_cm: string;
  posicion: string;
  usuario: string;
  observaciones: string;
};

function emptyForm(): FormState {
  return {
    tipo_medicion: "directa",
    fecha: new Date().toISOString().slice(0, 10),
    hora: "",
    instrumento: "",
    calibration_id: "",
    cps_bruto: "",
    cps_fondo: "",
    tiempo_medicion_s: "",
    tiempo_fondo_s: "",
    area_medicion_cm2: "",
    area_tipo: "",
    tipo_superficie: "",
    tasa_dosis_bruta_usv_h: "",
    tasa_dosis_fondo_usv_h: "",
    limite_tasa_dosis_usv_h: "",
    distancia_cm: "",
    posicion: "",
    usuario: "",
    observaciones: "",
  };
}

export function WasteExpertMeasurementModal({ wasteItemId, radionuclideCode }: { wasteItemId: number; radionuclideCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const [resultInfo, setResultInfo] = useState<string | null>(null);

  const esContaminacion = form.tipo_medicion === "directa" || form.tipo_medicion === "wipe";

  useEffect(() => {
    if (!open || !esContaminacion) return;
    fetch(`/api/waste-calibration?radionuclide_code=${encodeURIComponent(radionuclideCode)}&vigente=true`)
      .then((res) => res.json())
      .then((data) => setCalibrations(data.calibrations ?? []))
      .catch(() => setCalibrations([]));
  }, [open, esContaminacion, radionuclideCode]);

  function update<K extends keyof FormState>(field: K, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(emptyForm());
    setState("idle");
    setMessage("");
    setResultInfo(null);
    setOpen(true);
  }

  async function submit() {
    if (!form.tipo_medicion || !form.fecha) {
      setState("error");
      setMessage("Tipo de medición y fecha son obligatorios.");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        tipo_medicion: form.tipo_medicion,
        fecha: form.fecha,
        hora: form.hora || null,
        instrumento: form.instrumento || null,
        calibration_id: form.calibration_id ? Number(form.calibration_id) : null,
        usuario: form.usuario || null,
        observaciones: form.observaciones || null,
        distancia_cm: form.distancia_cm ? Number(form.distancia_cm) : null,
        posicion: form.posicion || null,
      };
      if (esContaminacion) {
        body.cps_bruto = form.cps_bruto ? Number(form.cps_bruto) : null;
        body.cps_fondo = form.cps_fondo ? Number(form.cps_fondo) : null;
        body.tiempo_medicion_s = form.tiempo_medicion_s ? Number(form.tiempo_medicion_s) : null;
        body.tiempo_fondo_s = form.tiempo_fondo_s ? Number(form.tiempo_fondo_s) : null;
        body.area_medicion_cm2 = form.area_medicion_cm2 ? Number(form.area_medicion_cm2) : null;
        body.area_tipo = form.area_tipo || null;
        body.tipo_superficie = form.tipo_superficie || null;
      } else {
        body.tasa_dosis_bruta_usv_h = form.tasa_dosis_bruta_usv_h ? Number(form.tasa_dosis_bruta_usv_h) : null;
        body.tasa_dosis_fondo_usv_h = form.tasa_dosis_fondo_usv_h ? Number(form.tasa_dosis_fondo_usv_h) : null;
        if (form.limite_tasa_dosis_usv_h) body.limite_tasa_dosis_usv_h = Number(form.limite_tasa_dosis_usv_h);
      }

      const res = await fetch(`/api/waste-items/${wasteItemId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "No se pudo registrar la medición.");
        return;
      }
      setState("success");
      const bloqueos = (data.bloqueos ?? []) as string[];
      const decision = data.metrologia?.decision ? decisionMetrologicaLabel(data.metrologia.decision) : null;
      setResultInfo(
        [
          `Nuevo estado de la ficha: ${data.estado}.`,
          decision ? `Resultado metrológico: ${decision}.` : null,
          bloqueos.length > 0 ? `Bloqueos detectados: ${bloqueos.join("; ")}.` : null,
        ]
          .filter(Boolean)
          .join(" ")
      );
      router.refresh();
    } catch {
      setState("error");
      setMessage("No se pudo registrar la medición. Intenta nuevamente.");
    }
  }

  return (
    <>
      <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={openModal}>
        Registrar medición
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar medición"
        size="lg"
        footer={
          state === "success" ? (
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} loading={state === "loading"}>
                Registrar medición
              </Button>
            </>
          )
        }
      >
        {state === "success" ? (
          <Alert tone="success" title="Medición registrada">
            {resultInfo}
          </Alert>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo de medición" required>
              <Select value={form.tipo_medicion} onChange={(e) => update("tipo_medicion", e.target.value)}>
                {TIPO_MEDICION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={(e) => update("fecha", e.target.value)} />
            </FormField>
            <FormField label="Hora">
              <Input type="time" value={form.hora} onChange={(e) => update("hora", e.target.value)} />
            </FormField>
            <FormField label="Instrumento">
              <Input value={form.instrumento} onChange={(e) => update("instrumento", e.target.value)} />
            </FormField>

            {esContaminacion ? (
              <>
                <FormField label="Calibración aplicable" hint="Solo se listan calibraciones vigentes para este radionúclido.">
                  <Select value={form.calibration_id} onChange={(e) => update("calibration_id", e.target.value)}>
                    <option value="">— Sin calibración —</option>
                    {calibrations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.instrumento} · {c.metodo} {c.geometria ? `· ${c.geometria}` : ""}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Tipo de superficie" hint="Debe coincidir con un criterio de contaminación configurado.">
                  <Input value={form.tipo_superficie} onChange={(e) => update("tipo_superficie", e.target.value)} />
                </FormField>
                <FormField label="cps bruto">
                  <Input type="number" step="any" value={form.cps_bruto} onChange={(e) => update("cps_bruto", e.target.value)} />
                </FormField>
                <FormField label="cps fondo">
                  <Input type="number" step="any" value={form.cps_fondo} onChange={(e) => update("cps_fondo", e.target.value)} />
                </FormField>
                <FormField label="Tiempo de medición (s)">
                  <Input type="number" step="any" value={form.tiempo_medicion_s} onChange={(e) => update("tiempo_medicion_s", e.target.value)} />
                </FormField>
                <FormField label="Tiempo de fondo (s)">
                  <Input type="number" step="any" value={form.tiempo_fondo_s} onChange={(e) => update("tiempo_fondo_s", e.target.value)} />
                </FormField>
                <FormField label="Área medida (cm²)" hint="Nunca se asume igual al área del detector.">
                  <Input type="number" step="any" value={form.area_medicion_cm2} onChange={(e) => update("area_medicion_cm2", e.target.value)} />
                </FormField>
                <FormField label="Tipo de área">
                  <Select value={form.area_tipo} onChange={(e) => update("area_tipo", e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {AREA_TIPO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Tasa de dosis bruta (µSv/h)">
                  <Input type="number" step="any" value={form.tasa_dosis_bruta_usv_h} onChange={(e) => update("tasa_dosis_bruta_usv_h", e.target.value)} />
                </FormField>
                <FormField label="Tasa de dosis de fondo (µSv/h)">
                  <Input type="number" step="any" value={form.tasa_dosis_fondo_usv_h} onChange={(e) => update("tasa_dosis_fondo_usv_h", e.target.value)} />
                </FormField>
                <FormField label="Límite aplicable (µSv/h)" hint="Opcional: solo si existe un límite explícito a evaluar." className="col-span-2">
                  <Input type="number" step="any" value={form.limite_tasa_dosis_usv_h} onChange={(e) => update("limite_tasa_dosis_usv_h", e.target.value)} />
                </FormField>
              </>
            )}

            <FormField label="Distancia (cm)">
              <Input type="number" step="any" value={form.distancia_cm} onChange={(e) => update("distancia_cm", e.target.value)} />
            </FormField>
            <FormField label="Posición">
              <Input value={form.posicion} onChange={(e) => update("posicion", e.target.value)} />
            </FormField>
            <FormField label="Usuario">
              <Input value={form.usuario} onChange={(e) => update("usuario", e.target.value)} />
            </FormField>
            <FormField label="Observaciones" className="col-span-2">
              <Input value={form.observaciones} onChange={(e) => update("observaciones", e.target.value)} />
            </FormField>
          </div>
        )}
        {message ? (
          <Alert tone="danger" className="mt-3">
            {message}
          </Alert>
        ) : null}
      </Modal>
    </>
  );
}
