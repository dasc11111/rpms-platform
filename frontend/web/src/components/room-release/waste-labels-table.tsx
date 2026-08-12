"use client";

import { useEffect, useState } from "react";
import { Download, Eye, PlusCircle, RefreshCw } from "lucide-react";
import type { WasteLabel } from "@/lib/waste";
import { WASTE_DISPENSA_ESTADO_LABELS } from "@/lib/waste";
import { WasteStandaloneCreateModal } from "./waste-standalone-create-modal";

type WasteLabelRow = WasteLabel & {
  lot_number?: string | null;
  dispensa_estado?: string | null;
};

function DispensaBadge({ estado }: { estado?: string | null }) {
  if (!estado) return <span className="text-muted-foreground">—</span>;
  const label = WASTE_DISPENSA_ESTADO_LABELS[estado] ?? estado;
  const toneClass =
    estado === "apto_para_dispensa" || estado === "dispensado"
    ? "bg-success/15 text-success"
    : estado === "no_apto"
    ? "bg-destructive/15 text-destructive"
    : estado === "pendiente_verificacion_final"
    ? "bg-warning/15 text-warning"
    : "bg-muted text-muted-foreground";
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{label}</span>;
}

export function WasteLabelsTable({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [rows, setRows] = useState<WasteLabelRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/waste-labels?pageSize=100&sort=generation_date&dir=desc")
      .then((res) => (res.ok ? res.json() : { rows: [], total: 0 }))
      .then((data) => {
        if (!active) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [version]);
  
  const pendientesVerificacion = rows.filter((r) => r.dispensa_estado === "pendiente_verificacion_final");
  const aptosParaDispensa = rows.filter((r) => r.dispensa_estado === "apto_para_dispensa");
  
  return (
    <div className="space-y-3">
      {(pendientesVerificacion.length > 0 || aptosParaDispensa.length > 0) && (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
        {pendientesVerificacion.length > 0 && (
        <div>
        <span className="font-medium">{pendientesVerificacion.length} residuo(s)</span> alcanzaron el criterio
        de contaminación en su última medición de seguimiento y requieren una{" "}
        <span className="font-medium">verificación final</span> (con tasa de dosis) para confirmar aptitud de
        dispensa:{" "}
          {pendientesVerificacion.map((r) => r.label_number).join(", ")}.
        </div>
      )}
        {aptosParaDispensa.length > 0 && (
        <div className={pendientesVerificacion.length > 0 ? "mt-1" : undefined}>
        <span className="font-medium">{aptosParaDispensa.length} residuo(s)</span> están{" "}
        <span className="font-medium">aptos para dispensa</span> y pendientes de confirmación por el OPR:{" "}
          {aptosParaDispensa.map((r) => r.label_number).join(", ")}.
        </div>
      )}
      </div>
    )}
    
    <div className="rounded-lg border border-border bg-surface">
    <div className="flex items-center justify-between border-b border-border p-3">
    <div className="text-sm font-medium">
    Rótulos de Residuos Radiactivos <span className="text-muted-foreground">({total})</span>
    </div>
    <div className="flex flex-wrap gap-2">
    <button
      onClick={() => setCreateOpen(true)}
      className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:opacity-90"
      >
    <PlusCircle className="h-3.5 w-3.5" /> Nuevo residuo
    </button>
    <a
      href="/api/waste-labels/export?dataset=labels&format=csv"
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
    <Download className="h-3.5 w-3.5" /> CSV
    </a>
    <a
      href="/api/waste-labels/export?dataset=labels&format=xlsx"
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
    <Download className="h-3.5 w-3.5" /> Excel
    </a>
    <a
      href="/api/waste-labels/export?dataset=history&format=csv"
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
    <Download className="h-3.5 w-3.5" /> Historial CSV
    </a>
    <a
      href="/api/waste-labels/export?dataset=history&format=xlsx"
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
    <Download className="h-3.5 w-3.5" /> Historial Excel
    </a>
    </div>
    </div>
    <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
    <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
    <tr>
    <th className="px-3 py-2">N° Rótulo</th>
    <th className="px-3 py-2">N° Lote</th>
    <th className="px-3 py-2">Fecha</th>
    <th className="px-3 py-2">Servicio</th>
    <th className="px-3 py-2">Sala</th>
    <th className="px-3 py-2">Radionúclido</th>
    <th className="px-3 py-2">Actividad est.</th>
    <th className="px-3 py-2">Estado dispensa</th>
    <th className="px-3 py-2">Impresiones</th>
    <th className="px-3 py-2">Acciones</th>
    </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
      <tr key={r.id} className="border-t border-border">
      <td className="px-3 py-2 font-medium">{r.label_number}</td>
      <td className="px-3 py-2 text-muted-foreground">{r.lot_number ?? "—"}</td>
      <td className="px-3 py-2">{r.generation_date}</td>
      <td className="px-3 py-2">{r.service}</td>
      <td className="px-3 py-2">{r.sala}</td>
      <td className="px-3 py-2">{r.radionuclide_code}</td>
      <td className="px-3 py-2">
        {r.actividad_estimada_residual !== null ? Number(r.actividad_estimada_residual).toFixed(2) : "—"}{" "}
        {r.unidad_actividad}
      </td>
      <td className="px-3 py-2">
      <DispensaBadge estado={r.dispensa_estado} />
      </td>
      <td className="px-3 py-2">{r.print_count}</td>
      <td className="px-3 py-2">
      <a
        href={`/waste-management/label/${r.id}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
      <Eye className="h-3.5 w-3.5" /> Ver / Medir
      </a>
      </td>
      </tr>
      ))}
      {rows.length === 0 && !loading && (
      <tr>
      <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
      No hay rótulos generados todavía.
      </td>
      </tr>
    )}
      {loading && (
      <tr>
      <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
      <RefreshCw className="mx-auto h-4 w-4 animate-spin" />
      </td>
      </tr>
    )}
    </tbody>
    </table>
    </div>
    </div>
    
    <WasteStandaloneCreateModal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onCreated={() => {
        setCreateOpen(false);
        onChanged();
      }}
      />
    </div>
    );
}
