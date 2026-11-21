"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
WASTE_STANDALONE_TYPE_OPTIONS,
STANDALONE_WASTE_TYPE_RADIONUCLIDE,
type WasteStorageLocation,
} from "@/lib/waste";

export function WasteStandaloneCreateModal({
open,
onClose,
onCreated,
}: {
open: boolean;
onClose: () => void;
onCreated: (row: unknown) => void;
}) {
const [wasteType, setWasteType] = useState(WASTE_STANDALONE_TYPE_OPTIONS[0]?.value ?? "capacho_i131");
const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
const [cps, setCps] = useState("");
const [cpsFondo, setCpsFondo] = useState("0");
const [tasaDosis, setTasaDosis] = useState("");
const [storageLocationId, setStorageLocationId] = useState("");
const [locations, setLocations] = useState<WasteStorageLocation[]>([]);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
if (!open) return;
fetch("/api/waste-storage/locations")
  .then((r) => (r.ok ? r.json() : { rows: [] }))
  .then((d) => setLocations(d.rows ?? []))
  .catch(() => {});
}, [open]);

useEffect(() => {
if (open) {
setWasteType(WASTE_STANDALONE_TYPE_OPTIONS[0]?.value ?? "capacho_i131");
setFecha(new Date().toISOString().slice(0, 10));
setCps("");
setCpsFondo("0");
setTasaDosis("");
setStorageLocationId("");
setError(null);
}
}, [open]);

if (!open) return null;

const radionuclido = STANDALONE_WASTE_TYPE_RADIONUCLIDE[wasteType] ?? "—";

async function handleSubmit() {
setError(null);
if (cps.trim() === "" || Number.isNaN(Number(cps)) || Number(cps) < 0) {
setError("Debe ingresar las cuentas por segundo (cps) medidas, un numero valido y no negativo.");
return;
}
if (cpsFondo.trim() !== "" && (Number.isNaN(Number(cpsFondo)) || Number(cpsFondo) < 0)) {
setError("Las cps de fondo deben ser un numero valido y no negativo.");
return;
}
if (tasaDosis.trim() !== "" && (Number.isNaN(Number(tasaDosis)) || Number(tasaDosis) < 0)) {
setError("La tasa de dosis debe ser un numero valido y no negativo.");
return;
}
setSaving(true);
try {
const res = await fetch("/api/waste-labels", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  waste_type: wasteType,
  fecha,
  cps: Number(cps),
  cps_fondo: cpsFondo.trim() === "" ? 0 : Number(cpsFondo),
  tasa_dosis_usv_h: tasaDosis.trim() === "" ? null : Number(tasaDosis),
  storage_location_id: storageLocationId ? Number(storageLocationId) : null,
  }),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
setError(json.error ?? "No se pudo generar el rotulo del residuo.");
return;
}
onCreated(json);
} catch {
setError("Error de red al generar el rotulo del residuo.");
} finally {
setSaving(false);
}
}

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="w-full max-w-md rounded-lg bg-surface border border-border shadow-xl">
<div className="flex items-center justify-between border-b border-border p-4">
<h2 className="text-sm font-semibold">Nuevo residuo radiactivo (independiente)</h2>
  <button onClick={onClose} className="rounded p-1 hover:bg-muted">
<X className="h-4 w-4" />
</button>
  </div>
  <div className="space-y-3 p-4">
<p className="text-xs text-muted-foreground">
Para residuos generados sin Acta de Liberacion de Sala: capacho de I-131, generador de
  Mo-99/Tc-99m y material cortopunzante de Tc-99m. El sistema genera automaticamente el N de
  rotulo y el N de lote, y calcula la actividad superficial (Bq/cm2) a partir de las cps medidas.
  </p>

<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de residuo</label>
  <select
  value={wasteType}
onChange={(e) => setWasteType(e.target.value)}
className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
  >
{WASTE_STANDALONE_TYPE_OPTIONS.map((o) => (
  <option key={o.value} value={o.value}>
  {o.label}
  </option>
  ))}
</select>
  <p className="mt-1 text-[11px] text-muted-foreground">Radionúclido: {radionuclido}</p>
  </div>

<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha de medición</label>
  <input
  type="date"
  value={fecha}
onChange={(e) => setFecha(e.target.value)}
className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
  />
</div>

<div className="grid grid-cols-2 gap-2">
<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">CPS medida</label>
  <input
  type="number"
  value={cps}
onChange={(e) => setCps(e.target.value)}
className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
  placeholder="Ej: 500"
  />
</div>
  <div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">CPS de fondo</label>
  <input
  type="number"
  value={cpsFondo}
onChange={(e) => setCpsFondo(e.target.value)}
className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
  placeholder="Ej: 20"
  />
</div>
  </div>

<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">
Tasa de dosis (µSv/h) — opcional en este registro
  </label>
  <input
  type="number"
  value={tasaDosis}
onChange={(e) => setTasaDosis(e.target.value)}
className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
  placeholder="Ej: 3.0"
  />
</div>

<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">
Ubicación de almacenamiento (opcional)
  </label>
  <select
  value={storageLocationId}
onChange={(e) => setStorageLocationId(e.target.value)}
className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
  >
<option value="">Sin asignar</option>
  {locations.map((loc) => (
    <option key={loc.id} value={loc.id}>
    {loc.name}
    </option>
    ))}
</select>
  </div>

{error && <p className="text-xs text-red-600">{error}</p>}
</div>
  <div className="flex justify-end gap-2 border-t border-border p-4">
<button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
Cancelar
  </button>
  <button
  onClick={handleSubmit}
disabled={saving}
className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50"
  >
{saving ? "Generando..." : "Generar rótulo"}
</button>
  </div>
  </div>
  </div>
  );
}
