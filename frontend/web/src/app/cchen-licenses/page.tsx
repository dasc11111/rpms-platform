"use client";
export const dynamic = "force-dynamic";

// §159 — Gestión de Licencias y Autorizaciones CCHEN
// DS 3/1985 Arts. 7-14 · CCHEN NS-05.0 §3

import { useEffect, useState, useCallback } from "react";
import {
  FileCheck, AlertTriangle, CheckCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Plus, X, Calendar, ExternalLink
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

interface License {
  id: number;
  license_number: string;
  license_type: string;
  holder_name: string;
  holder_rut: string;
  facility_name: string;
  scope: string;
  conditions: string;
  issue_date: string;
  expiry_date: string;
  renewal_lead_days: number;
  status: string;
  cchen_contact: string;
  renewal_submitted_date: string;
  renewal_code: string;
  notes: string;
  last_inspection: string;
  next_inspection: string;
  days_until_expiry: number;
  alert_level: string;
}

interface RenewalLog {
  id: number;
  action: string;
  action_date: string;
  performed_by: string;
  notes: string;
}

const LICENSE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  facility_operation:       { label: "Operación instalación", color: "bg-blue-100 text-blue-800" },
  source_registration:      { label: "Fuente registrada",     color: "bg-purple-100 text-purple-800" },
  personnel_qualification:  { label: "Calificación personal", color: "bg-green-100 text-green-800" },
  equipment_authorization:  { label: "Autorización equipo",   color: "bg-cyan-100 text-cyan-800" },
  transport:                { label: "Transporte",             color: "bg-orange-100 text-orange-800" },
  waste_management:         { label: "Gestión residuos",      color: "bg-yellow-100 text-yellow-800" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active:              { label: "Vigente",               color: "text-green-700",  bg: "bg-green-100",  icon: <CheckCircle className="w-4 h-4" /> },
  expired:             { label: "Vencida",               color: "text-red-700",    bg: "bg-red-100",    icon: <AlertTriangle className="w-4 h-4" /> },
  suspended:           { label: "Suspendida",            color: "text-orange-700", bg: "bg-orange-100", icon: <AlertTriangle className="w-4 h-4" /> },
  cancelled:           { label: "Cancelada",             color: "text-gray-700",   bg: "bg-gray-100",   icon: <X className="w-4 h-4" /> },
  renewal_in_progress: { label: "Renovación en curso",  color: "text-blue-700",   bg: "bg-blue-100",   icon: <RefreshCw className="w-4 h-4" /> },
};

const ALERT_CONFIG: Record<string, { border: string; bg: string }> = {
  critical: { border: "border-red-400",    bg: "bg-red-50" },
  warning:  { border: "border-orange-400", bg: "bg-orange-50" },
  info:     { border: "border-blue-300",   bg: "bg-blue-50" },
  ok:       { border: "border-gray-200",   bg: "bg-white" },
};

const ACTION_LABELS: Record<string, string> = {
  renewal_started:         "Renovación iniciada",
  documents_submitted:     "Documentos presentados",
  inspection_scheduled:    "Inspección programada",
  renewed:                 "Renovada",
  rejected:                "Rechazada",
  suspended:               "Suspendida",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DaysCounter({ days, status }: { days: number; status: string }) {
  if (status === "expired" || status === "cancelled") return null;
  if (status === "renewal_in_progress") {
    return <span className="text-blue-700 font-bold text-sm">Renovación en trámite</span>;
  }
  if (days < 0) return <span className="text-red-700 font-bold text-sm">VENCIDA hace {Math.abs(days)} días</span>;
  if (days <= 30) return <span className="text-red-600 font-bold text-sm">⚠ Vence en {days} días</span>;
  if (days <= 90) return <span className="text-orange-600 font-bold text-sm">Vence en {days} días</span>;
  return <span className="text-gray-600 text-sm">Vence en {days} días</span>;
}

function LicenseCard({ license, onRefresh }: { license: License; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [log, setLog] = useState<RenewalLog[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [submittingRenewal, setSubmittingRenewal] = useState(false);

  const st = STATUS_CONFIG[license.status] ?? STATUS_CONFIG.active;
  const lt = LICENSE_TYPE_CONFIG[license.license_type] ?? { label: license.license_type, color: "bg-gray-100 text-gray-800" };
  const al = ALERT_CONFIG[license.alert_level] ?? ALERT_CONFIG.ok;

  async function loadLog() {
    if (log.length) return;
    setLoadingLog(true);
    try {
      const r = await fetch(`/api/cchen-licenses?id=${license.id}`);
      const d = await r.json();
      setLog(d.log ?? []);
    } finally {
      setLoadingLog(false);
    }
  }

  function toggleExpand() {
    if (!expanded) loadLog();
    setExpanded(x => !x);
  }

  async function startRenewal() {
    setSubmittingRenewal(true);
    try {
      await fetch("/api/cchen-licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_id: license.id,
          action: "renewal_started",
          action_date: new Date().toISOString().split("T")[0],
          performed_by: "TM. Diego Solís",
          notes: "Inicio proceso de renovación de licencia CCHEN",
        }),
      });
      onRefresh();
    } finally {
      setSubmittingRenewal(false);
    }
  }

  return (
    <div className={`rounded-xl border-2 shadow-sm ${al.border} ${al.bg}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${license.alert_level === "critical" ? "bg-red-100" : "bg-blue-50"} flex-shrink-0`}>
            <FileCheck className={`w-5 h-5 ${license.alert_level === "critical" ? "text-red-600" : "text-blue-600"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-gray-500">{license.license_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lt.color}`}>{lt.label}</span>
              <span className={`text-xs flex items-center gap-1 font-medium ${st.color} ${st.bg} px-2 py-0.5 rounded-full`}>
                {st.icon}{st.label}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{license.holder_name}</h3>
            {license.facility_name && (
              <p className="text-xs text-gray-500">{license.facility_name}</p>
            )}
            {license.scope && (
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{license.scope}</p>
            )}
          </div>
          <button onClick={toggleExpand} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="cchen-licenses"
        ownerType="module"
        title="Documentos del módulo"
      />

        {/* Key stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-400 block">Vencimiento</span>
            <span className={`font-medium ${license.alert_level === "critical" ? "text-red-700" : license.alert_level === "warning" ? "text-orange-700" : "text-gray-800"}`}>
              {formatDate(license.expiry_date)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Estado tiempo</span>
            <DaysCounter days={license.days_until_expiry} status={license.status} />
          </div>
          <div>
            <span className="text-gray-400 block">Próxima inspección</span>
            <span className="text-gray-700 font-medium">{formatDate(license.next_inspection)}</span>
          </div>
        </div>

        {/* Actions */}
        {license.status === "active" && license.alert_level !== "ok" && (
          <button
            onClick={startRenewal}
            disabled={submittingRenewal}
            className="mt-3 flex items-center gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {submittingRenewal ? "Iniciando..." : "Iniciar renovación"}
          </button>
        )}

        {license.status === "expired" && (
          <div className="mt-3 bg-red-100 text-red-800 text-xs rounded-lg px-3 py-2">
            ⚠ Esta licencia está vencida. Operación no autorizada hasta renovación. Contactar CCHEN: {license.cchen_contact}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {[
              ["RUT titular", license.holder_rut],
              ["Fecha emisión", formatDate(license.issue_date)],
              ["Alerta renovación", `${license.renewal_lead_days} días antes`],
              ["Contacto CCHEN", license.cchen_contact],
              ["Última inspección", formatDate(license.last_inspection)],
              ["Código renovación", license.renewal_code ?? "—"],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span className="text-gray-400 block">{label}</span>
                <span className="text-gray-800 font-medium">{value ?? "—"}</span>
              </div>
            ))}
          </div>

          {license.conditions && (
            <div>
              <span className="text-xs font-semibold text-gray-700 block mb-1">Condiciones de la licencia</span>
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{license.conditions}</p>
            </div>
          )}

          {/* Renewal log */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Historial de renovaciones</h4>
            {loadingLog ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : log.length === 0 ? (
              <p className="text-xs text-gray-400">Sin historial de renovaciones</p>
            ) : (
              <div className="space-y-1.5">
                {log.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 text-xs bg-white rounded px-3 py-2 border border-gray-100">
                    <span className="text-gray-400 w-20 flex-shrink-0">{formatDate(entry.action_date)}</span>
                    <span className="font-medium text-gray-700">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    <span className="text-gray-500 flex-1">{entry.notes}</span>
                    <span className="text-gray-400">{entry.performed_by}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CchenLicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterAlert, setFilterAlert] = useState("all");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/cchen-licenses");
      const d = await r.json();
      setLicenses(d.licenses ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = licenses.filter(l => {
    if (filterType !== "all" && l.license_type !== filterType) return false;
    if (filterAlert !== "all" && l.alert_level !== filterAlert) return false;
    return true;
  });

  const stats = {
    active: licenses.filter(l => l.status === "active").length,
    expired: licenses.filter(l => l.status === "expired").length,
    renewals: licenses.filter(l => l.status === "renewal_in_progress").length,
    expiring30: licenses.filter(l => l.alert_level === "critical" && l.status === "active").length,
    expiring90: licenses.filter(l => l.alert_level === "warning" && l.status === "active").length,
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-7 h-7 text-blue-600" />
          Licencias y Autorizaciones CCHEN
        </h1>
        <p className="text-sm text-gray-500 mt-1">DS 3/1985 Arts. 7–14 · CCHEN NS-05.0 §3</p>
      </div>

      {/* Critical banner */}
      {(stats.expired > 0 || stats.expiring30 > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Licencias que requieren acción inmediata</p>
            <ul className="text-xs text-red-700 mt-1 space-y-0.5">
              {stats.expired > 0 && <li>• {stats.expired} licencia(s) VENCIDA(S) — operación no autorizada</li>}
              {stats.expiring30 > 0 && <li>• {stats.expiring30} licencia(s) vencen en menos de 30 días</li>}
            </ul>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Vigentes",        value: stats.active,    icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50" },
          { label: "Vencidas",        value: stats.expired,   icon: <AlertTriangle className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50" },
          { label: "En renovación",   value: stats.renewals,  icon: <RefreshCw className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Vence < 30 días", value: stats.expiring30, icon: <Clock className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50" },
          { label: "Vence < 90 días", value: stats.expiring90, icon: <Clock className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(t => (
          <div key={t.label} className={`${t.bg} rounded-xl p-3`}>
            <div className={`${t.color} mb-1`}>{t.icon}</div>
            <div className={`text-2xl font-bold ${t.color}`}>{t.value}</div>
            <div className="text-xs text-gray-600">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(LICENSE_TYPE_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterAlert}
          onChange={e => setFilterAlert(e.target.value)}
        >
          <option value="all">Todas las alertas</option>
          <option value="critical">Crítico</option>
          <option value="warning">Advertencia</option>
          <option value="info">Información</option>
          <option value="ok">Sin alerta</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} licencia(s)</span>
      </div>

      {/* License cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando licencias...</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(l => (
            <LicenseCard key={l.id} license={l} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <FileCheck className="w-4 h-4" /> Marco regulatorio aplicable
        </p>
        <p>• <strong>DS 3/1985 Arts. 7–14:</strong> Requisitos de licenciamiento de instalaciones radiactivas y fuentes</p>
        <p>• <strong>CCHEN NS-05.0 §3:</strong> Sistema de autorización y control de instalaciones radiactivas</p>
        <p>• <strong>DS 3/1985 Art. 10:</strong> Obligación de mantener licencia vigente durante toda la operación</p>
        <p>• <strong>Resolución CCHEN N°77:</strong> Plazos y procedimientos de renovación de licencias</p>
        <p className="text-red-700 mt-2">⚠ La operación sin licencia vigente constituye infracción grave al DS 3/1985 — sanción hasta suspensión definitiva. Iniciar renovación con al menos 90 días de anticipación.</p>
        <p className="mt-1">📞 Central CCHEN: 600 600 2436 · Mesa de licencias: licencias@cchen.cl</p>
      </div>
    </div>
  );
}
