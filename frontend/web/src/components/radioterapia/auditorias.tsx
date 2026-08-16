"use client";

import { useCallback, useEffect, useState } from "react";

const AUDIT_TYPES = [
  { value: "interna", label: "Interna" },
  { value: "externa", label: "Externa" },
  { value: "seremi", label: "SEREMI" },
  { value: "cchen", label: "CCHEN" },
  { value: "iaea", label: "IAEA" },
];

const AUDIT_STATUSES = [
  { value: "abierta", label: "Abierta" },
  { value: "en_seguimiento", label: "En seguimiento" },
  { value: "cerrada", label: "Cerrada" },
];

const FINDING_CLASSIFICATIONS = [
  { value: "conformidad", label: "Conformidad" },
  { value: "no_conformidad_mayor", label: "No conformidad mayor" },
  { value: "no_conformidad_menor", label: "No conformidad menor" },
  { value: "observacion", label: "Observacion" },
  { value: "oportunidad_mejora", label: "Oportunidad de mejora" },
];

const FINDING_COLORS: Record<string, string> = {
  conformidad: "text-success",
  no_conformidad_mayor: "text-danger",
  no_conformidad_menor: "text-warning",
  observacion: "text-muted-foreground",
  oportunidad_mejora: "text-accent",
};

const FINDING_STATUSES = [
  { value: "abierto", label: "Abierto" },
  { value: "en_tratamiento", label: "En tratamiento" },
  { value: "cerrado", label: "Cerrado" },
];

const CHECKLIST_RESPONSES = [
  { value: "cumple", label: "Cumple" },
  { value: "no_cumple", label: "No cumple" },
  { value: "observado", label: "Observado" },
  { value: "no_aplica", label: "No aplica" },
];

const DEFAULT_CHECKLIST_ITEMS: Record<string, string[]> = {
  interna: [
    "Documentacion de autorizacion vigente y disponible",
    "Registros de dosimetria del personal al dia",
    "Controles de calidad del acelerador al dia",
    "Dispositivos de seguridad verificados y operativos",
    "Procedimientos escritos disponibles y actualizados",
    "Registro de incidentes y quasi-incidentes actualizado",
    "Capacitacion del personal vigente",
    "Plan de emergencia radiologica disponible y difundido",
  ],
  externa: [
    "Cumplimiento de condiciones de la autorizacion",
    "Registros solicitados disponibles para el organismo fiscalizador",
    "Trazabilidad de fuentes y equipos generadores",
    "Evidencia de acciones correctivas de auditorias previas",
  ],
  seremi: [
    "Autorizacion sanitaria vigente",
    "Licencias de operador vigentes",
    "Registro de dosimetria personal disponible",
  ],
  cchen: [
    "Autorizacion CCHEN vigente",
    "Inventario de fuentes actualizado",
    "Levantamientos radiometricos vigentes",
  ],
  iaea: [
    "Cumplimiento de estandares de seguridad basicos (GSR Part 3)",
    "Cultura de seguridad radiologica evidenciada",
    "Sistema de gestion de calidad documentado",
  ],
};

