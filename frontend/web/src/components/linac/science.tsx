"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Search, CheckCircle2, XCircle, FileText, RefreshCw, PlusCircle, ExternalLink, TrendingUp, Bell, HelpCircle, LayoutDashboard } from "lucide-react";
import { ScienceDocuments } from "@/components/linac/science-documents";

const SOURCE_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: "1 - Normativa Chile" },
  { value: 2, label: "2 - ARPANSA" },
  { value: 3, label: "3 - IAEA/OIEA" },
  { value: 4, label: "4 - IEC" },
  { value: 5, label: "5 - AAPM" },
  { value: 6, label: "6 - ICRU" },
  { value: 7, label: "7 - Documentacion del fabricante" },
  { value: 8, label: "8 - Protocolo institucional" },
  { value: 9, label: "9 - Otro documento cientifico validado" },
];

const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "acceptance_testing", label: "Acceptance Testing" },
  { value: "commissioning", label: "Commissioning" },
  { value: "baseline", label: "Baseline Clinico" },
  { value: "beam_data", label: "Beam Data" },
  { value: "qc", label: "Control de Calidad" },
  { value: "radiation", label: "Proteccion Radiologica" },
  { value: "maintenance", label: "Mantenimiento" },
];

const STATUS_INFO: Record<string, { label: string; cls: string; dot: string }> = {
  propuesto: { label: "Pendiente de validacion", cls: "text-warning", dot: "bg-warning" },
  activo: { label: "Criterio activo", cls: "text-success", dot: "bg-success" },
  rechazado: { label: "Rechazado", cls: "text-danger", dot: "bg-danger" },
  historico: { label: "Historico", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const DECISION_OPTIONS: { value: string; label: string }[] = [
  { value: "revisar", label: "Revisar" },
  { value: "investigar", label: "Investigar" },
  { value: "repetir_medicion", label: "Repetir medicion" },
  { value: "registrar_mantenimiento", label: "Registrar mantenimiento" },
  { value: "registrar_correctiva", label: "Registrar accion correctiva" },
  { value: "justificar", label: "Justificar desviacion" },
  { value: "escalar_fisico_medico", label: "Escalar a Fisico Medico" },
  { value: "escalar_opr", label: "Escalar a OPR" },
  { value: "suspender_operacion", label: "Suspender operacion" },
];
const EMPTY_FORM: any = {
  parameterName: "",
  module: "general",
  value: "",
  unit: "",
  tolerance: "",
  actionLimit: "",
  investigationLimit: "",
  criticalLimit: "",
  sourceLevel: 2,
  sourceName: "ARPANSA",
  documentId: "",
  documentVersion: "",
  page: "",
  chapter: "",
  section: "",
  tableRef: "",
  fragmentText: "",
};

export function ScienceTab({ unitId, actorEmail }: any) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [criteria, setCriteria] = useState<any[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [docPick, setDocPick] = useState<any[]>([]);
  const [docQuery, setDocQuery] = useState("");

  const actor = actorEmail || "Usuario RPMS";
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!unitId) return;
    setLoadingDashboard(true);
    try {
      const res = await fetch("/api/linac/intelligence-dashboard?linacId=" + unitId);
      const data = await res.json();
      setDashboardData(data);
    } finally {
      setLoadingDashboard(false);
    }
  }, [unitId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const [measurementType, setMeasurementType] = useState("");
  const [trendResult, setTrendResult] = useState<any>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertStatusFilter, setAlertStatusFilter] = useState("abierta");
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [decisionOpenId, setDecisionOpenId] = useState<number | null>(null);
  const [decisionsByAlert, setDecisionsByAlert] = useState<Record<number, any[]>>({});
  const [decisionChoice, setDecisionChoice] = useState("revisar");
  const [decisionJustification, setDecisionJustification] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [assistantParam, setAssistantParam] = useState("");
  const [assistantModule, setAssistantModule] = useState("general");
  const [assistantResult, setAssistantResult] = useState<any>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  const loadCriteria = useCallback(async () => {
    setLoadingCriteria(true);
    try {
      const params = new URLSearchParams();
      if (moduleFilter) params.set("module", moduleFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (unitId) params.set("linacId", String(unitId));
      const res = await fetch("/api/linac/criteria?" + params.toString());
      const data = await res.json();
      setCriteria(data.criteria || []);
    } finally {
      setLoadingCriteria(false);
    }
  }, [moduleFilter, statusFilter, unitId]);

  useEffect(() => { loadCriteria(); }, [loadCriteria]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/linac/technical-search?q=" + encodeURIComponent(q));
        const data = await res.json();
        setResults(data.results || []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const q = docQuery.trim();
    if (q.length < 2) { setDocPick([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch("/api/linac/technical-search?q=" + encodeURIComponent(q));
      const data = await res.json();
      setDocPick((data.results || []).filter((r: any) => r.type === "documento"));
    }, 350);
    return () => clearTimeout(t);
  }, [docQuery]);

  function setF(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  async function submitProposal() {
    if (!form.parameterName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/linac/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, linacId: unitId, proposedBy: actor }),
      });
      setForm(EMPTY_FORM);
      setDocQuery("");
      setShowForm(false);
      loadCriteria();
    } finally {
      setSaving(false);
    }
  }

  async function actOn(id: number, action: string, extra?: any) {
    await fetch("/api/linac/criteria/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, actor, ...(extra || {}) }),
    });
    loadCriteria();
  }

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const params = new URLSearchParams();
      if (unitId) params.set("linacId", String(unitId));
      if (alertStatusFilter) params.set("status", alertStatusFilter);
      const res = await fetch("/api/linac/alerts?" + params.toString());
      const data = await res.json();
      setAlerts(data.alerts || []);
    } finally {
      setLoadingAlerts(false);
    }
  }, [unitId, alertStatusFilter]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  async function runTrend(generate: boolean) {
    if (!measurementType.trim() || !unitId) return;
    setLoadingTrend(true);
    try {
      const params = new URLSearchParams();
      params.set("linacId", String(unitId));
      params.set("measurementType", measurementType.trim());
      if (generate) params.set("generateAlert", "true");
      const res = await fetch("/api/linac/trends?" + params.toString());
      const data = await res.json();
      setTrendResult(data);
      if (generate) loadAlerts();
    } finally {
      setLoadingTrend(false);
    }
  }

  async function alertAction(id: number, action: string) {
    await fetch("/api/linac/alerts/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, actor }),
    });
    loadAlerts();
  }

  async function toggleDecisionPanel(a: any) {
  if (decisionOpenId === a.id) {
    setDecisionOpenId(null);
    return;
  }
  setDecisionOpenId(a.id);
  setDecisionChoice("revisar");
  setDecisionJustification("");
  const res = await fetch("/api/linac/decisions?alertId=" + a.id);
  const data = await res.json();
  setDecisionsByAlert((prev) => ({ ...prev, [a.id]: data.decisions || [] }));
}

