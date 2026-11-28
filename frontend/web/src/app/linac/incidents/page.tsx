"use client";


import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Incident {
  id: number; linac_id: number; event: string; incident_date: string;
  incident_time: string | null; description: string | null; cause: string | null;
  consequence: string | null; dose: string | null; ines_level: string | null;
  investigation: string | null; corrective_actions: string | null; status: string | null;
}

const INES_CFG: Record<string, { bg: string; label: string }> = {
  "0": { bg: "bg-muted text-muted-foreground", label: "INES 0 (Desviación)" },
  "1": { bg: "bg-blue-100 text-blue-700", label: "INES 1 (Anomalía)" },
  "2": { bg: "bg-yellow-100 text-yellow-700", label: "INES 2 (Incidente)" },
  "3": { bg: "bg-orange-100 text-orange-700", label: "INES 3 (Incidente grave)" },
  "4": { bg: "bg-red-100 text-red-700", label: "INES 4 (Accidente)" },
  "5": { bg: "bg-red-200 text-red-800", label: "INES 5 (Accidente grave)" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LinacIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/linac/incidents")
      .then(r => r.json())
      .then(d => setIncidents(d.incidents ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const open = incidents.filter(i => i.status === "abierto" || i.status === "en_investigacion");
  const inesHigh = incidents.filter(i => Number(i.ines_level ?? 0) >= 2);

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="h-6 w-6 text-red-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Incidentes LINAC</h1>
              <p className="text-sm text-muted-foreground">Registro de eventos e incidentes — clasificación INES · DS 12/2010</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading}><RefreshCw className={`h-5 w-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {open.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3 text-red-700 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span><strong>{open.length}</strong> incidente{open.length > 1 ? "s" : ""} abierto{open.length > 1 ? "s" : ""} — requieren seguimiento.</span>
          </div>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total registros", value: incidents.length, color: "gray" },
            { label: "Abiertos", value: open.length, color: open.length > 0 ? "red" : "green" },
            { label: "INES ≥ 2", value: inesHigh.length, color: inesHigh.length > 0 ? "orange" : "green" },
            { label: "Cerrados", value: incidents.filter(i => i.status === "cerrado").length, color: "green" },
          ].map(t => (
            <div key={t.label} className="bg-background rounded-xl border border-border shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold text-${t.color}-600`}>{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Incidents */}
        {loading && incidents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Cargando…</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Sin incidentes registrados.</div>
        ) : (
          <div className="space-y-2">
            {incidents.map(inc => {
              const inesCfg = INES_CFG[inc.ines_level ?? ""] ?? { bg: "bg-muted text-muted-foreground", label: `INES ${inc.ines_level ?? "?"}` };
              const statusBg = inc.status === "abierto" ? "bg-red-50" : inc.status === "en_investigacion" ? "bg-orange-50" : "bg-background";
              return (
                <div key={inc.id} className={`rounded-xl border border-border shadow-sm ${statusBg}`}>
                  <button
                    onClick={() => setExpanded(expanded === inc.id ? null : inc.id)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {inc.ines_level && <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${inesCfg.bg}`}>{inesCfg.label}</span>}
                      <span className="font-semibold text-foreground truncate">{inc.event}</span>
                      {inc.status && <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${inc.status === "cerrado" ? "bg-green-100 text-green-700" : inc.status === "abierto" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{inc.status.replace("_", " ")}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-4">
                      <span>{fmtDate(inc.incident_date)}</span>
                      {expanded === inc.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded === inc.id && (
                    <div className="border-t border-border/50 px-5 py-4 space-y-3 text-sm bg-background/80 rounded-b-xl">
                      {inc.description && <div><div className="text-xs text-muted-foreground mb-0.5">Descripción</div><div className="text-foreground/80">{inc.description}</div></div>}
                      {inc.cause && <div><div className="text-xs text-muted-foreground mb-0.5">Causa raíz</div><div className="text-foreground/80">{inc.cause}</div></div>}
                      {inc.consequence && <div><div className="text-xs text-muted-foreground mb-0.5">Consecuencia</div><div className="text-foreground/80">{inc.consequence}</div></div>}
                      {inc.dose && <div><div className="text-xs text-muted-foreground mb-0.5">Dosis involucrada</div><div className="font-semibold text-orange-600">{inc.dose}</div></div>}
                      {inc.investigation && <div><div className="text-xs text-muted-foreground mb-0.5">Investigación</div><div className="text-foreground/80">{inc.investigation}</div></div>}
                      {inc.corrective_actions && <div><div className="text-xs text-muted-foreground mb-0.5">Acciones correctivas</div><div className="text-foreground/80">{inc.corrective_actions}</div></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-muted-foreground mb-1">Marco normativo aplicable</p>
          <p>DS N°12/2010 MINSAL — Artículo 48: notificación de incidentes radiológicos a CCHEN. Escala INES (IAEA/OCDE) — Clasificación de eventos en instalaciones nucleares y radiológicas. IAEA Safety Reports Series No. 19 — Criterios de notificación e investigación de incidentes. CCHEN ORD sobre procedimientos de investigación y reporte de accidentes radiológicos.</p>
        </div>
      </div>
    </div>
  );
}
