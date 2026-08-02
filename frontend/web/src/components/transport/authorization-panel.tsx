"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, History, Download, X } from "lucide-react";

type AuthDoc = {
  id: number;
  number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  file_name: string | null;
  version: number;
  is_current: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
};

const LEVEL_STYLE: Record<string, string> = {
  verde: "border-success/40 bg-success/10 text-success",
  amarillo: "border-warning/40 bg-warning/10 text-warning",
  naranjo: "border-orange-500/40 bg-orange-500/10 text-orange-500",
  rojo: "border-danger/40 bg-danger/10 text-danger",
};

const LEVEL_LABEL: Record<string, string> = {
  verde: "Vigente",
  amarillo: "Por vencer (120-180 dias)",
  naranjo: "Proxima a vencer (90-120 dias)",
  rojo: "Critica / vencida",
};

function daysRemaining(expiry: string | null): number | null {
  if (!expiry) return null;
  const exp = new Date(expiry);
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

function levelFor(days: number | null): string {
  if (days === null) return "rojo";
  if (days >= 180) return "verde";
  if (days >= 120) return "amarillo";
  if (days >= 90) return "naranjo";
  return "rojo";
}

export function AuthorizationPanel({ actorEmail }: { actorEmail: string }) {
  const [current, setCurrent] = useState<AuthDoc | null>(null);
  const [history, setHistory] = useState<AuthDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [number, setNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/transport/authorization");
    const data = await res.json().catch(() => ({}));
    setCurrent(data.current || null);
    setHistory(data.history || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload() {
    if (!file) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("number", number);
      form.append("issuedDate", issuedDate);
      form.append("expiryDate", expiryDate);
      form.append("uploadedBy", actorEmail);
      await fetch("/api/transport/authorization", { method: "POST", body: form });
      setShowForm(false);
      setFile(null);
      setNumber("");
      setIssuedDate("");
      setExpiryDate("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const days = daysRemaining(current?.expiry_date ?? null);
  const level = current ? levelFor(days) : "rojo";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText size={16} /> Autorización de Transporte
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
          >
            <History size={12} /> Historial
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
          >
            <Upload size={12} /> {current ? "Reemplazar" : "Cargar"}
          </button>
        </div>
      </div>

      {current ? (
        <div className="space-y-1 text-sm">
          <p className="text-foreground">N° autorización: {current.number || "—"}</p>
          <p className="text-muted">Emision: {current.issued_date ? String(current.issued_date).slice(0, 10) : "—"}</p>
          <p className="text-muted">Vencimiento: {current.expiry_date ? String(current.expiry_date).slice(0, 10) : "—"}</p>
          <div className={`mt-2 inline-flex items-center gap-2 rounded border px-2 py-1 text-xs ${LEVEL_STYLE[level]}`}>
            {days !== null ? `${days} dias restantes` : "Sin fecha de vencimiento"} &middot; {LEVEL_LABEL[level]}
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href={`/api/transport/authorization/${current.id}/download`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
            >
              Vista previa
            </a>
            <a
              href={`/api/transport/authorization/${current.id}/download?dl=1`}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
            >
              <Download size={12} /> Descargar
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">No hay autorización de transporte cargada.</p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Cargar autorización de transporte</h4>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="N° de autorización"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted">Fecha emisión</label>
                  <input
                    type="date"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                    className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted">Fecha vencimiento</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded border border-border bg-background p-2 text-sm text-foreground"
                  />
                </div>
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-foreground"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded border border-border px-3 py-1.5 text-sm text-foreground">
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || saving}
                className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Subiendo..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Historial de autorizaciones</h4>
              <button onClick={() => setShowHistory(false)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                  <div>
                    <p className="text-foreground">
                      v{h.version} {h.is_current && <span className="text-success">(actual)</span>}
                    </p>
                    <p className="text-muted">
                      N° {h.number || "—"} &middot; vence {h.expiry_date ? String(h.expiry_date).slice(0, 10) : "—"}
                    </p>
                  </div>
                  <a
                    href={`/api/transport/authorization/${h.id}/download?dl=1`}
                    className="rounded border border-border px-2 py-1 text-foreground hover:bg-background"
                  >
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