function SummaryBox({ label, value }: any) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function AuditoriasTab({ facilityId, actorEmail }: any) {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ auditType: "interna", status: "abierta" });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [checklistNotes, setChecklistNotes] = useState<any>({});
  const [checklistResponse, setChecklistResponse] = useState<any>({});
  const [findingForm, setFindingForm] = useState<any>({ classification: "observacion" });
  const [savingFinding, setSavingFinding] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState<string | null>(null);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
  const labelCls = "text-xs text-muted-foreground";

  const load = useCallback(async () => {
    const res = await fetch("/api/radioterapia/audits?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) setList(data.audits);
  }, [facilityId]);

  const loadDetail = useCallback(async (auditId: number) => {
    const [fRes, cRes] = await Promise.all([
      fetch("/api/radioterapia/audits?auditId=" + auditId + "&kind=findings"),
      fetch("/api/radioterapia/audits?auditId=" + auditId + "&kind=checklist"),
    ]);
    const fData = await fRes.json();
    const cData = await cRes.json();
    if (fData.ok) setFindings(fData.findings);
    if (cData.ok) setChecklist(cData.checklist);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  const selectedAudit = list.find((a: any) => a.id === selectedId) || null;

  const totalAudits = list.length;
  const abiertas = list.filter((a: any) => a.status === "abierta" || a.status === "en_seguimiento").length;
  const proximaAuditoria = list
    .filter((a: any) => a.next_audit_date)
    .map((a: any) => a.next_audit_date)
    .sort()[0];
  const hallazgosAbiertosGlobal = selectedId ? findings.filter((f: any) => f.status !== "cerrado").length : 0;

  async function handleSave() {
    if (!form.auditDate) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...form }),
      });
      setForm({ auditType: "interna", status: "abierta" });
      load();
    } finally { setSaving(false); }
  }

  async function toggleStatus(id: number, status: string) {
    await fetch("/api/radioterapia/audits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, actorEmail }),
    });
    load();
  }

  async function handleChecklistSave(itemText: string, category: string) {
    const response = checklistResponse[itemText] || "no_aplica";
    const notes = checklistNotes[itemText] || "";
    setSavingChecklist(itemText);
    try {
      await fetch("/api/radioterapia/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "checklist_response", auditId: selectedId, itemText, category, response, notes, actorEmail }),
      });
      if (selectedId) loadDetail(selectedId);
    } finally { setSavingChecklist(null); }
  }

  async function handleFindingSave() {
    if (!findingForm.description) return;
    setSavingFinding(true);
    try {
      await fetch("/api/radioterapia/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "finding", auditId: selectedId, actorEmail, ...findingForm }),
      });
      setFindingForm({ classification: "observacion" });
      if (selectedId) loadDetail(selectedId);
    } finally { setSavingFinding(false); }
  }

  async function toggleFindingStatus(id: number, status: string) {
    await fetch("/api/radioterapia/audits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "finding_status", id, status, actorEmail }),
    });
    if (selectedId) loadDetail(selectedId);
  }

  function handleGenerateReport() {
    if (!selectedAudit) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const checklistRows = checklist
      .map((c: any) => "<tr><td>" + c.item_text + "</td><td>" + c.response + "</td><td>" + (c.notes || "-") + "</td></tr>")
      .join("");
    const findingRows = findings
      .map((f: any) => "<tr><td>" + f.description + "</td><td>" + f.classification + "</td><td>" + f.status + "</td><td>" + (f.responsible || "-") + "</td></tr>")
      .join("");
    win.document.write(
      "<html><head><title>Informe de auditoria</title>" +
      "<style>body{font-family:sans-serif;padding:24px;}h1{font-size:18px;}table{width:100%;border-collapse:collapse;margin-top:12px;}td,th{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left;}</style>" +
      "</head><body>" +
      "<h1>Informe de Auditoria - " + (selectedAudit.title || selectedAudit.audit_type) + "</h1>" +
      "<p>Tipo: " + selectedAudit.audit_type + " | Fecha: " + String(selectedAudit.audit_date).slice(0, 10) + " | Estado: " + selectedAudit.status + "</p>" +
      "<p>Auditor lider: " + (selectedAudit.lead_auditor || "-") + " | Participantes: " + (selectedAudit.participants || "-") + "</p>" +
      "<p>Alcance: " + (selectedAudit.scope || "-") + "</p>" +
      "<h2>Checklist</h2><table><tr><th>Item</th><th>Respuesta</th><th>Notas</th></tr>" + checklistRows + "</table>" +
      "<h2>Hallazgos</h2><table><tr><th>Descripcion</th><th>Clasificacion</th><th>Estado</th><th>Responsable</th></tr>" + findingRows + "</table>" +
      "</body></html>"
    );
    win.document.close();
    win.focus();
    win.print();
    fetch("/api/radioterapia/audits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "report_generated", id: selectedAudit.id, actorEmail }),
    }).then(() => load());
  }

  const checklistItems = DEFAULT_CHECKLIST_ITEMS[(selectedAudit && selectedAudit.audit_type) || "interna"] || [];
  const answeredItems = new Set(checklist.map((c: any) => c.item_text));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="Total auditorias" value={totalAudits} />
        <SummaryBox label="Abiertas" value={abiertas} />
        <SummaryBox label="Proxima auditoria" value={proximaAuditoria ? String(proximaAuditoria).slice(0, 10) : "-"} />
        <SummaryBox label="Hallazgos abiertos (seleccionada)" value={hallazgosAbiertosGlobal} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar auditoria / inspeccion</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input className={inputCls} placeholder="Titulo" value={form.title || ""} onChange={(e) => set("title", e.target.value)} />
          <select className={inputCls} value={form.auditType || "interna"} onChange={(e) => set("auditType", e.target.value)}>
            {AUDIT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <input type="date" className={inputCls} value={form.auditDate || ""} onChange={(e) => set("auditDate", e.target.value)} />
          <input className={inputCls} placeholder="Auditor lider" value={form.leadAuditor || ""} onChange={(e) => set("leadAuditor", e.target.value)} />
          <input className={inputCls} placeholder="Participantes" value={form.participants || ""} onChange={(e) => set("participants", e.target.value)} />
          <input type="date" className={inputCls} placeholder="Proxima auditoria" value={form.nextAuditDate || ""} onChange={(e) => set("nextAuditDate", e.target.value)} />
        </div>
        <textarea className={inputCls + " mt-2"} placeholder="Alcance de la auditoria" value={form.scope || ""} onChange={(e) => set("scope", e.target.value)} />
        <button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar auditoria"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Auditorias registradas</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Fecha</th><th className="p-1">Titulo</th><th className="p-1">Tipo</th><th className="p-1">Auditor lider</th><th className="p-1">Estado</th><th className="p-1">Proxima</th><th className="p-1">Ver</th>
          </tr></thead>
          <tbody>
            {list.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-1 text-foreground">{String(r.audit_date).slice(0, 10)}</td>
                <td className="p-1 text-foreground">{r.title || "-"}</td>
                <td className="p-1 text-foreground">{r.audit_type || "-"}</td>
                <td className="p-1 text-foreground">{r.lead_auditor || "-"}</td>
                <td className="p-1 text-foreground">
                  <select
                    value={r.status}
                    onChange={(e) => toggleStatus(r.id, e.target.value)}
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
                  >
                    {AUDIT_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </td>
                <td className="p-1 text-foreground">{r.next_audit_date ? String(r.next_audit_date).slice(0, 10) : "-"}</td>
                <td className="p-1">
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={"rounded border border-border px-1.5 py-0.5 " + (selectedId === r.id ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-background")}
                  >
                    {selectedId === r.id ? "Seleccionada" : "Ver"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedAudit && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Detalle: {selectedAudit.title || selectedAudit.audit_type} ({String(selectedAudit.audit_date).slice(0, 10)})
            </p>
            <button onClick={handleGenerateReport} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background">
              Generar informe (PDF)
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Alcance: {selectedAudit.scope || "-"}</p>
          <p className="text-xs text-muted-foreground">Auditor lider: {selectedAudit.lead_auditor || "-"} | Participantes: {selectedAudit.participants || "-"}</p>

          <p className="mt-4 mb-2 text-sm font-semibold text-foreground">Checklist ({selectedAudit.audit_type})</p>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Item</th><th className="p-1">Respuesta</th><th className="p-1">Notas</th><th className="p-1">Accion</th>
            </tr></thead>
            <tbody>
              {checklistItems.map((item: string) => (
                <tr key={item} className="border-t border-border">
                  <td className="p-1 text-foreground">{item}{answeredItems.has(item) ? " (respondido)" : ""}</td>
                  <td className="p-1">
                    <select
                      className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
                      value={checklistResponse[item] || "no_aplica"}
                      onChange={(e) => setChecklistResponse((s: any) => ({ ...s, [item]: e.target.value }))}
                    >
                      {CHECKLIST_RESPONSES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
                      value={checklistNotes[item] || ""}
                      onChange={(e) => setChecklistNotes((s: any) => ({ ...s, [item]: e.target.value }))}
                    />
                  </td>
                  <td className="p-1">
                    <button
                      onClick={() => handleChecklistSave(item, selectedAudit.audit_type)}
                      disabled={savingChecklist === item}
                      className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background disabled:opacity-50"
                    >
                      {savingChecklist === item ? "..." : "Guardar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {checklist.length > 0 && (
            <table className="mt-3 w-full text-xs">
              <thead><tr className="text-left text-muted-foreground">
                <th className="p-1">Registro checklist</th><th className="p-1">Respuesta</th><th className="p-1">Notas</th>
              </tr></thead>
              <tbody>
                {checklist.map((c: any) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-1 text-foreground">{c.item_text}</td>
                    <td className="p-1 text-foreground">{c.response}</td>
                    <td className="p-1 text-foreground">{c.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="mt-4 mb-2 text-sm font-semibold text-foreground">Hallazgos</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <input className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground sm:col-span-2 lg:col-span-2" placeholder="Descripcion del hallazgo" value={findingForm.description || ""} onChange={(e) => setFindingForm((f: any) => ({ ...f, description: e.target.value }))} />
            <select className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" value={findingForm.classification || "observacion"} onChange={(e) => setFindingForm((f: any) => ({ ...f, classification: e.target.value }))}>
              {FINDING_CLASSIFICATIONS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
            <input className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" placeholder="Requisito relacionado" value={findingForm.requirementRef || ""} onChange={(e) => setFindingForm((f: any) => ({ ...f, requirementRef: e.target.value }))} />
            <input className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" placeholder="Responsable" value={findingForm.responsible || ""} onChange={(e) => setFindingForm((f: any) => ({ ...f, responsible: e.target.value }))} />
            <input type="date" className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" value={findingForm.dueDate || ""} onChange={(e) => setFindingForm((f: any) => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <button onClick={handleFindingSave} disabled={savingFinding} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
            {savingFinding ? "Guardando..." : "Registrar hallazgo"}
          </button>

          <table className="mt-3 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Descripcion</th><th className="p-1">Clasificacion</th><th className="p-1">Responsable</th><th className="p-1">Vencimiento</th><th className="p-1">Estado</th>
            </tr></thead>
            <tbody>
              {findings.map((f: any) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="p-1 text-foreground">{f.description}</td>
                  <td className={"p-1 font-medium " + (FINDING_COLORS[f.classification] || "text-foreground")}>{f.classification}</td>
                  <td className="p-1 text-foreground">{f.responsible || "-"}</td>
                  <td className="p-1 text-foreground">{f.due_date ? String(f.due_date).slice(0, 10) : "-"}</td>
                  <td className="p-1">
                    <select
                      value={f.status}
                      onChange={(e) => toggleFindingStatus(f.id, e.target.value)}
                      className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
                    >
                      {FINDING_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
