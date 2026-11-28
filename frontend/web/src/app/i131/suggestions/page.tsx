"use client";

import { useEffect, useState } from "react";
import { Search, TrendingUp, Trash2, RefreshCw } from "lucide-react";

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";

const FIELD_LABELS: Record<string, string> = {
  radiofarmaco: "Radiofármaco",
  medico_solicitante: "Médico Nuclear",
  procedencia: "Procedencia",
  diagnostico: "Diagnóstico",
  protocolo: "Protocolo",
  equipo: "Equipo",
  motivo: "Motivo",
  tipo_examen: "Tipo de examen",
  prevision: "Previsión",
  paciente_nombre: "Nombre paciente",
  sala: "Sala",
};

const FIELDS = Object.keys(FIELD_LABELS);

interface Suggestion {
  value: string;
  usage_count: number;
  last_used_at: string;
}

export default function I131SuggestionsPage() {
  const [selectedField, setSelectedField] = useState(FIELDS[0]);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchSuggestions(field: string, query: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ field, limit: "20" });
      if (query) params.set("q", query);
      const res = await fetch(`/api/i131/suggestions?${params}`);
      const data = await res.json();
      setSuggestions(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuggestions(selectedField, q);
  }, [selectedField, q]);

  const topUsed = suggestions.filter(s => s.usage_count >= 3).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sugerencias de Autocompletado I-131</h1>
        <p className="text-sm text-muted-foreground mt-1">Valores más usados por campo — se alimentan automáticamente de cada registro creado o editado</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-background rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Sugerencias en campo actual</p>
          <p className="text-2xl font-bold text-foreground">{suggestions.length}</p>
        </div>
        <div className="bg-background rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Frecuentes (≥3 usos)</p>
          <p className="text-2xl font-bold text-purple-600">{topUsed}</p>
        </div>
        <div className="bg-background rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Campos con autocompletado</p>
          <p className="text-2xl font-bold text-foreground/80">{FIELDS.length}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-background rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted-foreground mb-1">Campo</label>
            <select value={selectedField} onChange={e => { setSelectedField(e.target.value); setQ(""); }} className={inp}>
              {FIELDS.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-muted-foreground mb-1">Buscar en sugerencias</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar…"
                className={`${inp} pl-8`} />
            </div>
          </div>
          <button onClick={() => fetchSuggestions(selectedField, q)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Field tabs quick-select */}
      <div className="flex flex-wrap gap-2">
        {FIELDS.map(f => (
          <button key={f} onClick={() => { setSelectedField(f); setQ(""); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${selectedField === f ? "bg-purple-600 text-white" : "bg-background border border-border text-muted-foreground hover:bg-muted/50"}`}>
            {FIELD_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Suggestions list */}
      <div className="bg-background rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground/80">
            {FIELD_LABELS[selectedField]} — {suggestions.length} sugerencias
          </span>
          <TrendingUp size={16} className="text-purple-500" />
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando…</div>
        ) : suggestions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {q ? `Sin resultados para "${q}"` : "Sin sugerencias para este campo aún"}
            <p className="text-xs mt-1 text-gray-300">Las sugerencias se acumulan automáticamente al crear o editar registros I-131</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {suggestions.map((s, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                  <span className="font-medium text-foreground">{s.value}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-purple-500"
                        style={{ width: `${Math.min(100, (s.usage_count / (suggestions[0]?.usage_count || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{s.usage_count} usos</span>
                  </div>
                  <span className="text-xs text-muted-foreground hidden md:block">
                    {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString("es-CL") : ""}
                  </span>
                  {s.usage_count >= 10 && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-medium">Popular</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs text-purple-700 font-semibold mb-1">¿Cómo funciona el autocompletado?</p>
        <p className="text-xs text-purple-600">
          Cada vez que se crea o edita un registro en el módulo I-131, el sistema registra los valores ingresados en la tabla <code className="bg-purple-100 px-1 rounded">i131_field_suggestions</code>.
          En el formulario de registro, al escribir en un campo soportado, aparecen sugerencias ordenadas por frecuencia de uso. Esta página permite revisar y auditar el catálogo de sugerencias.
        </p>
      </div>
    </div>
  );
}
