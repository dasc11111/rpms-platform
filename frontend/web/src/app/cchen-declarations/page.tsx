"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, ChevronDown, ChevronUp, CheckCircle2,
  AlertTriangle, Clock, RefreshCw, Edit2, Printer,
  Calendar, User, Shield, BarChart2, Users, Radiation
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

// §78 — Declaración Anual de Dosis ante CCHEN
// DS 3/1985 Art. 10 + NS-06.0 §4.4

interface Declaration {
  id: number;
  declaration_code: string;
  year: number;
  establishment_name: string;
  establishment_rut?: string;
  cchen_license?: string;
  responsible_pr?: string;
  responsible_rut?: string;
  responsible_title?: string;
  total_poe?: number;
  total_poe_dosimetry?: number;
  poe_male?: number;
  poe_female?: number;
  avg_dose_mSv?: number;
  max_dose_mSv?: number;
  total_collective_mSv?: number;
  poe_over_1mSv?: number;
  poe_over_6mSv?: number;
  poe_over_15mSv?: number;
  poe_over_20mSv?: number;
  poe_pregnant?: number;
  poe_apprentice?: number;
  incidents_count?: number;
  work_areas_count?: number;
  radiation_sources?: string;
  submission_date?: string;
  submitted_by?: string;
  cchen_receipt_number?: string;
  status: string;
  observations?: string;
  workers_count: number;
}

