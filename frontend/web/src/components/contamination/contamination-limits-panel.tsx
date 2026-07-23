"use client";

import { useEffect, useState } from "react";
import { Save, Settings2 } from "lucide-react";

type LimitRow = {
  radionuclido: string;
  limite_bq_m2: number;
  pct_registro: number;
  pct_investigacion: number;
  pct_intervencion: number;
  notas: string | null;
};

const INPUT = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

// Conversion de despliegue: el limite se almacena internamente en Bq/m2 (para
// mantener compatibilidad con el calculo de clasificacion en el backend), pero
// se mide e informa al usuario en Bq/cm2, la unidad en la que efectivamente se
// registra y compara la actividad superficial en este modulo.
// 1 Bq/cm2 = 10000 Bq/m2.
function bqM2ToBqCm2(bqM2: number): number {
  return bqM2 / 10000;
}
function bqCm2ToBqM2(bqCm2: number): number {
  return bqCm2 * 10000;
}

// Panel de configuracion de limites de contaminacion superficial. Permite
// ajustar, para cada radionuclido, el nivel de referencia derivado (Bq/cm²) y
// los tres umbrales porcentuales (Registro / Investigacion / Intervencion)
// SIN modificar el codigo de la aplicacion (ver /api/contamination/limits).
export function ContaminationLimitsPanel({ open }: { open: boolean }) {
  const [rows, setRows] = useState<LimitRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/contamination/limits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRows(data.rows ?? []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  function update(radionuclido: string, patch: Partial<LimitRow>) {
    setRows((rs) => rs.map((r) => (r.radionuclido === radionuclido ? { ...r, ...patch } : r)));
  }

  async function save(row: LimitRow) {
    setSaving(row.radionuclido);
    setMessage(null);
    try {
      const res = await fetch("/api/contamination/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "No se pudo guardar el límite.");
      } else {
        setMessage(`Límite de ${row.radionuclido} actualizado.`);
        load();
      }
    } catch {
      setMessage("Error de red al guardar el límite.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Settings2 className="h-4 w-4" /> Límites de contaminación configurables (por radionúclido)
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Estos valores son parámetros ajustables, no están fijos en el código. Cada medición se compara
        automáticamente contra el límite derivado (Bq/cm²) del radionúclido correspondiente, y se clasifica según los
        umbrales de Registro / Investigación / Intervención definidos aquí.
      </p>
      {message && <div className="mb-3 rounded-md border border-accent/30 bg-accent-subtle px-3 py-2 text-xs">{message}</div>}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.radionuclido} className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-3 md:grid-cols-6">
            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">Radionúclido</label>
              <input className={INPUT} value={row.radionuclido} disabled />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">Límite (Bq/cm²)</label>
              <input
                type="number"
                step="0.0001"
                className={INPUT}
                value={bqM2ToBqCm2(row.limite_bq_m2)}
                onChange={(e) => update(row.radionuclido, { limite_bq_m2: bqCm2ToBqM2(Number(e.target.value)) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">% Registro</label>
              <input
                type="number"
                className={INPUT}
                value={row.pct_registro}
                onChange={(e) => update(row.radionuclido, { pct_registro: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">% Investigación</label>
              <input
                type="number"
                className={INPUT}
                value={row.pct_investigacion}
                onChange={(e) => update(row.radionuclido, { pct_investigacion: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">% Intervención</label>
              <input
                type="number"
                className={INPUT}
                value={row.pct_intervencion}
                onChange={(e) => update(row.radionuclido, { pct_intervencion: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2 flex items-end gap-2 md:col-span-6">
              <input
                className={INPUT}
                placeholder="Notas / referencia normativa"
                value={row.notas ?? ""}
                onChange={(e) => update(row.radionuclido, { notas: e.target.value })}
              />
              <button
                onClick={() => save(row)}
                disabled={saving === row.radionuclido}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {saving === row.radionuclido ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Cargando límites configurados...</p>}
      </div>
    </div>
  );
}
