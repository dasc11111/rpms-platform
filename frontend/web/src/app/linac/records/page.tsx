"use client";


import { useEffect, useState } from "react";
import { RefreshCw, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";

type RecordType = "clinical" | "radiation" | "risk" | "emergency" | "audit";

interface RecordRow { id: number; [key: string]: unknown; }

const inp = "rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const TYPE_LABELS: Record<RecordType, string> = {
  clinical: "Operaciones Clínicas",
  radiation: "Protección Radiológica",
  risk: "Gestión de Riesgos",
  emergency: "Emergencias",
  audit: "Auditorías",
};

const TYPE_COLORS: Record<RecordType, string> = {
  clinical: "bg-blue-100 text-blue-700",
  radiation: "bg-yellow-100 text-yellow-700",
  risk: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
  audit: "bg-purple-100 text-purple-700",
};

function fmtDate(d: unknown) {
  if (!d || typeof d !== "string") return "—";
  return new Date(d).toLocaleDateString("es-CL");
}

function RecordCard({ rec, type }: { rec: RecordRow; type: RecordType }) {
  const [open, setOpen] = useState(false);
  const dateField = ["op_date", "measurement_date", "event_date", "audit_date"].find(f => rec[f]);
  const date = dateField ? fmtDate(rec[dateField]) : "—";
  const title = (rec.treatment_type as string) || (rec.measurement_type as string) || (rec.risk as string) || (rec.incident_type as string) || (rec.audit_scope as string) || `Registro #${rec.id}`;
  const status = (rec.status as string) || (rec.semaphore as string) || (rec.risk_level as string) || "";

  return (
    <div className="bg-background rounded-xl border border-border shadow-sm">
      <button className="w-full flex items-center justify-between px-5 py-3 text-left" onClick={() => setOpen(v => !v)}>
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{date}</div>
        </div>
        <div className="flex items-center gap-2">
          {status && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{status}</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-border/50 bg-muted/50 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          {Object.entries(rec).filter(([k, v]) => v !== null && v !== "" && !["id", "linac_id", "blob_url"].includes(k)).map(([k, v]) => (
            <div key={k}><span className="font-medium text-muted-foreground">{k.replace(/_/g, " ")}:</span> {String(v)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LinacRecordsPage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [type, setType] = useState<RecordType>("clinical");
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true); setMsg("");
    fetch(`/api/linac/records?type=${type}&linacId=${linacId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setMsg(d.error); else setRecords(d.records ?? []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [type, linacId]);

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><ClipboardList className="h-6 w-6 text-purple-700" /></div>
            <div><h1 className="text-2xl font-bold text-foreground">Registros LINAC</h1><p className="text-sm text-muted-foreground">Operaciones clínicas, riesgos, emergencias y auditorías</p></div>
          </div>
          <button onClick={load} disabled={loading}><RefreshCw className={`h-5 w-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {msg && <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700">{msg}</div>}

        {/* Type tabs */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_LABELS) as RecordType[]).map(t => (
            <button key={t} onClick={() => setType(t)} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${type === t ? TYPE_COLORS[t] + " border-transparent font-semibold" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
              {TYPE_LABELS[t]}
            </button>
          ))}
          <input className={inp + " w-24 ml-auto"} type="number" min="1" placeholder="LINAC ID" value={linacId} onChange={e => setLinacId(e.target.value)} />
        </div>

        {/* KPI */}
        <div className="bg-background rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
          <div className={`text-2xl font-bold ${TYPE_COLORS[type].split(" ")[1] ?? "text-foreground/80"}`}>{records.length}</div>
          <div className="text-sm text-muted-foreground">{TYPE_LABELS[type]} · LINAC {linacId}</div>
        </div>

        {/* Records */}
        <div className="space-y-3">
          {records.slice(0, 100).map(rec => <RecordCard key={rec.id} rec={rec} type={type} />)}
        </div>

        {records.length === 0 && !loading && <div className="text-center py-12 text-muted-foreground">No hay registros de tipo "{TYPE_LABELS[type]}"</div>}

        <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground">
          <p className="font-semibold text-muted-foreground mb-1">Marco normativo</p>
          <p>DS N°12/2010 MINSAL — Registros obligatorios en instalaciones de radioterapia. IAEA TECDOC-1040 — Gestión de incidencias y registros en radioterapia. AAPM TG-100 — Risk-based quality management en radioterapia. CCHEN ORD sobre archivo técnico histórico de aceleradores.</p>
        </div>
      </div>
    </div>
  );
}
