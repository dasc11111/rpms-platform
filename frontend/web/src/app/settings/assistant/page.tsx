"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";

interface AssistantSettingsState {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  hasApiKey: boolean;
}

const PROVIDERS = [
  { id: "mock", label: "Demostración (sin proveedor real)" },
  { id: "openai", label: "OpenAI (Proveedor A)" },
  { id: "anthropic", label: "Anthropic (Proveedor B)" },
];

export default function AssistantSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [provider, setProvider] = useState("mock");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(800);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/assistant/settings")
      .then((r) => r.json())
      .then((data: AssistantSettingsState) => {
        if (!active) return;
        setProvider(data.provider || "mock");
        setModel(data.model || "");
        setTemperature(typeof data.temperature === "number" ? data.temperature : 0.3);
        setMaxTokens(typeof data.maxTokens === "number" ? data.maxTokens : 800);
        setHasApiKey(Boolean(data.hasApiKey));
      })
      .catch(() => setError("No se pudo cargar la configuración actual."))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/assistant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey.trim() ? apiKey.trim() : undefined,
          temperature,
          maxTokens,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar la configuración.");
      setHasApiKey(Boolean(data.hasApiKey));
      setApiKey("");
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a Ajustes
      </Link>
      <h1 className="mb-1 text-lg font-semibold">Asistente Inteligente</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        Configura el proveedor de inteligencia artificial que utilizará el Asistente Inteligente. Esta
        configuración se puede cambiar en cualquier momento sin afectar la interfaz del asistente.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando configuración...
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Proveedor</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Modelo</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej: gpt-4o-mini, claude-3-5-sonnet-20241022"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              Clave API {hasApiKey && <span className="text-muted-foreground">(ya configurada)</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasApiKey ? "•••••••••••••• (dejar en blanco para no cambiarla)" : "Ingresa tu clave API"
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Temperatura</label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Límite de tokens</label>
              <input
                type="number"
                step="50"
                min={100}
                max={4000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
            </div>
          )}
          {saved && !error && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
              Configuración guardada correctamente.
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}