interface Stats {
  total: number;
  acknowledged: number;
  submitted: number;
  pending: number;
  latest_year: number;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:        { label: "Borrador",       cls: "bg-gray-100 text-gray-700",    icon: Clock },
  ready:        { label: "Lista p/ envío", cls: "bg-blue-100 text-blue-700",    icon: FileText },
  submitted:    { label: "Enviada",        cls: "bg-purple-100 text-purple-700", icon: CheckCircle2 },
  acknowledged: { label: "Acusada CCHEN",  cls: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  corrected:    { label: "Corregida",      cls: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
  const { label, cls, icon: Icon } = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-600", icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

function DoseStat({ label, value, unit = "mSv", highlight = false }: {
  label: string; value?: number | null; unit?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 text-center ${highlight && value && value > 0 ? "bg-orange-50 border border-orange-200" : "bg-gray-50"}`}>
      <div className={`text-xl font-bold ${highlight && value && value > 0 ? "text-orange-700" : "text-gray-800"}`}>
        {value != null ? value.toFixed(value >= 10 ? 1 : 2) : "—"}
      </div>
      <div className="text-xs text-gray-500 leading-tight mt-0.5">{label}</div>
      <div className="text-xs text-gray-400">{unit}</div>
    </div>
  );
}

function PrintableDeclaration({ decl }: { decl: Declaration }) {
  return (
    <div className="hidden print:block p-8 font-sans text-sm">
      <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest">República de Chile</div>
        <div className="font-bold text-lg">COMISIÓN CHILENA DE ENERGÍA NUCLEAR</div>
        <div className="font-semibold text-base mt-1">
          DECLARACIÓN ANUAL DE DOSIS — AÑO {decl.year}
        </div>
        <div className="text-xs text-gray-500 mt-1">DS 3/1985 Art. 10 — NS-06.0 §4.4</div>
      </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="cchen-declarations"
        ownerType="module"
        title="Documentos del módulo"
      />

      <table className="w-full border-collapse text-sm mb-4">
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-1 pr-4 font-semibold text-gray-600 w-48">Establecimiento:</td>
            <td className="py-1">{decl.establishment_name}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-1 pr-4 font-semibold text-gray-600">RUT:</td>
            <td className="py-1">{decl.establishment_rut ?? "—"}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-1 pr-4 font-semibold text-gray-600">Licencia CCHEN:</td>
            <td className="py-1">{decl.cchen_license ?? "—"}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-1 pr-4 font-semibold text-gray-600">Encargado PR:</td>
            <td className="py-1">{decl.responsible_pr} — {decl.responsible_title}</td>
          </tr>
          <tr className="border-b border-gray-200">
            <td className="py-1 pr-4 font-semibold text-gray-600">RUT Encargado:</td>
            <td className="py-1">{decl.responsible_rut ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      <div className="font-semibold text-gray-700 mb-2 mt-4">I. DOTACIÓN POE</div>
      <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">Parámetro</th>
            <th className="border border-gray-300 p-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Total POE declarados", decl.total_poe, "personas"],
            ["POE con dosimetría", decl.total_poe_dosimetry, "personas"],
            ["POE masculino", decl.poe_male, "personas"],
            ["POE femenino", decl.poe_female, "personas"],
            ["POE embarazadas", decl.poe_pregnant, "personas"],
            ["POE aprendices", decl.poe_apprentice, "personas"],
            ["Áreas de trabajo con radiación", decl.work_areas_count, "áreas"],
          ].map(([lbl, val, unit]) => (
            <tr key={String(lbl)} className="border-b border-gray-200">
              <td className="border border-gray-300 p-2">{lbl}</td>
              <td className="border border-gray-300 p-2 text-right font-medium">{val ?? "—"} {unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="font-semibold text-gray-700 mb-2">II. DOSIS RECIBIDAS</div>
      <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">Parámetro</th>
            <th className="border border-gray-300 p-2 text-right">Valor</th>
            <th className="border border-gray-300 p-2 text-right">Límite reglamentario</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Dosis efectiva promedio", decl.avg_dose_mSv?.toFixed(2), "mSv/año", "— (referencia ALARA)"],
            ["Dosis efectiva máxima", decl.max_dose_mSv?.toFixed(2), "mSv/año", "< 20 mSv/año (DS3)"],
            ["Dosis colectiva total", decl.total_collective_mSv?.toFixed(1), "persona·mSv", "—"],
            ["POE con dosis > 1 mSv", decl.poe_over_1mSv, "personas", "—"],
            ["POE con dosis > 6 mSv (NA)", decl.poe_over_6mSv, "personas", "0 (nivel de acción)"],
            ["POE con dosis > 15 mSv (NI)", decl.poe_over_15mSv, "personas", "0 (nivel de intervención)"],
            ["POE con dosis > 20 mSv (Límite)", decl.poe_over_20mSv, "personas", "0 (DS 3/1985 Art. 8)"],
          ].map(([lbl, val, unit, limit]) => (
            <tr key={String(lbl)} className="border-b border-gray-200">
              <td className="border border-gray-300 p-2">{lbl}</td>
              <td className="border border-gray-300 p-2 text-right font-medium">{val ?? "—"} {unit}</td>
              <td className="border border-gray-300 p-2 text-right text-gray-500 text-xs">{limit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="font-semibold text-gray-700 mb-2">III. INCIDENTES RADIOLÓGICOS</div>
      <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
        <tbody>
          <tr>
            <td className="border border-gray-300 p-2">N° de incidentes radiológicos en el período</td>
            <td className="border border-gray-300 p-2 text-right font-bold">{decl.incidents_count ?? 0}</td>
          </tr>
        </tbody>
      </table>

      <div className="font-semibold text-gray-700 mb-2">IV. FUENTES DE RADIACIÓN UTILIZADAS</div>
      <div className="border border-gray-300 p-3 text-sm mb-4">{decl.radiation_sources ?? "No especificadas"}</div>

      {decl.observations && (
        <>
          <div className="font-semibold text-gray-700 mb-2">V. OBSERVACIONES</div>
          <div className="border border-gray-300 p-3 text-sm mb-6">{decl.observations}</div>
        </>
      )}

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div className="text-center border-t border-gray-800 pt-2">
          <div className="text-xs text-gray-500">Encargado de Protección Radiológica</div>
          <div className="text-xs font-semibold mt-1">{decl.responsible_pr}</div>
          <div className="text-xs text-gray-500">{decl.responsible_rut}</div>
        </div>
        <div className="text-center border-t border-gray-800 pt-2">
          <div className="text-xs text-gray-500">Director del Establecimiento</div>
          <div className="text-xs text-gray-400 mt-6">Firma y timbre</div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 mt-8">
        {decl.establishment_name} — Declaración Anual Dosis {decl.year} — {decl.declaration_code}
      </div>
    </div>
  );
}

function DeclarationCard({
  decl,
  onEdit,
  onStatusChange,
}: {
  decl: Declaration;
  onEdit: (d: Declaration) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${
      decl.status === "acknowledged" ? "border-green-500" :
      decl.status === "submitted" ? "border-purple-500" :
      decl.status === "ready" ? "border-blue-500" : "border-gray-300"
    }`}>
      <PrintableDeclaration decl={decl} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{decl.declaration_code}</span>
              <StatusBadge status={decl.status} />
              {decl.cchen_receipt_number && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Recibo: {decl.cchen_receipt_number}
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-lg">
              Declaración Anual Dosis — Año {decl.year}
            </h3>
            <p className="text-sm text-gray-600">{decl.establishment_name}</p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
              {decl.responsible_pr && (
                <span className="flex items-center gap-1">
                  <User size={11} /> {decl.responsible_pr}
                </span>
              )}
              {decl.submission_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> Enviada: {formatDate(decl.submission_date)}
                </span>
              )}
              {decl.total_poe && (
                <span className="flex items-center gap-1">
                  <Users size={11} /> {decl.total_poe} POE declarados
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button onClick={handlePrint} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Imprimir declaración">
              <Printer size={15} />
            </button>
            <button onClick={() => onEdit(decl)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 size={15} />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Quick status transitions */}
        {decl.status !== "acknowledged" && (
          <div className="mt-2 flex gap-1">
            {decl.status === "draft" && (
              <button onClick={() => onStatusChange(decl.id, "ready")} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100">
                Marcar lista p/ envío
              </button>
            )}
            {decl.status === "ready" && (
              <button onClick={() => onStatusChange(decl.id, "submitted")} className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100">
                Marcar enviada
              </button>
            )}
            {decl.status === "submitted" && (
              <button onClick={() => onStatusChange(decl.id, "acknowledged")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md hover:bg-green-100">
                ✓ CCHEN acusó recibo
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-5">
          {/* Dose summary grid */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Radiation size={12} /> Resumen de Dosis {decl.year}
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <DoseStat label="Dosis prom." value={decl.avg_dose_mSv} />
              <DoseStat label="Dosis máx." value={decl.max_dose_mSv} />
              <DoseStat label="Dosis colectiva" value={decl.total_collective_mSv} unit="p·mSv" />
              <DoseStat label="POE > 1 mSv" value={decl.poe_over_1mSv} unit="personas" />
              <DoseStat label="POE > 6 mSv" value={decl.poe_over_6mSv} unit="personas (NA)" highlight />
              <DoseStat label="POE > 15 mSv" value={decl.poe_over_15mSv} unit="personas (NI)" highlight />
            </div>
          </div>

          {/* POE breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Users size={12} /> Composición POE
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {[
                ["Total POE", decl.total_poe, ""],
                ["Con dosimetría", decl.total_poe_dosimetry, ""],
                ["Masculino", decl.poe_male, ""],
                ["Femenino", decl.poe_female, ""],
                ["Embarazadas", decl.poe_pregnant, "🤰"],
                ["Aprendices", decl.poe_apprentice, ""],
                ["Incidentes", decl.incidents_count, ""],
                ["Áreas c/ radiación", decl.work_areas_count, ""],
              ].map(([lbl, val]) => (
                <div key={String(lbl)} className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-500">{lbl}</div>
                  <div className="font-bold text-gray-900">{val ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Radiation sources */}
          {decl.radiation_sources && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Shield size={12} /> Fuentes de Radiación Utilizadas
              </h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{decl.radiation_sources}</p>
            </div>
          )}

          {/* License info */}
          {decl.cchen_license && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield size={14} className="text-blue-500" />
              Licencia CCHEN: <span className="font-medium">{decl.cchen_license}</span>
            </div>
          )}

          {decl.observations && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <strong>Observaciones:</strong> {decl.observations}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeclarationModal({
  decl,
  onClose,
  onSave,
}: {
  decl: Partial<Declaration> | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<Record<string, string | number>>({
    year: decl?.year ?? new Date().getFullYear() - 1,
    establishment_name: decl?.establishment_name ?? "Hospital Dr. Hernán Henríquez Aravena",
    establishment_rut: decl?.establishment_rut ?? "61.606.400-5",
    cchen_license: decl?.cchen_license ?? "",
    responsible_pr: decl?.responsible_pr ?? "TM. Diego Solís Catalán",
    responsible_rut: decl?.responsible_rut ?? "16.397.583-1",
    responsible_title: decl?.responsible_title ?? "Encargado de Protección Radiológica",
    total_poe: decl?.total_poe ?? "",
    total_poe_dosimetry: decl?.total_poe_dosimetry ?? "",
    poe_male: decl?.poe_male ?? "",
    poe_female: decl?.poe_female ?? "",
    avg_dose_mSv: decl?.avg_dose_mSv ?? "",
    max_dose_mSv: decl?.max_dose_mSv ?? "",
    total_collective_mSv: decl?.total_collective_mSv ?? "",
    poe_over_1mSv: decl?.poe_over_1mSv ?? "",
    poe_over_6mSv: decl?.poe_over_6mSv ?? "",
    poe_over_15mSv: decl?.poe_over_15mSv ?? 0,
    poe_over_20mSv: decl?.poe_over_20mSv ?? 0,
    poe_pregnant: decl?.poe_pregnant ?? 0,
    poe_apprentice: decl?.poe_apprentice ?? 0,
    incidents_count: decl?.incidents_count ?? 0,
    work_areas_count: decl?.work_areas_count ?? "",
    radiation_sources: decl?.radiation_sources ?? "",
    submission_date: decl?.submission_date?.split("T")[0] ?? "",
    cchen_receipt_number: decl?.cchen_receipt_number ?? "",
    status: decl?.status ?? "draft",
    observations: decl?.observations ?? "",
  });

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const numFields = ["year","total_poe","total_poe_dosimetry","poe_male","poe_female",
    "avg_dose_mSv","max_dose_mSv","total_collective_mSv","poe_over_1mSv","poe_over_6mSv",
    "poe_over_15mSv","poe_over_20mSv","poe_pregnant","poe_apprentice","incidents_count","work_areas_count"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form };
    numFields.forEach(k => { if (payload[k] !== "" && payload[k] != null) payload[k] = Number(payload[k]); });
    if (decl?.id) {
      payload.id = decl.id;
      await fetch("/api/cchen-declarations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/cchen-declarations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {decl?.id ? "Editar Declaración" : "Nueva Declaración CCHEN"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Año de declaración</label>
              <input type="number" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.year as number} onChange={e => set("year", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.status as string} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Licencia CCHEN</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="CCHEN-LIC-YYYY-MN-XXXX" value={form.cchen_license as string} onChange={e => set("cchen_license", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Encargado PR</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.responsible_pr as string} onChange={e => set("responsible_pr", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">RUT Encargado</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.responsible_rut as string} onChange={e => set("responsible_rut", e.target.value)} />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dotación POE</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["total_poe","Total POE"],["total_poe_dosimetry","Con dosimetría"],
                ["poe_male","Masculino"],["poe_female","Femenino"],
                ["poe_pregnant","Embarazadas"],["poe_apprentice","Aprendices"],
              ].map(([k, lbl]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-600 mb-1">{lbl}</label>
                  <input type="number" min="0" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form[k] as string} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dosis</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["avg_dose_mSv","Prom. (mSv)"],["max_dose_mSv","Máx. (mSv)"],
                ["total_collective_mSv","Colectiva (p·mSv)"],
                ["poe_over_1mSv","POE > 1 mSv"],["poe_over_6mSv","POE > 6 mSv (NA)"],
                ["poe_over_15mSv","POE > 15 mSv (NI)"],
              ].map(([k, lbl]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-600 mb-1">{lbl}</label>
                  <input type="number" step="any" min="0" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form[k] as string} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">N° Incidentes</label>
              <input type="number" min="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.incidents_count as string} onChange={e => set("incidents_count", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Áreas c/ radiación</label>
              <input type="number" min="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.work_areas_count as string} onChange={e => set("work_areas_count", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fuentes de radiación</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.radiation_sources as string} onChange={e => set("radiation_sources", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de envío a CCHEN</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.submission_date as string} onChange={e => set("submission_date", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">N° Recibo CCHEN</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="REC-CCHEN-YYYY-XXXX" value={form.cchen_receipt_number as string} onChange={e => set("cchen_receipt_number", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observaciones</label>
            <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.observations as string} onChange={e => set("observations", e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              {decl?.id ? "Guardar Cambios" : "Crear Declaración"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CCHENDeclarationsPage() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalDecl, setModalDecl] = useState<Partial<Declaration> | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/cchen-declarations");
    const d = await r.json();
    setDeclarations(d.declarations ?? []);
    setStats(d.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: number, status: string) => {
    const payload: Record<string, unknown> = { id, status };
    if (status === "submitted") payload.submission_date = new Date().toISOString().split("T")[0];
    await fetch("/api/cchen-declarations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    load();
  };

  const currentYear = new Date().getFullYear();
  const hasCurrentYear = declarations.some(d => d.year === currentYear - 1 && d.status === "acknowledged");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 print:p-0">
      {/* Header — hidden on print */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={26} />
              Declaración Anual de Dosis — CCHEN
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">DS 3/1985 Art. 10 — NS-06.0 §4.4 — Plazo reglamentario: 31 de marzo</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors" title="Actualizar">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setModalDecl({})}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus size={16} />
              Nueva Declaración
            </button>
          </div>
        </div>

        {/* Alert: missing current year */}
        {!hasCurrentYear && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-800 text-sm">
                Declaración año {currentYear - 1} pendiente de envío a CCHEN
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                El plazo reglamentario para declarar las dosis del año {currentYear - 1} vence el 31 de marzo de {currentYear}.
              </p>
            </div>
          </div>
        )}

        {/* KPI tiles */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Total Declaraciones</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-400 mt-1">Historial completo</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 size={12} className="text-green-600" /> Acusadas CCHEN
              </div>
              <div className="text-3xl font-bold text-green-600">{stats.acknowledged}</div>
              <div className="text-xs text-gray-400 mt-1">Con recibo oficial</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
                <BarChart2 size={12} className="text-purple-600" /> Enviadas CCHEN
              </div>
              <div className="text-3xl font-bold text-purple-600">{stats.submitted}</div>
              <div className="text-xs text-gray-400 mt-1">Pendientes acuse</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
                <Clock size={12} className="text-yellow-600" /> En Preparación
              </div>
              <div className={`text-3xl font-bold ${stats.pending > 0 ? "text-yellow-600" : "text-gray-900"}`}>{stats.pending}</div>
              <div className="text-xs text-gray-400 mt-1">Borrador / lista p/ envío</div>
            </div>
          </div>
        )}
      </div>

      {/* Declarations list */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400 print:hidden">
          <RefreshCw size={28} className="animate-spin" />
        </div>
      ) : declarations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 print:hidden">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay declaraciones registradas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {declarations.map(d => (
            <DeclarationCard
              key={d.id}
              decl={d}
              onEdit={o => setModalDecl(o)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100 print:hidden">
        DS 3/1985 Art. 10 — NS-06.0 §4.4 — Declaración Anual de Dosis ante CCHEN · Plazo: 31 marzo de cada año
      </div>

      {modalDecl !== undefined && (
        <DeclarationModal
          decl={modalDecl}
          onClose={() => setModalDecl(undefined)}
          onSave={load}
        />
      )}
    </div>
  );
}
