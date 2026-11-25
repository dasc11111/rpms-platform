"use client";


import { useEffect, useState } from "react";
import { RefreshCw, ArrowRightLeft, ChevronLeft, ChevronRight } from "lucide-react";

interface Movement {
  id: number; waste_label_id: number; movement_type: string; moved_at: string;
  moved_by: string | null; from_location: string | null; to_location: string | null;
  notes: string | null; service: string | null; sala: string | null;
  radionuclide_code: string | null; label_status: string | null;
}

const MT_LABELS: Record<string, string> = {
  ingreso: "Ingreso", traslado: "Traslado", liberacion: "Liberación",
  ajuste: "Ajuste", devolucion: "Devolución", baja: "Baja",
};
const MT_COLOR: Record<string, string> = {
  ingreso: "bg-blue-100 text-blue-700",
  traslado: "bg-purple-100 text-purple-700",
  liberacion: "bg-green-100 text-green-700",
  ajuste: "bg-yellow-100 text-yellow-700",
  devolucion: "bg-orange-100 text-orange-700",
  baja: "bg-red-100 text-red-700",
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WasteStorageMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterLabel, setFilterLabel] = useState("");
  const pageSize = 50;

  const fetchData = (p = page, labelId = filterLabel) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
    if (labelId.trim()) params.set("waste_label_id", labelId.trim());
    fetch(`/api/waste-storage/movements?${params}`)
      .then(r => r.json())
      .then(d => { setMovements(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><ArrowRightLeft className="h-6 w-6 text-purple-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Movimientos de Inventario</h1>
              <p className="text-sm text-gray-500">Historial de ingresos, traslados, liberaciones y ajustes</p>
            </div>
          </div>
          <button onClick={() => fetchData(page)} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Filtrar por ID de rótulo</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              type="number" min="1" value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
              placeholder="ID del rótulo (vacío = todos)"
            />
          </div>
          <button
            onClick={() => { setPage(1); fetchData(1, filterLabel); }}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg"
          >Buscar</button>
          {filterLabel && (
            <button onClick={() => { setFilterLabel(""); setPage(1); fetchData(1, ""); }} className="text-sm text-gray-400 hover:text-gray-600">Limpiar</button>
          )}
        </div>

        <div className="text-xs text-gray-400">{total} movimiento{total !== 1 ? "s" : ""} · Página {page}/{totalPages}</div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && movements.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Cargando…</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">Sin movimientos registrados.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs text-gray-400">
                  <th className="text-left px-4 py-3">Fecha/Hora</th>
                  <th className="text-left px-4 py-3">Rótulo</th>
                  <th className="text-left px-4 py-3">Radionúclido</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Desde → Hasta</th>
                  <th className="text-left px-4 py-3">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(m.moved_at)}</td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-blue-600">#{m.waste_label_id}</span>
                      {m.sala && <span className="ml-1 text-xs text-gray-400">{m.sala}</span>}
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{m.radionuclide_code || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MT_COLOR[m.movement_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {MT_LABELS[m.movement_type] ?? m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {m.from_location || "—"}{" "}<span className="text-gray-300">→</span>{" "}{m.to_location || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{m.moved_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4">
          <button disabled={page <= 1 || loading} onClick={() => { const p = page - 1; setPage(p); fetchData(p); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Anterior</button>
          <span className="text-sm text-gray-400">{page} / {totalPages}</span>
          <button disabled={page >= totalPages || loading} onClick={() => { const p = page + 1; setPage(p); fetchData(p); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30">Siguiente <ChevronRight className="h-4 w-4" /></button>
        </div>

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>DS N°133/1984 — Registro de movimientos de residuos radiactivos. DS N°12/2010 MINSAL — Trazabilidad del inventario de residuos. IAEA GSG-1 — Gestión y seguimiento de residuos radiactivos. CCHEN ORD sobre registros de operaciones con materiales radiactivos.</p>
        </div>
      </div>
    </div>
  );
}