async function submitDecision(a: any) {
  setSavingDecision(true);
  try {
    await fetch("/api/linac/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertId: a.id,
        linacId: unitId,
        sourceModule: a.module,
        sourceRecordId: a.source_record_id,
        parameterName: a.parameter_name,
        measuredValue: a.measured_value,
        referenceValue: a.reference_value,
        deviation: a.deviation_pct,
        criteriaId: a.criteria_id,
        decision: decisionChoice,
        justification: decisionJustification,
        decidedBy: actor,
      }),
    });
    setDecisionJustification("");
    const res = await fetch("/api/linac/decisions?alertId=" + a.id);
    const data = await res.json();
    setDecisionsByAlert((prev) => ({ ...prev, [a.id]: data.decisions || [] }));
  } finally {
    setSavingDecision(false);
  }
}
async function askAssistant() {
  if (!assistantParam.trim() || !unitId) return;
  setAssistantLoading(true);
  try {
    const params = new URLSearchParams();
    params.set("linacId", String(unitId));
    params.set("parameterName", assistantParam.trim());
    params.set("module", assistantModule);
    const res = await fetch("/api/linac/technical-assistant?" + params.toString());
    const data = await res.json();
    setAssistantResult(data);
  } finally {
    setAssistantLoading(false);
  }
}
const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
  const labelCls = "text-xs text-muted-foreground";

  return (
    <div className="space-y-6">
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="mb-3 flex items-center justify-between">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <LayoutDashboard className="h-4 w-4" /> Inteligencia Tecnica
      </p>
      <button onClick={loadDashboard} className="rounded border border-border p-1.5" title="Actualizar">
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
    {loadingDashboard ? (
      <p className="text-xs text-muted-foreground">Cargando...</p>
    ) : !dashboardData ? (
      <p className="text-xs text-muted-foreground">Sin datos disponibles.</p>
    ) : (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Criterios activos</p>
          <p className="text-lg font-semibold text-success">{dashboardData.criterios.activo}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Criterios pendientes</p>
          <p className="text-lg font-semibold text-warning">{dashboardData.criterios.propuesto}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Alertas abiertas</p>
          <p className="text-lg font-semibold text-danger">{dashboardData.alertas.abiertas}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Alertas en revision</p>
          <p className="text-lg font-semibold text-warning">{dashboardData.alertas.enRevision}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Decisiones (7 dias)</p>
          <p className="text-lg font-semibold text-foreground">{dashboardData.decisiones.ultimos7dias}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">QC registrados (90 dias)</p>
          <p className="text-lg font-semibold text-foreground">{dashboardData.qc.ultimos90dias}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Documentos vigentes</p>
          <p className="text-lg font-semibold text-success">{dashboardData.documentos.vigente || 0}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Proxima revision</p>
          <p className="text-lg font-semibold text-warning">{dashboardData.documentos.proxima_revision || 0}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Requieren actualizacion</p>
          <p className="text-lg font-semibold text-danger">{dashboardData.documentos.requiere_revision || 0}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Documentos obsoletos</p>
          <p className="text-lg font-semibold text-muted-foreground">{dashboardData.documentos.obsoleto || 0}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Historicos</p>
          <p className="text-lg font-semibold text-muted-foreground">{dashboardData.documentos.historico || 0}</p>
        </div>
        <div className="rounded border border-border p-2 text-xs">
          <p className="text-muted-foreground">Analisis documental pendiente</p>
          <p className="text-lg font-semibold text-warning">{dashboardData.documentosPendientesAnalisis}</p>
        </div>
      </div>
    )}
  </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Search className="h-4 w-4" /> Buscador Tecnico
        </p>
        <input
          className={inputCls}
          placeholder="Buscar: ARPANSA, RPS 14.3, tolerancia, interlock, blindaje, commissioning..."
          value={query}
          onChange={(e: any) => setQuery(e.target.value)}
        />
        {searching && <p className="mt-2 text-xs text-muted-foreground">Buscando...</p>}
        {results.length > 0 && (
          <div className="mt-3 space-y-2">
            {results.map((r: any) => (
              <div key={r.type + "-" + r.id} className="rounded border border-border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {r.type === "documento" ? "Documento: " : "Criterio: "}{r.title}
                  </span>
                  {r.documentUrl && (
                    <a href={r.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary">
                      <ExternalLink className="h-3 w-3" /> Ver fuente
                    </a>
                  )}
                </div>
                {r.subtitle && <p className="text-muted-foreground">{r.subtitle}</p>}
                {(r.page || r.chapter || r.section || r.tableRef) && (
                  <p className="text-muted-foreground">
                    {[r.page ? "Pag. " + r.page : null, r.chapter, r.section, r.tableRef ? "Tabla " + r.tableRef : null]
                      .filter(Boolean).join(" / ")}
                  </p>
                )}
                {r.fragment && <p className="mt-1 italic text-foreground">"{r.fragment}"</p>}
              </div>
            ))}
          </div>
        )}
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Sin resultados. Puede que se trate de CRITERIO PENDIENTE DE PARAMETRIZACION.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4" /> Criterios Tecnicos
          </p>
          <div className="flex items-center gap-2">
            <select className={inputCls} value={moduleFilter} onChange={(e: any) => setModuleFilter(e.target.value)}>
              <option value="">Todos los modulos</option>
              {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className={inputCls} value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="propuesto">Pendiente de validacion</option>
              <option value="activo">Criterio activo</option>
              <option value="rechazado">Rechazado</option>
              <option value="historico">Historico</option>
            </select>
            <button onClick={loadCriteria} className="rounded border border-border p-1.5" title="Actualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1 rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Proponer criterio
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4 rounded border border-border p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">CRITERIO TECNICO PROPUESTO</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div>
                <label className={labelCls}>Parametro</label>
                <input className={inputCls} value={form.parameterName} onChange={(e: any) => setF("parameterName", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Modulo</label>
                <select className={inputCls} value={form.module} onChange={(e: any) => setF("module", e.target.value)}>
                  {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Valor encontrado</label>
                <input className={inputCls} value={form.value} onChange={(e: any) => setF("value", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Unidad</label>
                <input className={inputCls} value={form.unit} onChange={(e: any) => setF("unit", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Tolerancia (%)</label>
                <input className={inputCls} value={form.tolerance} onChange={(e: any) => setF("tolerance", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Limite de accion (%)</label>
                <input className={inputCls} value={form.actionLimit} onChange={(e: any) => setF("actionLimit", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Limite de investigacion (%)</label>
                <input className={inputCls} value={form.investigationLimit} onChange={(e: any) => setF("investigationLimit", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Limite critico (%)</label>
                <input className={inputCls} value={form.criticalLimit} onChange={(e: any) => setF("criticalLimit", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Jerarquia de fuente</label>
                <select
                  className={inputCls}
                  value={form.sourceLevel}
                  onChange={(e: any) => setF("sourceLevel", Number(e.target.value))}
                >
                  {SOURCE_LEVELS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nombre de la fuente</label>
                <input className={inputCls} value={form.sourceName} onChange={(e: any) => setF("sourceName", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Documento (Documentos - Medicina Nuclear)</label>
                <input
                  className={inputCls}
                  placeholder="Buscar documento por nombre o codigo..."
                  value={docQuery}
                  onChange={(e: any) => setDocQuery(e.target.value)}
                />
                {docPick.length > 0 && (
                  <div className="mt-1 max-h-32 overflow-auto rounded border border-border">
                    {docPick.map((d: any) => (
                      <button
                        key={d.id}
                        type="button"
                        className="block w-full px-2 py-1 text-left text-xs hover:bg-muted"
                        onClick={() => { setF("documentId", d.id); setDocQuery(d.title); setDocPick([]); }}
                      >
                        {d.title} {d.subtitle ? "(" + d.subtitle + ")" : ""}
                      </button>
                    ))}
                  </div>
                )}
                {form.documentId && <p className="mt-1 text-xs text-success">Documento seleccionado (ID {form.documentId})</p>}
              </div>
              <div>
                <label className={labelCls}>Version del documento</label>
                <input className={inputCls} value={form.documentVersion} onChange={(e: any) => setF("documentVersion", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Pagina</label>
                <input className={inputCls} value={form.page} onChange={(e: any) => setF("page", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Capitulo</label>
                <input className={inputCls} value={form.chapter} onChange={(e: any) => setF("chapter", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Seccion</label>
                <input className={inputCls} value={form.section} onChange={(e: any) => setF("section", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Tabla</label>
                <input className={inputCls} value={form.tableRef} onChange={(e: any) => setF("tableRef", e.target.value)} />
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className={labelCls}>Fragmento utilizado</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form.fragmentText}
                  onChange={(e: any) => setF("fragmentText", e.target.value)}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Este criterio quedara marcado 🟡 PENDIENTE DE VALIDACION. No se activara automaticamente.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                disabled={saving}
                onClick={submitProposal}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar propuesta"}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded border border-border px-3 py-1.5 text-xs">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingCriteria ? (
          <p className="text-xs text-muted-foreground">Cargando criterios...</p>
        ) : criteria.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin criterios registrados para este filtro.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1">Parametro</th>
                  <th className="pb-1">Modulo</th>
                  <th className="pb-1">Valor</th>
                  <th className="pb-1">Fuente</th>
                  <th className="pb-1">Documento</th>
                  <th className="pb-1">Estado</th>
                  <th className="pb-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c: any) => {
                  const info = STATUS_INFO[c.status] || { label: c.status, cls: "text-muted-foreground", dot: "bg-muted-foreground" };
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-1.5 font-medium text-foreground">{c.parameter_name}</td>
                      <td className="py-1.5">{c.module}</td>
                      <td className="py-1.5">{c.value || "-"} {c.unit || ""}</td>
                      <td className="py-1.5">{c.source_name || "-"}</td>
                      <td className="py-1.5">
                        {c.document_url ? (
                          <a href={c.document_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary">
                            <ExternalLink className="h-3 w-3" /> Ver fuente
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-1.5">
                        <span className={"flex items-center gap-1 " + info.cls}>
                          <span className={"h-1.5 w-1.5 rounded-full " + info.dot} /> {info.label}
                        </span>
                      </td>
                      <td className="py-1.5">
                        {c.status === "propuesto" && (
                          <div className="flex gap-1">
                            <button
                              title="Aprobar criterio"
                              onClick={() => actOn(c.id, "aprobar")}
                              className="rounded border border-success/40 p-1 text-success"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Rechazar criterio"
                              onClick={() => actOn(c.id, "rechazar")}
                              className="rounded border border-danger/40 p-1 text-danger"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {c.status === "activo" && (
                          <button
                            title="Crear nueva version"
                            onClick={() => actOn(c.id, "nueva_version")}
                            className="rounded border border-border px-2 py-0.5 text-xs"
                          >
                            Nueva version
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4" /> Motor de Tendencias
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelCls}>Tipo de medicion (QC)</label>
            <input
              className={inputCls}
              placeholder="Ej: tasa_dosis_fuga, output_diario..."
              value={measurementType}
              onChange={(e: any) => setMeasurementType(e.target.value)}
            />
          </div>
          <button disabled={loadingTrend} onClick={() => runTrend(false)} className="rounded border border-border px-3 py-1.5 text-xs">
            {loadingTrend ? "Analizando..." : "Analizar"}
          </button>
          <button disabled={loadingTrend} onClick={() => runTrend(true)} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Analizar y generar alerta si corresponde
          </button>
        </div>
        {trendResult && (
          <div className="mt-3 space-y-2 text-xs">
            {trendResult.n === 0 ? (
              <p className="text-muted-foreground">Sin mediciones registradas para este tipo en este equipo.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">N</p>
                    <p className="font-semibold text-foreground">{trendResult.stats ? trendResult.stats.n : "-"}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">Media</p>
                    <p className="font-semibold text-foreground">{trendResult.stats ? trendResult.stats.mean.toFixed(3) : "-"}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">Desv. estandar</p>
                    <p className="font-semibold text-foreground">{trendResult.stats ? trendResult.stats.stdDev.toFixed(3) : "-"}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">CV%</p>
                    <p className="font-semibold text-foreground">{trendResult.stats && trendResult.stats.cv !== null ? trendResult.stats.cv.toFixed(2) : "-"}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">Min / Max</p>
                    <p className="font-semibold text-foreground">{trendResult.stats ? trendResult.stats.min.toFixed(3) + " / " + trendResult.stats.max.toFixed(3) : "-"}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">UCL / LCL (2 sigma)</p>
                    <p className="font-semibold text-foreground">{trendResult.stats ? trendResult.stats.ucl.toFixed(3) + " / " + trendResult.stats.lcl.toFixed(3) : "-"}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-muted-foreground">Tendencia</p>
                    <p className="font-semibold text-foreground">{trendResult.trend ? trendResult.trend.direction : "Sin datos suficientes"}</p>
                  </div>
                </div>
                <div className="rounded border border-border p-2">
                  <p className="mb-1 font-semibold text-foreground">Evaluacion contra criterio activo</p>
                  {(!trendResult.evaluation || !trendResult.evaluation.evaluated) ? (
                    <p className="text-muted-foreground">
                      {trendResult.evaluation && trendResult.evaluation.reason === "CRITERIO PENDIENTE DE PARAMETRIZACION"
                        ? "CRITERIO PENDIENTE DE PARAMETRIZACION"
                        : trendResult.evaluation && trendResult.evaluation.reason === "INFORMACION INSUFICIENTE PARA ESTABLECER CRITERIO"
                        ? "INFORMACION INSUFICIENTE PARA ESTABLECER CRITERIO"
                        : "Sin evaluacion disponible."}
                    </p>
                  ) : (
                    <p>
                      Ultimo valor medido: <span className="font-semibold text-foreground">{trendResult.evaluation.measured}</span>{" "}
                      vs referencia activa <span className="font-semibold text-foreground">{trendResult.evaluation.refValue}</span>. Desviacion{" "}
                      <span className="font-semibold text-foreground">
                        {trendResult.evaluation.deviationPct !== null ? trendResult.evaluation.deviationPct.toFixed(2) + "%" : "N/A"}
                      </span>{" "}
                      -{" "}
                      <span
                        className={
                          trendResult.evaluation.classification && trendResult.evaluation.classification.color === "red"
                            ? "text-danger"
                            : trendResult.evaluation.classification && (trendResult.evaluation.classification.color === "orange" || trendResult.evaluation.classification.color === "yellow")
                            ? "text-warning"
                            : trendResult.evaluation.classification && trendResult.evaluation.classification.color === "green"
                            ? "text-success"
                            : "text-muted-foreground"
                        }
                      >
                        {trendResult.evaluation.classification ? trendResult.evaluation.classification.label : ""}
                      </span>
                    </p>
                  )}
                </div>
              <div className="rounded border border-border p-2">
                <p className="mb-1 font-semibold text-foreground">Control Estadistico</p>
                {!trendResult.controlAnalysis ? (
                  <p className="text-muted-foreground">Sin datos suficientes para control estadistico.</p>
                ) : (
                  <>
                    <p className={trendResult.controlAnalysis.outOfControlPoints.length > 0 ? "text-danger" : "text-success"}>
                      {trendResult.controlAnalysis.outOfControlPoints.length > 0
                        ? trendResult.controlAnalysis.outOfControlPoints.length + " punto(s) fuera de control (fuera de UCL/LCL)"
                        : "Sin puntos fuera de control estadistico"}
                    </p>
                    {trendResult.controlAnalysis.anomalousSequences.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {trendResult.controlAnalysis.anomalousSequences.map((s: any, idx: number) => (
                          <li key={idx} className="text-warning">
                            TENDENCIA ANOMALA: {s.label} ({String(s.startDate).slice(0, 10)} a {String(s.endDate).slice(0, 10)})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted-foreground">Sin rachas anomalas detectadas.</p>
                    )}
                  </>
                )}
              </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4" /> Alertas Cientificas
          </p>
          <div className="flex items-center gap-2">
            <select className={inputCls} value={alertStatusFilter} onChange={(e: any) => setAlertStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="abierta">Abierta</option>
              <option value="en_revision">En revision</option>
              <option value="cerrada">Cerrada</option>
            </select>
            <button onClick={loadAlerts} className="rounded border border-border p-1.5" title="Actualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {loadingAlerts ? (
          <p className="text-xs text-muted-foreground">Cargando alertas...</p>
        ) : alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin alertas para este filtro.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1">Parametro</th>
                  <th className="pb-1">Modulo</th>
                  <th className="pb-1">Medido</th>
                  <th className="pb-1">Referencia</th>
                  <th className="pb-1">Desviacion</th>
                  <th className="pb-1">Nivel</th>
                  <th className="pb-1">Estado</th>
                  <th className="pb-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a: any) => (
  <Fragment key={a.id}>
  <tr className="border-t border-border">
    <td className="py-1.5 font-medium text-foreground">{a.parameter_name}</td>
    <td className="py-1.5">{a.module}</td>
    <td className="py-1.5">{a.measured_value}</td>
    <td className="py-1.5">{a.reference_value}</td>
    <td className="py-1.5">{a.deviation_pct !== null ? Number(a.deviation_pct).toFixed(2) + "%" : "-"}</td>
    <td className="py-1.5">{a.level}</td>
    <td className="py-1.5">{a.status}</td>
    <td className="py-1.5">
      <div className="flex gap-1">
        {a.status === "abierta" && (
          <button onClick={() => alertAction(a.id, "reconocer")} className="rounded border border-border px-2 py-0.5 text-xs">
            Reconocer
          </button>
        )}
        {a.status !== "cerrada" && (
          <button onClick={() => alertAction(a.id, "cerrar")} className="rounded border border-success/40 px-2 py-0.5 text-xs text-success">
            Cerrar
          </button>
        )}
        {a.status === "cerrada" && (
          <button onClick={() => alertAction(a.id, "reabrir")} className="rounded border border-border px-2 py-0.5 text-xs">
            Reabrir
          </button>
        )}
        <button onClick={() => toggleDecisionPanel(a)} className="rounded border border-border px-2 py-0.5 text-xs">
          {decisionOpenId === a.id ? "Ocultar decision" : "Decision"}
        </button>
      </div>
    </td>
  </tr>
  {decisionOpenId === a.id && (
    <tr className="border-t border-border bg-muted/30">
      <td colSpan={8} className="py-2">
        <div className="rounded border border-border p-3">
          <p className="mb-1 text-xs font-semibold text-foreground">SE DETECTO UNA DESVIACION</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Parametro: {a.parameter_name} / Valor: {a.measured_value} / Referencia: {a.reference_value} / Desviacion:{" "}
            {a.deviation_pct !== null ? Number(a.deviation_pct).toFixed(2) + "%" : "-"} / Fuente: {a.criteria_source || "-"}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls}>Accion</label>
              <select className={inputCls} value={decisionChoice} onChange={(e: any) => setDecisionChoice(e.target.value)}>
                {DECISION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Justificacion / observaciones</label>
              <input className={inputCls} value={decisionJustification} onChange={(e: any) => setDecisionJustification(e.target.value)} />
            </div>
            <button disabled={savingDecision} onClick={() => submitDecision(a)} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
              {savingDecision ? "Guardando..." : "Registrar decision"}
            </button>
          </div>
          <div className="mt-2">
            <p className="mb-1 text-xs font-semibold text-foreground">Historial de decisiones</p>
            {(decisionsByAlert[a.id] || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin decisiones registradas para esta alerta.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {(decisionsByAlert[a.id] || []).map((d: any) => (
                  <li key={d.id} className="rounded border border-border p-1.5">
                    <span className="font-medium text-foreground">{d.decision}</span> - {d.justification || "sin observaciones"}{" "}
                    <span className="text-muted-foreground">({d.decided_by || "-"}, {new Date(d.decided_at).toLocaleString()})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </td>
    </tr>
  )}
  </Fragment>
))}
</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
  <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
    <HelpCircle className="h-4 w-4" /> Asistente Tecnico
  </p>
  <p className="mb-2 text-xs text-muted-foreground">
    Responde unicamente con datos ya validados en el sistema (criterio activo, mediciones, baseline, alertas y documentos). Si no existe informacion registrada, lo indicara explicitamente.
  </p>
  <div className="flex flex-wrap items-end gap-2">
    <div>
      <label className={labelCls}>Parametro</label>
      <input
        className={inputCls}
        placeholder="Ej: Tasa de dosis de fuga en cabezal"
        value={assistantParam}
        onChange={(e: any) => setAssistantParam(e.target.value)}
      />
    </div>
    <div>
      <label className={labelCls}>Modulo</label>
      <select className={inputCls} value={assistantModule} onChange={(e: any) => setAssistantModule(e.target.value)}>
        {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
    <button disabled={assistantLoading} onClick={askAssistant} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
      {assistantLoading ? "Consultando..." : "Consultar"}
    </button>
  </div>
  {assistantResult && assistantResult.respuestas && (
    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="rounded border border-border p-2 text-xs">
        <p className="mb-1 font-semibold text-foreground">Cual es el criterio utilizado?</p>
        {typeof assistantResult.respuestas.criterioUtilizado === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.criterioUtilizado}</p>
        ) : (
          <p className="text-foreground">
            {assistantResult.respuestas.criterioUtilizado.valor} {assistantResult.respuestas.criterioUtilizado.unidad} (fuente: {assistantResult.respuestas.criterioUtilizado.fuente || "-"}, estado: {assistantResult.respuestas.criterioUtilizado.estado})
          </p>
        )}
      </div>
      <div className="rounded border border-border p-2 text-xs">
        <p className="mb-1 font-semibold text-foreground">Cual es la ultima medicion?</p>
        {typeof assistantResult.respuestas.ultimaMedicion === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.ultimaMedicion}</p>
        ) : (
          <p className="text-foreground">
            {assistantResult.respuestas.ultimaMedicion.valor} {assistantResult.respuestas.ultimaMedicion.unidad} el {String(assistantResult.respuestas.ultimaMedicion.fecha).slice(0, 10)} (resp: {assistantResult.respuestas.ultimaMedicion.responsable || "-"})
          </p>
        )}
      </div>
      <div className="rounded border border-border p-2 text-xs">
        <p className="mb-1 font-semibold text-foreground">Cual es la baseline?</p>
        {typeof assistantResult.respuestas.baseline === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.baseline}</p>
        ) : (
          <p className="text-foreground">
            Version {assistantResult.respuestas.baseline.version} - valor referencia {assistantResult.respuestas.baseline.valorReferencia ?? "-"} (aprobada: {String(assistantResult.respuestas.baseline.aprobadaEl).slice(0, 10)})
          </p>
        )}
      </div>
      <div className="rounded border border-border p-2 text-xs">
        <p className="mb-1 font-semibold text-foreground">Cuando comenzo la desviacion?</p>
        {typeof assistantResult.respuestas.inicioDesviacion === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.inicioDesviacion}</p>
        ) : (
          <p className="text-foreground">
            {String(assistantResult.respuestas.inicioDesviacion.fecha).slice(0, 10)} - nivel {assistantResult.respuestas.inicioDesviacion.nivel} ({assistantResult.respuestas.inicioDesviacion.estado})
          </p>
        )}
      </div>
      <div className="rounded border border-border p-2 text-xs">
        <p className="mb-1 font-semibold text-foreground">Que instrumento se utilizo?</p>
        {typeof assistantResult.respuestas.instrumentoUtilizado === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.instrumentoUtilizado}</p>
        ) : (
          <p className="text-foreground">{assistantResult.respuestas.instrumentoUtilizado}</p>
        )}
      </div>
      <div className="rounded border border-border p-2 text-xs">
        <p className="mb-1 font-semibold text-foreground">Cual es la referencia?</p>
        {typeof assistantResult.respuestas.referencia === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.referencia}</p>
        ) : (
          <p className="text-foreground">
            {assistantResult.respuestas.referencia.valor} {assistantResult.respuestas.referencia.unidad} - {assistantResult.respuestas.referencia.fuente || "-"} (nivel {assistantResult.respuestas.referencia.nivelFuente ?? "-"})
          </p>
        )}
      </div>
      <div className="rounded border border-border p-2 text-xs md:col-span-2">
        <p className="mb-1 font-semibold text-foreground">Que documento respalda este criterio?</p>
        {typeof assistantResult.respuestas.documentoQueRespalda === "string" ? (
          <p className="text-muted-foreground">{assistantResult.respuestas.documentoQueRespalda}</p>
        ) : (
          <p className="text-foreground">
            {assistantResult.respuestas.documentoQueRespalda.nombre} (v{assistantResult.respuestas.documentoQueRespalda.version}){" "}
            {assistantResult.respuestas.documentoQueRespalda.url && (
              <a href={assistantResult.respuestas.documentoQueRespalda.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                <ExternalLink className="h-3 w-3" /> Ver fuente
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  )}
</div>

<ScienceDocuments unitId={unitId} actorEmail={actorEmail} />

    </div>
  );
}
