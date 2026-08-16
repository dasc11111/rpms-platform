"use client";

import { useCallback, useEffect, useState } from "react";

const NIVEL_LABELS: Record<string, string> = {
  vencida: "Vencido",
  rojo: "Vence en 7 dias o menos",
  naranjo: "Vence en 15 dias o menos",
  amarillo: "Vence en 30 dias o menos",
  verde: "En plazo",
  sin_fecha: "Sin fecha",
};

const NIVEL_COLORS: Record<string, string> = {
  vencida: "text-danger",
  rojo: "text-danger",
  naranjo: "text-warning",
  amarillo: "text-warning",
  verde: "text-success",
  sin_fecha: "text-muted-foreground",
};

const NIVEL_FILTERS = [
  { value: "", label: "Todos los niveles" },
  { value: "vencida", label: "Vencidos" },
  { value: "rojo", label: "Criticos (<=7 dias)" },
  { value: "naranjo", label: "Proximos (<=15 dias)" },
  { value: "amarillo", label: "Proximos (<=30 dias)" },
  { value: "verde", label: "En plazo" },
  { value: "sin_fecha", label: "Sin fecha" },
];

function SummaryBox({ label, value, colorClass }: any) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"mt-1 text-lg font-semibold " + (colorClass || "text-foreground")}>{value}</p>
    </div>
  );
}

function priorityForNivel(nivel: string) {
  if (nivel === "vencida" || nivel === "rojo") return "critica";
  if (nivel === "naranjo") return "alta";
  if (nivel === "amarillo") return "media";
  return "baja";
}

export function VencimientosTab({ facilityId, actorEmail }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [filterNivel, setFilterNivel] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/radioterapia/vencimientos?facilityId=" + facilityId);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  const categorias = Array.from(new Set(items.map((i: any) => i.categoria))).sort();

  const filteredItems = items.filter((i: any) => {
    if (filterNivel && i.nivel !== filterNivel) return false;
    if (filterCategoria && i.categoria !== filterCategoria) return false;
    return true;
  });

  async function handleCreateAction(item: any) {
    setCreatingId(item.id);
    try {
      await fetch("/api/radioterapia/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          actorEmail,
          actionType: "preventiva",
          origin: "vencimiento",
          originRef: item.id,
          description: item.categoria + ": " + item.descripcion,
          responsible: item.responsable,
          priority: priorityForNivel(item.nivel),
          dueDate: item.vencimiento,
          status: "pendiente",
        }),
      });
      setCreatedIds((prev) => new Set(prev).add(item.id));
    } finally {
      setCreatingId(null);
    }
  }

  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryBox label="Total" value={summary.total ?? 0} />
        <SummaryBox label="Vencidos" value={summary.vencidos ?? 0} colorClass="text-danger" />
        <SummaryBox label="Criticos (<=7d)" value={summary.criticos7 ?? 0} colorClass="text-danger" />
        <SummaryBox label="Proximos (<=15d)" value={summary.proximos15 ?? 0} colorClass="text-warning" />
        <SummaryBox label="Proximos (<=30d)" value={summary.proximos30 ?? 0} colorClass="text-warning" />
        <SummaryBox label="En plazo" value={summary.enPlazo ?? 0} colorClass="text-success" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Vencimientos consolidados</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Autorizaciones del acelerador, autorizacion de desempeno del personal, calibracion de instrumentos, capacitaciones, levantamientos radiometricos, proximas auditorias y hallazgos de auditoria con vencimiento pendiente.
        </p>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputCls} value={filterNivel} onChange={(e) => setFilterNivel(e.target.value)}>
            {NIVEL_FILTERS.map((n) => (<option key={n.value} value={n.value}>{n.label}</option>))}
          </select>
          <select className={inputCls} value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
            <option value="">Todas las categorias</option>
            {categorias.map((c: any) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <button className="rounded border border-border px-3 py-1.5 text-sm text-foreground" onClick={() => load()} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 pr-2">Categoria</th>
                <th className="py-1 pr-2">Descripcion</th>
                <th className="py-1 pr-2">Responsable</th>
                <th className="py-1 pr-2">Vencimiento</th>
                <th className="py-1 pr-2">Dias</th>
                <th className="py-1 pr-2">Estado</th>
                <th className="py-1 pr-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((i: any) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="py-1 pr-2">{i.categoria}</td>
                  <td className="py-1 pr-2">{i.descripcion}</td>
                  <td className="py-1 pr-2">{i.responsable || "-"}</td>
                  <td className="py-1 pr-2">{i.vencimiento ? String(i.vencimiento).slice(0, 10) : "-"}</td>
                  <td className="py-1 pr-2">{i.dias === null || i.dias === undefined ? "-" : i.dias}</td>
                  <td className={"py-1 pr-2 font-medium " + (NIVEL_COLORS[i.nivel] || "")}>{NIVEL_LABELS[i.nivel] || i.nivel}</td>
                  <td className="py-1 pr-2">
                    {createdIds.has(i.id) ? (
                      <span className="text-xs text-success">Accion creada</span>
                    ) : (
                      <button
                        className="rounded border border-border px-2 py-1 text-xs text-foreground"
                        onClick={() => handleCreateAction(i)}
                        disabled={creatingId === i.id}
                      >
                        {creatingId === i.id ? "Creando..." : "Crear accion"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td className="py-2 text-muted-foreground" colSpan={7}>Sin vencimientos para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
