"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Bell, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Alert { id: number; linac_id: number; module: string; level: string; status: string; title: string; description: string | null; created_at: string; resolved_at: string | null; resolved_by: string | null; criteria_parameter: string | null; criteria_source: string | null; }

const LEVEL_STYLE: Record<string, string> = { critica: "bg-red-100 text-red-700", alta: "bg-orange-100 text-orange-700", media: "bg-yellow-100 text-yellow-700", baja: "bg-blue-100 text-blue-700" };
const inp = "rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

function fmtDate(d: string) { return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

export default function LinacAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("abierta");
  const [levelFilter, setLevelFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ linacId });
    if (moduleFilter) p.set("module", moduleFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (levelFilter) p.set("level", levelFilter);
    fetch(`/api/linac/alerts?${p}`)
      .then(r => r.json())
      .then(d => setAlerts(d.alerts ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [linacId, moduleFilter, statusFilter, levelFilter]);

  const resolve = async (id: number) => {
    setMsg("");
    const r = await fetch("/api/linac/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "resuelta", resolvedBy: "usuario" }) });
    const d = await r.json();
    if (d.ok) { setMsg("Alerta resuelta."); load(); }
    else setMsg(d.error ?? "Error");
  };

  const criticas = alerts.filter(a => a.level === "critica" && a.status === "abierta").length;
  const abiertas = alerts.filter(a => a.status === "abierta").length;
  const modules = [...new Set(alerts.map(a => a.module))];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><Bell className="h-6 w-6 text-red-700" /></div>
            <div><h1 className="text-2xl font-bold text-gray-900">Alertas LINAC</h1><p className="text-sm text-gray-500">Alertas científicas y de control de calidad</p></div>
          </div>
          <button onClick={load} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {criticas > 0 && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-2 text-red-700 font-semibold text-sm"><AlertTriangle className="h-4 w-4" /> {criticas} alerta{criticas > 1 ? "s" : ""} crítica{criticas > 1 ? "s" : ""} abiert{criticas > 1 ? "as" : "a"}</div>}
        {msg && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: alerts.length },
            { label: "Abiertas", value: abiertas, color: abiertas > 0 ? "text-orange-600" : "text-gray-700" },
            { label: "Críticas", value: criticas, color: criticas > 0 ? "text-red-600" : "text-gray-700" },
            { label: "Resueltas", value: alerts.filter(a => a.status === "resuelta").length },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${t.color ?? "text-gray-700"}`}>{t.value}</div>
              <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <select className={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos estados</option>
            <option value="abierta">Abierta</option>
            <option value="resuelta">Resuelta</option>
            <option value="ignorada">Ignorada</option>
          </select>
          <select className={inp} value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
            <option value="">Todos niveles</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <select className={inp} value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
            <option value="">Todos módulos</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input className={inp + " w-24"} type="number" min="1" placeholder="LINAC ID" value={linacId} onChange={e => setLinacId(e.target.value)} />
        </div>

        {/* Alert cards */}
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className={`bg-white rounded-xl border shadow-sm ${alert.status === "abierta" && alert.level === "critica" ? "border-red-200" : "border-gray-200"}`}>
              <button className="w-full flex items-start justify-between px-5 py-4 text-left" onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>
                <div className="flex items-start gap-3">
                  {alert.status === "resuelta" ? <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />}
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{alert.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{alert.module} · {fmtDate(alert.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_STYLE[alert.level] ?? "bg-gray-100 text-gray-600"}`}>{alert.level}</span>
                  {expanded === alert.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>
              {expanded === alert.id && (
                <div className="px-5 pb-4 pt-0 border-t border-gray-50 space-y-2">
                  {alert.description && <p className="text-sm text-gray-600">{alert.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    {alert.criteria_parameter && <span>Parámetro: {alert.criteria_parameter}</span>}
                    {alert.criteria_source && <span>Fuente: {alert.criteria_source}</span>}
                    {alert.resolved_at && <span>Resuelto: {fmtDate(alert.resolved_at)}</span>}
                    {alert.resolved_by && <span>Por: {alert.resolved_by}</span>}
                  </div>
                  {alert.status === "abierta" && (
                    <button onClick={() => resolve(alert.id)} className="mt-2 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg">Marcar resuelta</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {alerts.length === 0 && !loading && <div className="text-center py-12 text-gray-400">No hay alertas para los filtros seleccionados</div>}

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>AAPM TG-142 — Gestión de alertas y no conformidades en CC de aceleradores. IAEA TECDOC-1040 — Sistema de notificación de eventos en radioterapia. DS N°12/2010 MINSAL — Requisitos de registro y seguimiento de incidencias.</p>
        </div>
      </div>
    </div>
  );
}
