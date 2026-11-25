"use client";


// §154 — Formulario F-01 CCHEN
// Informe Anual de Protección Radiológica
// DS 3/1985 Arts. 50-52 · CCHEN NS-05.0 §10 · Circular CCHEN N°13
// Plazo: 31 de marzo de cada año

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Send, CheckCircle2, Clock, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, Download, Edit3,
  Users, Zap, Radiation, Trash2, Activity, Shield, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface F01Report {
  id: number;
  report_year: number;
  status: string;
  titular_name: string | null;
  titular_rut: string | null;
  titular_address: string | null;
  titular_phone: string | null;
  titular_email: string | null;
  encargado_name: string | null;
  encargado_rut: string | null;
  encargado_phone: string | null;
  encargado_email: string | null;
  instalacion_name: string | null;
  instalacion_type: string | null;
  instalacion_address: string | null;
  cchen_license_number: string | null;
  poe_total_count: number | null;
  poe_category_a: number | null;
  poe_category_b: number | null;
  poe_pregnant: number | null;
  poe_students: number | null;
  collective_dose_msv: number | null;
  max_individual_dose_msv: number | null;
  workers_above_limit: number | null;
  workers_above_1msv: number | null;
  sources_count: number | null;
  sources_description: string | null;
  generators_count: number | null;
  generators_description: string | null;
  incidents_count: number | null;
  incidents_description: string | null;
  waste_volume_L: number | null;
  waste_activity_GBq: number | null;
  waste_disposal_method: string | null;
  area_monitoring_points: number | null;
  max_area_dose_rate_usvh: number | null;
  submitted_date: string | null;
  cchen_reception_code: string | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
}

