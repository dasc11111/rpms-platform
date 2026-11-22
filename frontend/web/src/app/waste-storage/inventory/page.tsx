"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { RefreshCw, Warehouse, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface InventoryItem {
  id: number; waste_code: string; radionuclide_code: string; service: string | null;
  sala: string | null; entry_date: string; status: string; storage_location_id: number | null;
  location_name: string | null; initial_activity_bq: number | null;
  estimated_current_activity_bq: number | null; half_lives_elapsed: number | null;
  days_in_storage: number | null; days_until_eligible: number | null; is_eligible: boolean;
}

function semColor(status: string) {
  if (status === "liberado") return "bg-green-100 text-green-700";
  if (status === "pendiente") return "bg-yellow-100 text-yellow-700";
  if (status === "contaminado") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtBq(v: number | null) {
  if (v == null) return "—";
  if (v < 1e3) return v.toFixed(0) + " Bq";
  if (v < 1e6) return (v / 1e3).toFixed(1) + " kBq";
  if (v < 1e9) return (v / 1e6).toFixed(2) + " MBq";
  return (v / 1e9).toFixed(3) + " GBq";
}

export default function WasteStorageInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeReleased, setIncludeReleased] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchData = (ir = includeReleased) => {
    setLoading(true);
    fetch(`/api/waste-storage/inventory?includeReleased=${ir}`)
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const eligible = items.filter(i => i.is_eligible);
  const inStorage = items.filter(i => i.status !== "liberado");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100"><Warehouse className="h-6 w-6 text-teal-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventario de Almacenamiento</h1>
              <p className="text-sm text-gray-500">Residuos radiactivos en almacenamiento temporal — estado y actividad estimada</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* Alerts */}
        {eligible.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3 text-green-700 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span><strong>{eligible.length}</strong> residuo{eligible.length > 1 ? "s" : ""} elegible{eligible.length > 1 ? "s" : ""} para liberación por decaimiento.</span>
          </div>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "En almacenamiento", value: inStorage.length, color: "blue" },
            { label: "Elegibles liberación", value: eligible.length, color: "green" },
            { label: "Contaminados", value: items.filter(i => i.status === "contaminado").length, color: "red" },
            { label: "Total rastreados", value: items.length, color: "gray" },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold text-${t.color}-600`}>{t.value}</div>
              <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={includeReleased} onChange={e => { setIncludeReleased(e.target.checked); fetchData(e.target.checked); }} className="rounded" />
            Incluir liberados
          </label>
          <span className="text-sm text-gray-400">{items.length} registros</span>
        </div>

        {/* Inventory list */}
        {loading && items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Cargando inventario…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Sin residuos en almacenamiento.</div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-gray-400 shrink-0">{item.waste_code}</span>
                    <span className="font-semibold text-gray-800">{item.radionuclide_code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${semColor(item.status)}`}>{item.status}</span>
                    {item.is_eligible && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Listo</span>}
                    <span className="text-sm text-gray-500 truncate">{item.location_name || "Sin ubicación"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 shrink-0 ml-4">
                    <span>{item.days_in_storage != null ? `${item.days_in_storage} días` : ""}</span>
                    {expanded === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {expanded === item.id && (
                  <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-gray-50 rounded-b-xl">
                    <div><div className="text-xs text-gray-400 mb-0.5">Actividad inicial</div><div className="font-semibold">{fmtBq(item.initial_activity_bq)}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Actividad estimada</div><div className="font-semibold">{fmtBq(item.estimated_current_activity_bq)}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Semividas transcurridas</div><div className="font-semibold">{item.half_lives_elapsed != null ? item.half_lives_elapsed.toFixed(1) : "—"}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Días para elegibilidad</div><div className={`font-semibold ${item.is_eligible ? "text-green-600" : item.days_until_eligible != null && item.days_until_eligible <= 30 ? "text-orange-600" : ""}`}>{item.is_eligible ? "Elegible" : item.days_until_eligible != null ? `${item.days_until_eligible} días` : "—"}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Ingreso</div><div>{fmtDate(item.entry_date)}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Sala</div><div>{item.sala || "—"}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Servicio</div><div>{item.service || "—"}</div></div>
                    <div><div className="text-xs text-gray-400 mb-0.5">Ubicación</div><div>{item.location_name || "—"}</div></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>DS N°133/1984 Ministerio de Minería — Almacenamiento temporal de residuos radiactivos. DS N°12/2010 MINSAL — Gestión de residuos radiactivos en instalaciones médicas. IAEA GSG-1 — Classification of Radioactive Waste. CCHEN ORD sobre criterios de liberación por decaimiento (10 períodos de semidesintegración).</p>
        </div>
      </div>
    </div>
  );
}
