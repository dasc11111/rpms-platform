"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export type RadionuclideDef = {
  code: string;
  label: string;
  activityLabel: string;
  allowsMultiple: boolean;
};

export type I131Activity = { id?: number; label: string; activityMci: string };

export type ShipmentRecord = {
  id: number;
  transportDate: string;
  correlativeNumber: number;
  itValue: number | null;
  doseContact: number | null;
  dose1m: number | null;
  doseVehicle: number | null;
  materialCode: string;
  requestedActivityMci: number | null;
  i131Activities: { id?: number; label: string | null; activityMci: number | null }[];
  driverName: string | null;
  oprName: string | null;
  signageDosimeter: boolean;
  signageRadiactivo7: boolean;
  signageNu2915: boolean;
  notes: string | null;
};

export function ShipmentModal({
  open,
  onClose,
  onSaved,
  radionuclides,
  editing,
  defaultDate,
  actorEmail,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  radionuclides: RadionuclideDef[];
  editing?: ShipmentRecord | null;
  defaultDate?: string;
  actorEmail: string;
}) {
  const [transportDate, setTransportDate] = useState(defaultDate || "");
  const [correlativeNumber, setCorrelativeNumber] = useState<string>("");
  const [itValue, setItValue] = useState("");
  const [doseContact, setDoseContact] = useState("");
  const [dose1m, setDose1m] = useState("");
  const [doseVehicle, setDoseVehicle] = useState("");
  const [materialCode, setMaterialCode] = useState(radionuclides[0]?.code || "MO_TC99");
  const [requestedActivityMci, setRequestedActivityMci] = useState("");
  const [i131Activities, setI131Activities] = useState<I131Activity[]>([{ label: "", activityMci: "" }]);
  const [driverName, setDriverName] = useState("");
  const [oprName, setOprName] = useState("");
  const [signageDosimeter, setSignageDosimeter] = useState(false);
  const [signageRadiactivo7, setSignageRadiactivo7] = useState(false);
  const [signageNu2915, setSignageNu2915] = useState(false);
  const [notes, setNotes] = useState("");
  const [drivers, setDrivers] = useState<string[]>([]);
  const [oprs, setOprs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/transport/drivers")
      .then((r) => r.json())
      .then((d) => setDrivers((d.drivers || []).map((x: any) => x.name)))
      .catch(() => {});
    fetch("/api/transport/oprs")
      .then((r) => r.json())
      .then((d) => setOprs((d.oprs || []).map((x: any) => x.name)))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTransportDate(editing.transportDate?.slice(0, 10) || "");
      setCorrelativeNumber(String(editing.correlativeNumber ?? ""));
      setItValue(editing.itValue !== null ? String(editing.itValue) : "");
      setDoseContact(editing.doseContact !== null ? String(editing.doseContact) : "");
      setDose1m(editing.dose1m !== null ? String(editing.dose1m) : "");
      setDoseVehicle(editing.doseVehicle !== null ? String(editing.doseVehicle) : "");
      setMaterialCode(editing.materialCode);
      setRequestedActivityMci(editing.requestedActivityMci !== null ? String(editing.requestedActivityMci) : "");
      setI131Activities(
        editing.i131Activities.length > 0
          ? editing.i131Activities.map((a) => ({ id: a.id, label: a.label || "", activityMci: a.activityMci !== null ? String(a.activityMci) : "" }))
          : [{ label: "", activityMci: "" }]
      );
      setDriverName(editing.driverName || "");
      setOprName(editing.oprName || "");
      setSignageDosimeter(editing.signageDosimeter);
      setSignageRadiactivo7(editing.signageRadiactivo7);
      setSignageNu2915(editing.signageNu2915);
      setNotes(editing.notes || "");
    } else {
      setTransportDate(defaultDate || "");
      setCorrelativeNumber("");
      setItValue("");
      setDoseContact("");
      setDose1m("");
      setDoseVehicle("");
      setMaterialCode(radionuclides[0]?.code || "MO_TC99");
      setRequestedActivityMci("");
      setI131Activities([{ label: "", activityMci: "" }]);
      setDriverName("");
      setOprName("");
      setSignageDosimeter(false);
      setSignageRadiactivo7(false);
      setSignageNu2915(false);
      setNotes("");
    }
    setError(null);
  }, [open, editing, defaultDate, radionuclides]);

  const selectedMaterial = radionuclides.find((r) => r.code === materialCode);
  const dose1mNum = Number(dose1m);
  const doseVehicleNum = Number(doseVehicle);
  const exceeds1m = dose1m !== "" && !Number.isNaN(dose1mNum) && dose1mNum > 100;
  const exceedsVehicle = doseVehicle !== "" && !Number.isNaN(doseVehicleNum) && doseVehicleNum > 2000;

  const i131Total = useMemo(() => {
    const values = i131Activities.map((a) => Number(a.activityMci)).filter((n) => !Number.isNaN(n) && n > 0);
    const total = values.reduce((acc, v) => acc + v, 0);
    return { total, count: values.length, avg: values.length > 0 ? total / values.length : 0 };
  }, [i131Activities]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        transportDate,
        correlativeNumber: correlativeNumber ? Number(correlativeNumber) : undefined,
        itValue: itValue === "" ? null : Number(itValue),
        doseContact: doseContact === "" ? null : Number(doseContact),
        dose1m: dose1m === "" ? null : Number(dose1m),
        doseVehicle: doseVehicle === "" ? null : Number(doseVehicle),
        materialCode,
        requestedActivityMci:
          materialCode !== "I131" && requestedActivityMci !== "" ? Number(requestedActivityMci) : null,
        i131Activities:
          materialCode === "I131"
            ? i131Activities
                .filter((a) => a.activityMci !== "" && !Number.isNaN(Number(a.activityMci)))
                .map((a) => ({ label: a.label, activityMci: Number(a.activityMci) }))
            : [],
        driverName: driverName || null,
        oprName: oprName || null,
        signageDosimeter,
        signageRadiactivo7,
        signageNu2915,
        notes: notes || null,
        actorEmail,
      };

      const url = editing ? "/api/transport/" + editing.id : "/api/transport";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setError(data.error || "No se pudo guardar el transporte.");
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Error de red al guardar el transporte.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? "Editar transporte #" + editing.correlativeNumber : "Nuevo transporte"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Fecha</label>
            <input
              type="date"
              value={transportDate}
              onChange={(e) => setTransportDate(e.target.value)}
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
              disabled={!!editing}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">N correlativo (automatico, editable)</label>
            <input
              type="number"
              value={correlativeNumber}
              onChange={(e) => setCorrelativeNumber(e.target.value)}
              placeholder="Automatico"
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Indice de Transporte (IT)</label>
            <input
              type="number"
              step="0.01"
              value={itValue}
              onChange={(e) => setItValue(e.target.value)}
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Contacto con el bulto (uSv/h)</label>
            <input
              type="number"
              step="0.01"
              value={doseContact}
              onChange={(e) => setDoseContact(e.target.value)}
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">A 1 metro del bulto (uSv/h) &middot; limite {"<"} 100</label>
            <input
              type="number"
              step="0.01"
              value={dose1m}
              onChange={(e) => setDose1m(e.target.value)}
              className={"w-full rounded border p-2 text-sm text-foreground " + (exceeds1m ? "border-danger bg-danger/10" : "border-border bg-background")}
            />
            {exceeds1m && (
              <p className="mt-1 flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={12} /> Supera el limite reglamentario de 100 uSv/h
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Contacto con el vehiculo (uSv/h) &middot; limite {"<"} 2000</label>
            <input
              type="number"
              step="0.01"
              value={doseVehicle}
              onChange={(e) => setDoseVehicle(e.target.value)}
              className={"w-full rounded border p-2 text-sm text-foreground " + (exceedsVehicle ? "border-danger bg-danger/10" : "border-border bg-background")}
            />
            {exceedsVehicle && (
              <p className="mt-1 flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={12} /> Supera el limite reglamentario de 2000 uSv/h
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-muted-foreground">Tipo de material transportado</label>
          <div className="flex flex-wrap gap-3">
            {radionuclides.map((r) => (
              <label key={r.code} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={materialCode === r.code}
                  onChange={() => setMaterialCode(r.code)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        {materialCode !== "I131" ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted-foreground">{selectedMaterial?.activityLabel || "Actividad (mCi)"}</label>
            <input
              type="number"
              step="0.01"
              value={requestedActivityMci}
              onChange={(e) => setRequestedActivityMci(e.target.value)}
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
          </div>
        ) : (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted-foreground">Actividades individuales (una por paciente/pedido)</label>
            <div className="space-y-2">
              {i131Activities.map((act, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Referencia / paciente"
                    value={act.label}
                    onChange={(e) => {
                      const value = e.target.value;
                      setI131Activities((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, label: value } : item))
                      );
                    }}
                    className="flex-1 rounded border border-border bg-background p-2 text-sm text-foreground"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="mCi"
                    value={act.activityMci}
                    onChange={(e) => {
                      const value = e.target.value;
                      setI131Activities((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, activityMci: value } : item))
                      );
                    }}
                    className="w-28 rounded border border-border bg-background p-2 text-sm text-foreground"
                  />
                  <button
                    onClick={() => setI131Activities(i131Activities.filter((_, i) => i !== idx))}
                    className="rounded border border-border px-2 text-sm text-muted-foreground hover:bg-background"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setI131Activities([...i131Activities, { label: "", activityMci: "" }])}
              className="mt-2 rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-background"
            >
              + Agregar capsula/pedido
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Actividad total: {i131Total.total.toFixed(2)} mCi &middot; N pedidos: {i131Total.count} &middot; Promedio por pedido:{" "}
              {i131Total.avg.toFixed(2)} mCi
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs text-muted-foreground">Senaletica obligatoria</label>
          <div className="flex flex-wrap gap-2">
            <label
              className={"flex items-center gap-2 rounded border px-3 py-2 text-sm " + (signageDosimeter ? "border-success bg-success/10 text-success" : "border-border text-foreground")}
            >
              <input type="checkbox" checked={signageDosimeter} onChange={(e) => setSignageDosimeter(e.target.checked)} />
              Uso de Dosimetro
            </label>
            <label
              className={"flex items-center gap-2 rounded border px-3 py-2 text-sm " + (signageRadiactivo7 ? "border-success bg-success/10 text-success" : "border-border text-foreground")}
            >
              <input type="checkbox" checked={signageRadiactivo7} onChange={(e) => setSignageRadiactivo7(e.target.checked)} />
              Senal "RADIACTIVO 7"
            </label>
            <label
              className={"flex items-center gap-2 rounded border px-3 py-2 text-sm " + (signageNu2915 ? "border-success bg-success/10 text-success" : "border-border text-foreground")}
            >
              <input type="checkbox" checked={signageNu2915} onChange={(e) => setSignageNu2915(e.target.checked)} />
              Panel "NU 2915"
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Conductor</label>
            <input
              list="transport-drivers-list"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
            <datalist id="transport-drivers-list">
              {drivers.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">OPR responsable</label>
            <input
              list="transport-oprs-list"
              value={oprName}
              onChange={(e) => setOprName(e.target.value)}
              className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
            />
            <datalist id="transport-oprs-list">
              {oprs.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-muted-foreground">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-background">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !transportDate}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar transporte"}
          </button>
        </div>
      </div>
    </div>
  );
}
