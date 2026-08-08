"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, History as HistoryIcon } from "lucide-react";

const CATEGORIES = [
  { value: "fotones", label: "Fotones" },
  { value: "electrones", label: "Electrones" },
  { value: "mlc", label: "MLC" },
  { value: "colimadores", label: "Colimadores" },
  { value: "epid", label: "EPID" },
  { value: "cbct", label: "CBCT" },
  { value: "mesa", label: "Mesa de tratamiento" },
  { value: "imagenes", label: "Sistemas de imagenes" },
];
const MEASUREMENT_TYPES = [
  { value: "factor_salida", label: "Factor de salida" },
  { value: "pdd", label: "PDD" },
  { value: "tpr", label: "TPR" },
  { value: "perfil", label: "Perfil de haz" },
  { value: "simetria", label: "Simetria" },
  { value: "planicidad", label: "Planicidad" },
  { value: "factor_cuna", label: "Factor de cuna" },
  { value: "factor_bandeja", label: "Factor de bandeja" },
  { value: "factor_campo_pequeno", label: "Factor de campo pequeno" },
  { value: "curva", label: "Curva" },
  { value: "matriz", label: "Matriz de datos" },
  { value: "otro", label: "Otro" },
];

export function BaselineTab({ unitId }: any) {
  const [category, setCategory] = useState("todos");
  const [baselines, setBaselines] = useState<any[]>([]);
  const [historyFor, setHistoryFor] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    if (!unitId) return;
    const url = "/api/linac/baseline?linacId=" + unitId + (category !== "todos" ? "&category=" + category : "");
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) setBaselines(data.baselines);
  }, [unitId, category]);

  useEffect(() => { load(); }, [load]);

  async function viewHistory(b: any) {
    const res = await fetch("/api/linac/baseline?linacId=" + unitId + "&category=" + b.category + "&history=1");
    const data = await res.json();
    if (data.ok) {
      setHistoryRows(data.baselines.filter((h: any) => h.measurement_type === b.measurement_type && h.modality === b.modality && h.energy === b.energy));
      setHistoryFor(b);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Lock className="h-4 w-4" /> Linea Base Oficial
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Los registros de esta seccion se generan automaticamente cuando un dataset de Commissioning finalizado se
          marca como Linea Base. Nunca se modifican: cada actualizacion crea una nueva version autorizada, y todas
          las comparaciones de Control de Calidad deben referenciar la version vigente (v actual) que se muestra aqui.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        <button onClick={() => setCategory("todos")} className={"rounded px-2.5 py-1.5 text-xs " + (category === "todos" ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}>
          Todos
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)} className={"rounded px-2.5 py-1.5 text-xs " + (category === c.value ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1">Categoria</th><th className="p-1">Tipo de medicion</th><th className="p-1">Modalidad</th>
              <th className="p-1">Energia</th><th className="p-1">Version vigente</th><th className="p-1">Aprobado por</th>
              <th className="p-1">Fecha aprobacion</th><th className="p-1">Origen (dataset)</th><th className="p-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {baselines.map((b: any) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-1 text-foreground">{CATEGORIES.find((c) => c.value === b.category)?.label || b.category}</td>
                <td className="p-1 text-foreground">{MEASUREMENT_TYPES.find((m) => m.value === b.measurement_type)?.label || b.measurement_type}</td>
                <td className="p-1 text-foreground">{b.modality || "-"}</td>
                <td className="p-1 text-foreground">{b.energy || "-"}</td>
                <td className="p-1 font-medium text-warning">v{b.version}</td>
                <td className="p-1 text-foreground">{b.approved_by || "-"}</td>
                <td className="p-1 text-foreground">{b.approved_at ? String(b.approved_at).slice(0, 10) : "-"}</td>
                <td className="p-1 text-foreground">{b.measurement_date ? String(b.measurement_date).slice(0, 10) : "-"}</td>
                <td className="p-1">
                  <div className="flex gap-1">
                    <button onClick={() => setDetail(b)} className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">Ver</button>
                    <button onClick={() => viewHistory(b)} className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background">
                      <HistoryIcon className="h-3 w-3" /> Historial
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {baselines.length === 0 && (
              <tr><td colSpan={9} className="p-2 text-center text-muted-foreground">Aun no hay lineas base oficiales registradas. Marca un dataset de Commissioning finalizado como "Linea Base" para generarla automaticamente.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Detalle de Linea Base - {MEASUREMENT_TYPES.find((m) => m.value === detail.measurement_type)?.label} v{detail.version}
            </p>
            <button onClick={() => setDetail(null)} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">Cerrar</button>
          </div>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="p-1">X</th><th className="p-1">Y</th><th className="p-1">Unidad</th></tr></thead>
            <tbody>
              {(Array.isArray(detail.data?.points) ? detail.data.points : []).map((p: any, idx: number) => (
                <tr key={idx} className="border-t border-border">
                  <td className="p-1 text-foreground">{p.x}</td><td className="p-1 text-foreground">{p.y}</td><td className="p-1 text-foreground">{p.unit || "-"}</td>
                </tr>
              ))}
              {(!detail.data?.points || detail.data.points.length === 0) && (
                <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Sin puntos registrados</td></tr>
              )}
            </tbody>
          </table>
          {detail.notes && (<p className="mt-2 text-xs text-foreground"><span className="text-muted-foreground">Notas de aprobacion: </span>{detail.notes}</p>)}
        </div>
      )}

      {historyFor && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Historial de versiones - {MEASUREMENT_TYPES.find((m) => m.value === historyFor.measurement_type)?.label}
            </p>
            <button onClick={() => setHistoryFor(null)} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">Cerrar</button>
          </div>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="p-1">Version</th><th className="p-1">Vigente</th><th className="p-1">Aprobado por</th><th className="p-1">Fecha aprobacion</th></tr></thead>
            <tbody>
              {historyRows.map((h: any) => (
                <tr key={h.id} className="border-t border-border">
                  <td className="p-1 text-foreground">v{h.version}</td>
                  <td className="p-1 text-foreground">{h.is_current ? <span className="text-success">Si</span> : "No"}</td>
                  <td className="p-1 text-foreground">{h.approved_by || "-"}</td>
                  <td className="p-1 text-foreground">{h.approved_at ? String(h.approved_at).slice(0, 10) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
