"use client";
export const dynamic = "force-dynamic";

// §160 — Control de Personal Externo y Contratistas POE
// DS 3/1985 Arts. 20-23 · CCHEN NS-05.0 §7.4 · IAEA GSR Part 3 Req. 24

import { useEffect, useState, useCallback } from "react";
import {
  Truck, AlertTriangle, CheckCircle, User, Shield, Calendar,
  Plus, X, ChevronDown, ChevronUp, Briefcase, Activity
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

interface Contractor {
  id: number;
  rut: string;
  full_name: string;
  company: string;
  company_rut: string;
  role: string;
  specialty: string;
  contact_phone: string;
  contact_email: string;
  has_dosimeter: boolean;
  dosimeter_number: string;
  has_pr_training: boolean;
  pr_training_expiry: string;
  has_medical_cert: boolean;
  medical_cert_expiry: string;
  annual_dose_mSv: number;
  cumulative_dose_mSv: number;
  authorized_areas: string;
  status: string;
  compliance_issues: string[];
  visits_this_year: number;
  last_visit_date: string;
}

interface Visit {
  id: number;
  visit_date: string;
  entry_time: string;
  exit_time: string;
  purpose: string;
  areas_accessed: string;
  supervisor: string;
  dose_received_mSv: number;
  notes: string;
}

const SPECIALTY_CONFIG: Record<string, { label: string; color: string }> = {
  physicist:    { label: "Físico Médico",     color: "bg-purple-100 text-purple-800" },
  engineer:     { label: "Ingeniería",        color: "bg-blue-100 text-blue-800" },
  technician:   { label: "Técnico",           color: "bg-cyan-100 text-cyan-800" },
  maintenance:  { label: "Mantención",        color: "bg-yellow-100 text-yellow-800" },
  installer:    { label: "Instalación",       color: "bg-orange-100 text-orange-800" },
  vendor:       { label: "Proveedor",         color: "bg-green-100 text-green-800" },
};

const DOSE_LIMIT = 20; // mSv/year occupational

function ComplianceBadge({ issue }: { issue: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" /> {issue}
    </span>
  );
}

function DoseBar({ dose, limit = DOSE_LIMIT }: { dose: number; limit?: number }) {
  const pct = Math.min((dose / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-orange-500" : pct >= 50 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-20 text-right">
        {Number(dose).toFixed(1)} / {limit} mSv
      </span>
    </div>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-700" : "text-red-600"}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}

function ContractorCard({ contractor, onRefresh }: { contractor: Contractor; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split("T")[0],
    purpose: "",
    areas_accessed: "",
    supervisor: "TM. Diego Solís",
    dose_received_mSv: "",
    notes: "",
  });
  const [savingVisit, setSavingVisit] = useState(false);

  const sp = SPECIALTY_CONFIG[contractor.specialty] ?? { label: contractor.specialty, color: "bg-gray-100 text-gray-800" };
  const hasIssues = contractor.compliance_issues && contractor.compliance_issues.length > 0;
  const dosePct = (Number(contractor.annual_dose_mSv) / DOSE_LIMIT) * 100;

  async function loadVisits() {
    if (visits.length) return;
    setLoadingVisits(true);
    try {
      const r = await fetch(`/api/contractors?id=${contractor.id}`);
      const d = await r.json();
      setVisits(d.visits ?? []);
    } finally {
      setLoadingVisits(false);
    }
  }

  function toggleExpand() {
    if (!expanded) loadVisits();
    setExpanded(x => !x);
  }

  async function logVisit(e: React.FormEvent) {
    e.preventDefault();
    setSavingVisit(true);
    try {
      await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractor_id: contractor.id, ...visitForm }),
      });
      setShowVisitForm(false);
      setVisits([]);
      loadVisits();
      onRefresh();
    } finally {
      setSavingVisit(false);
    }
  }

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm ${hasIssues ? "border-orange-300" : "border-gray-200"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${hasIssues ? "bg-orange-100" : "bg-gray-100"} flex-shrink-0`}>
            <User className={`w-5 h-5 ${hasIssues ? "text-orange-600" : "text-gray-600"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-gray-900 text-sm">{contractor.full_name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sp.color}`}>{sp.label}</span>
              {contractor.status === "inactive" && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactivo</span>
              )}
            </div>
            <p className="text-xs text-gray-500">{contractor.company} · {contractor.role}</p>
            {hasIssues && (
              <div className="mt-2 flex flex-wrap gap-1">
                {contractor.compliance_issues.map(issue => (
                  <ComplianceBadge key={issue} issue={issue} />
                ))}
              </div>
            )}
          </div>
          <button onClick={toggleExpand} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="contractors"
        ownerType="module"
        title="Documentos del módulo"
      />

        {/* Dose bar */}
        {Number(contractor.annual_dose_mSv) > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Dosis anual acumulada</span>
              <span>{dosePct.toFixed(0)}% del límite</span>
            </div>
            <DoseBar dose={Number(contractor.annual_dose_mSv)} />
          </div>
        )}

        {/* Quick stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-400 block">Última visita</span>
            <span className="text-gray-700 font-medium">{formatDate(contractor.last_visit_date)}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Visitas este año</span>
            <span className="text-gray-700 font-medium">{contractor.visits_this_year ?? 0}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Dosis acum. total</span>
            <span className="text-gray-700 font-medium">{Number(contractor.cumulative_dose_mSv).toFixed(1)} mSv</span>
          </div>
        </div>

        {/* Register visit button */}
        <button
          onClick={() => { setShowVisitForm(true); if (!expanded) { setExpanded(true); loadVisits(); } }}
          className="mt-3 flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Registrar visita
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Compliance checklist */}
          <div>
            <span className="text-xs font-semibold text-gray-700 block mb-2">Requisitos PR</span>
            <div className="grid grid-cols-2 gap-2">
              <CheckItem ok={contractor.has_dosimeter} label={contractor.has_dosimeter ? `Dosímetro ${contractor.dosimeter_number}` : "Dosímetro asignado"} />
              <CheckItem ok={contractor.has_pr_training} label={`Capacitación PR${contractor.pr_training_expiry ? ` (vence ${formatDate(contractor.pr_training_expiry)})` : ""}`} />
              <CheckItem ok={contractor.has_medical_cert} label={`Cert. médico${contractor.medical_cert_expiry ? ` (vence ${formatDate(contractor.medical_cert_expiry)})` : ""}`} />
              <CheckItem ok={!!contractor.authorized_areas} label="Áreas autorizadas definidas" />
            </div>
            {contractor.authorized_areas && (
              <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded p-2">
                <strong>Áreas:</strong> {contractor.authorized_areas}
              </p>
            )}
          </div>

          {/* Visit form */}
          {showVisitForm && (
            <form onSubmit={logVisit} className="bg-blue-50 rounded-xl p-3 space-y-2">
              <h4 className="text-xs font-semibold text-blue-800">Registrar visita</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-0.5">Fecha *</label>
                  <input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={visitForm.visit_date} onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-0.5">Dosis recibida (mSv)</label>
                  <input type="number" step="0.001" min="0" className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0.000" value={visitForm.dose_received_mSv}
                    onChange={e => setVisitForm(f => ({ ...f, dose_received_mSv: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Propósito *</label>
                <input type="text" required className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Mantención, instalación, visita técnica..."
                  value={visitForm.purpose} onChange={e => setVisitForm(f => ({ ...f, purpose: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Áreas accedidas</label>
                <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Sala técnica, sala de control..." value={visitForm.areas_accessed}
                  onChange={e => setVisitForm(f => ({ ...f, areas_accessed: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowVisitForm(false)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingVisit}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                  {savingVisit ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}

          {/* Visits */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Historial de visitas</h4>
            {loadingVisits ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : visits.length === 0 ? (
              <p className="text-xs text-gray-400">Sin visitas registradas</p>
            ) : (
              <div className="space-y-1.5">
                {visits.map(v => (
                  <div key={v.id} className="flex items-start gap-3 text-xs bg-gray-50 rounded px-3 py-2">
                    <span className="text-gray-400 w-20 flex-shrink-0">{formatDate(v.visit_date)}</span>
                    <span className="font-medium text-gray-700 flex-1">{v.purpose}</span>
                    {v.dose_received_mSv && (
                      <span className="text-blue-600 font-mono">{Number(v.dose_received_mSv).toFixed(3)} mSv</span>
                    )}
                    <span className="text-gray-400">{v.supervisor}</span>
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

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [filterCompliance, setFilterCompliance] = useState("all");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/contractors");
      const d = await r.json();
      setContractors(d.contractors ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contractors.filter(c => {
    if (filterSpecialty !== "all" && c.specialty !== filterSpecialty) return false;
    if (filterCompliance === "issues" && (!c.compliance_issues || c.compliance_issues.length === 0)) return false;
    if (filterCompliance === "ok" && c.compliance_issues && c.compliance_issues.length > 0) return false;
    return true;
  });

  const stats = {
    active: contractors.filter(c => c.status === "active").length,
    withIssues: contractors.filter(c => c.compliance_issues && c.compliance_issues.length > 0).length,
    noDosimeter: contractors.filter(c => c.status === "active" && !c.has_dosimeter).length,
    noTraining: contractors.filter(c => c.status === "active" && !c.has_pr_training).length,
    highDose: contractors.filter(c => Number(c.annual_dose_mSv) > 15).length,
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-7 h-7 text-blue-600" />
          Personal Externo y Contratistas POE
        </h1>
        <p className="text-sm text-gray-500 mt-1">DS 3/1985 Arts. 20–23 · CCHEN NS-05.0 §7.4 · IAEA GSR Part 3 Req. 24</p>
      </div>

      {/* Critical banner */}
      {stats.withIssues > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">Contratistas con requisitos PR incompletos</p>
            <ul className="text-xs text-orange-700 mt-1 space-y-0.5">
              {stats.noDosimeter > 0 && <li>• {stats.noDosimeter} contratista(s) sin dosímetro asignado</li>}
              {stats.noTraining > 0 && <li>• {stats.noTraining} contratista(s) sin capacitación en PR</li>}
              {stats.highDose > 0 && <li>• {stats.highDose} contratista(s) con dosis anual &gt;75% del límite</li>}
            </ul>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Activos",             value: stats.active,      icon: <Briefcase className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Con incumplimiento",  value: stats.withIssues,  icon: <AlertTriangle className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Sin dosímetro",       value: stats.noDosimeter, icon: <Shield className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50" },
          { label: "Sin capacitación PR", value: stats.noTraining,  icon: <User className="w-5 h-5" />, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Dosis alta (>75%)",   value: stats.highDose,    icon: <Activity className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50" },
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
          value={filterSpecialty}
          onChange={e => setFilterSpecialty(e.target.value)}
        >
          <option value="all">Todas las especialidades</option>
          {Object.entries(SPECIALTY_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterCompliance}
          onChange={e => setFilterCompliance(e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="issues">Con incumplimientos</option>
          <option value="ok">Conformes</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} contratista(s)</span>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando contratistas...</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => (
            <ContractorCard key={c.id} contractor={c} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800 mb-2">Marco regulatorio aplicable</p>
        <p>• <strong>DS 3/1985 Arts. 20–23:</strong> Responsabilidades del empleador y contratista en la PR del trabajador externo</p>
        <p>• <strong>CCHEN NS-05.0 §7.4:</strong> Requisitos de capacitación para trabajadores externos en zona controlada</p>
        <p>• <strong>IAEA GSR Part 3 Req. 24:</strong> Coordinación de responsabilidades entre empleadores para trabajadores externos</p>
        <p>• <strong>ICRP Publication 75:</strong> Protección radiológica del trabajador externo</p>
        <p className="text-blue-700 mt-2">ℹ Todo contratista que trabaje en zona controlada debe tener: (1) dosímetro personal, (2) capacitación PR vigente, (3) certificado médico de aptitud para exposición ocupacional.</p>
      </div>
    </div>
  );
}