interface DeadlineInfo {
  year: number;
  date: string;
  days_remaining: number;
  status: string;
  has_draft: boolean;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:     { label: "Borrador",    cls: "bg-gray-100 text-gray-700 border-gray-300",   icon: Edit3 },
  ready:     { label: "Listo",       cls: "bg-blue-100 text-blue-700 border-blue-300",   icon: CheckCircle2 },
  submitted: { label: "Enviado CCHEN",cls: "bg-green-100 text-green-700 border-green-300", icon: Send },
  overdue:   { label: "Vencido",     cls: "bg-red-100 text-red-700 border-red-300",      icon: AlertCircle },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

function SectionHeader({ icon: Icon, label, section }: { icon: React.ElementType; label: string; section: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b mb-3">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <span className="text-xs text-muted-foreground font-mono">Sección {section}</span>
        <h3 className="font-semibold text-sm leading-tight">{label}</h3>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-dashed border-muted last:border-0 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-right max-w-[55%] break-words">{value ?? "—"}</span>
    </div>
  );
}

// ─── Report Detail Card ───────────────────────────────────────────────────────

function ReportCard({ report, onRefresh }: { report: F01Report; onRefresh: () => void }) {
  const [open, setOpen] = useState(report.status === "draft" || report.status === "ready");
  const [marking, setMarking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receptionCode, setReceptionCode] = useState("");

  const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  const markReady = async () => {
    setMarking(true);
    await fetch(`/api/f01-cchen?id=${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ready" }),
    });
    setMarking(false);
    onRefresh();
  };

  const markSubmitted = async () => {
    if (!receptionCode.trim()) return;
    setSubmitting(true);
    await fetch(`/api/f01-cchen?id=${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "submitted",
        submitted_date: new Date().toISOString().split("T")[0],
        cchen_reception_code: receptionCode.trim(),
      }),
    });
    setSubmitting(false);
    setReceptionCode("");
    onRefresh();
  };

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden",
      report.status === "draft" ? "border-blue-200" : report.status === "submitted" ? "border-green-200" : ""
    )}>
      {/* Card header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold">Informe Anual F-01 — Año {report.report_year}</h3>
            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", statusCfg.cls)}>
              <StatusIcon className="w-3 h-3" /> {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
            <span>{report.instalacion_name ?? "—"}</span>
            {report.submitted_date && <span>Enviado: {fmtDate(report.submitted_date)}</span>}
            {report.cchen_reception_code && <span className="font-mono">Código: {report.cchen_reception_code}</span>}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t p-4 space-y-5">

          {/* Sección A: Identificación */}
          <div>
            <SectionHeader icon={Shield} label="Identificación del Titular" section="A" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">TITULAR</p>
                <InfoRow label="Nombre / razón social" value={report.titular_name} />
                <InfoRow label="RUT" value={report.titular_rut} />
                <InfoRow label="Dirección" value={report.titular_address} />
                <InfoRow label="Teléfono" value={report.titular_phone} />
                <InfoRow label="Correo electrónico" value={report.titular_email} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">ENCARGADO PR</p>
                <InfoRow label="Nombre" value={report.encargado_name} />
                <InfoRow label="RUT" value={report.encargado_rut} />
                <InfoRow label="Teléfono" value={report.encargado_phone} />
                <InfoRow label="Correo electrónico" value={report.encargado_email} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">INSTALACIÓN</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <div>
                  <InfoRow label="Nombre instalación" value={report.instalacion_name} />
                  <InfoRow label="Tipo" value={report.instalacion_type} />
                </div>
                <div>
                  <InfoRow label="Dirección instalación" value={report.instalacion_address} />
                  <InfoRow label="N° Licencia CCHEN" value={report.cchen_license_number} />
                </div>
              </div>
            </div>
          </div>

          {/* Sección B: POE */}
          <div>
            <SectionHeader icon={Users} label="Personal Ocupacionalmente Expuesto (POE)" section="B" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              {[
                { label: "Total POE", value: report.poe_total_count },
                { label: "Categoría A", value: report.poe_category_a },
                { label: "Categoría B", value: report.poe_category_b },
                { label: "Embarazadas", value: report.poe_pregnant },
                { label: "Estudiantes", value: report.poe_students },
              ].map((kpi, i) => (
                <div key={i} className="rounded-lg bg-muted/40 border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold leading-tight">{kpi.value ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sección C: Dosis */}
          <div>
            <SectionHeader icon={Activity} label="Dosis Colectiva e Individual" section="C" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { label: "Dosis colectiva", value: report.collective_dose_msv != null ? `${Number(report.collective_dose_msv).toFixed(2)} man·mSv` : null },
                { label: "Dosis máx. individual", value: report.max_individual_dose_msv != null ? `${Number(report.max_individual_dose_msv).toFixed(1)} mSv` : null, alert: (report.max_individual_dose_msv ?? 0) > 20 },
                { label: "Sobre límite (20 mSv)", value: report.workers_above_limit ?? 0, alert: (report.workers_above_limit ?? 0) > 0 },
                { label: "Sobre 1 mSv", value: report.workers_above_1msv ?? 0 },
              ].map((kpi, i) => (
                <div key={i} className={cn("rounded-lg border p-3 text-center", (kpi as { alert?: boolean }).alert ? "bg-red-50 border-red-200" : "bg-muted/40")}>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={cn("text-xl font-bold leading-tight", (kpi as { alert?: boolean }).alert ? "text-red-700" : "")}>{kpi.value ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Secciones D-H */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <SectionHeader icon={Radiation} label="Fuentes Radiactivas" section="D" />
              <InfoRow label="Número de fuentes" value={report.sources_count} />
              <InfoRow label="Descripción" value={report.sources_description} />
            </div>
            <div>
              <SectionHeader icon={Zap} label="Equipos Generadores" section="E" />
              <InfoRow label="Número de equipos" value={report.generators_count} />
              <InfoRow label="Descripción" value={report.generators_description} />
            </div>
            <div>
              <SectionHeader icon={AlertCircle} label="Incidentes / Accidentes" section="F" />
              <InfoRow label="Número de incidentes" value={report.incidents_count} />
              <InfoRow label="Descripción" value={report.incidents_description} />
            </div>
            <div>
              <SectionHeader icon={Trash2} label="Residuos Radiactivos" section="G" />
              <InfoRow label="Volumen total (L)" value={report.waste_volume_L != null ? `${Number(report.waste_volume_L).toFixed(1)} L` : null} />
              <InfoRow label="Actividad total (GBq)" value={report.waste_activity_GBq != null ? `${Number(report.waste_activity_GBq).toFixed(2)} GBq` : null} />
              <InfoRow label="Método disposición" value={report.waste_disposal_method} />
            </div>
          </div>

          {/* Sección H: Monitoreo de área */}
          <div>
            <SectionHeader icon={Activity} label="Monitoreo de Área" section="H" />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 border p-3 text-center">
                <p className="text-xs text-muted-foreground">Puntos de monitoreo</p>
                <p className="text-2xl font-bold">{report.area_monitoring_points ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border p-3 text-center">
                <p className="text-xs text-muted-foreground">Tasa máx. detectada</p>
                <p className="text-2xl font-bold">{report.max_area_dose_rate_usvh != null ? `${Number(report.max_area_dose_rate_usvh).toFixed(1)} µSv/h` : "—"}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {report.status === "draft" && (
            <div className="border-t pt-4 flex gap-3 items-center">
              <button
                onClick={markReady}
                disabled={marking}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" /> Marcar como listo para envío
              </button>
              <p className="text-xs text-muted-foreground">Verificar completitud antes de enviar a CCHEN</p>
            </div>
          )}

          {report.status === "ready" && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Registrar envío a CCHEN</p>
              <div className="flex gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-sm flex-1"
                  placeholder="Código de recepción CCHEN (ej. CCHEN-2025-R-00123)"
                  value={receptionCode}
                  onChange={e => setReceptionCode(e.target.value)}
                />
                <button
                  onClick={markSubmitted}
                  disabled={submitting || !receptionCode.trim()}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Registrar envío
                </button>
              </div>
            </div>
          )}

          {report.status === "submitted" && (
            <div className="border-t pt-4 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              <span>Enviado a CCHEN el {fmtDate(report.submitted_date)} · Código: <strong className="font-mono">{report.cchen_reception_code}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function F01CchenPage() {
  const [reports, setReports] = useState<F01Report[]>([]);
  const [deadline, setDeadline] = useState<DeadlineInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/f01-cchen");
    const d = await r.json();
    setReports(d.reports ?? []);
    setDeadline(d.deadline ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentYear = new Date().getFullYear();
  const hasCurrentYear = reports.some(r => r.report_year === currentYear);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Formulario F-01 CCHEN
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §154 — Informe Anual de Protección Radiológica · DS 3/1985 Arts. 50-52 · Plazo: 31 de marzo
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border hover:bg-muted text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </button>
          {!hasCurrentYear && (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
            >
              <FileText className="w-4 h-4" /> Crear informe {currentYear}
            </button>
          )}
        </div>
      </div>

      {/* Deadline banner */}
      {deadline && (
        <div className={cn(
          "rounded-xl border p-4 flex items-start gap-3",
          deadline.status === "overdue" ? "bg-red-50 border-red-300" :
          deadline.status === "urgent"  ? "bg-amber-50 border-amber-300" :
          "bg-blue-50 border-blue-200"
        )}>
          <Clock className={cn("w-5 h-5 mt-0.5 flex-shrink-0",
            deadline.status === "overdue" ? "text-red-600" :
            deadline.status === "urgent"  ? "text-amber-600" : "text-blue-600"
          )} />
          <div>
            <p className={cn("font-semibold text-sm",
              deadline.status === "overdue" ? "text-red-800" :
              deadline.status === "urgent"  ? "text-amber-800" : "text-blue-800"
            )}>
              {deadline.status === "overdue"
                ? `Plazo vencido — Informe ${deadline.year} debía enviarse antes del 31 de marzo`
                : deadline.status === "urgent"
                ? `Urgente — ${deadline.days_remaining} días para el plazo (31 marzo ${deadline.year})`
                : `Informe ${deadline.year} — Plazo: 31 de marzo (${deadline.days_remaining} días restantes)`}
            </p>
            <p className={cn("text-xs mt-0.5",
              deadline.status === "overdue" ? "text-red-700" :
              deadline.status === "urgent"  ? "text-amber-700" : "text-blue-700"
            )}>
              {deadline.has_draft
                ? "Hay un borrador en curso. Complételo y regístrelo como enviado a CCHEN."
                : `No existe informe para ${deadline.year}. Cree un nuevo informe anual.`}
            </p>
          </div>
        </div>
      )}

      {/* KPI summary from latest submitted */}
      {(() => {
        const latest = reports.find(r => r.status === "submitted");
        if (!latest) return null;
        return (
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium">ÚLTIMO INFORME ENVIADO — Año {latest.report_year}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
              {[
                { label: "POE total", value: latest.poe_total_count },
                { label: "Dosis colectiva", value: latest.collective_dose_msv != null ? `${Number(latest.collective_dose_msv).toFixed(1)} man·mSv` : null },
                { label: "Dosis máx.", value: latest.max_individual_dose_msv != null ? `${Number(latest.max_individual_dose_msv).toFixed(1)} mSv` : null },
                { label: "Incidentes", value: latest.incidents_count ?? 0 },
              ].map((kpi, i) => (
                <div key={i} className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="font-bold text-lg leading-tight">{kpi.value ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Reports list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay informes F-01 registrados</p>
          <p className="text-xs text-muted-foreground mt-1">Cree el informe anual para el año en curso.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => <ReportCard key={r.id} report={r} onRefresh={load} />)}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="rounded-xl border bg-blue-50/50 p-5 text-xs text-blue-900 space-y-2">
        <p className="font-semibold flex items-center gap-1.5 text-sm">
          <FileText className="w-4 h-4" /> Marco Regulatorio — Informe Anual F-01
        </p>
        <p><strong>DS 3/1985 Arts. 50-52:</strong> Todo titular de instalación radiactiva debe presentar un informe anual de protección radiológica a la CCHEN antes del 31 de marzo de cada año.</p>
        <p><strong>CCHEN NS-05.0 §10:</strong> El informe debe incluir: identificación del titular y la instalación, número y categoría del POE, dosis colectiva e individual máxima, inventario de fuentes radiactivas, equipos generadores, residuos y monitoreo de área.</p>
        <p><strong>Circular CCHEN N°13:</strong> Establece el formulario F-01 como el instrumento oficial para la presentación del informe anual. El incumplimiento puede resultar en sanciones administrativas incluyendo suspensión de la licencia.</p>
        <p><strong>Consecuencias del incumplimiento:</strong> Multa de hasta 500 UTM por informe no presentado, suspensión de licencia de operación, anotación en el registro nacional de instalaciones.</p>
      </div>

      {/* Quick create modal - simplified version */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm mx-4 border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Crear informe {currentYear}</h2>
              <button onClick={() => setShowNewForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Se creará un borrador del Formulario F-01 para el año {currentYear} con los datos de la instalación precargados. Podrá completarlo desde el panel principal.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await fetch("/api/f01-cchen", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ report_year: currentYear }),
                  });
                  setShowNewForm(false);
                  load();
                }}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
              >
                Crear borrador
              </button>
              <button onClick={() => setShowNewForm(false)} className="border px-4 py-2 rounded-lg hover:bg-muted text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
