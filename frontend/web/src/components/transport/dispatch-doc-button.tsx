"use client";

import { useEffect, useState } from "react";
import { Paperclip, Upload, X, Download } from "lucide-react";

type DispatchDoc = {
  id: number;
  transport_date: string;
  file_name: string;
  version: number;
  is_current: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
};

export function DispatchDocButton({ date, actorEmail }: { date: string; actorEmail: string }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DispatchDoc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const res = await fetch(`/api/transport/dispatch-documents?date=${date}`);
    const data = await res.json().catch(() => ({}));
    setDocs(data.documents || []);
    setLoaded(true);
  }

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded]);

  async function handleUpload() {
    if (!file) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("transportDate", date);
      form.append("uploadedBy", actorEmail);
      await fetch("/api/transport/dispatch-documents", { method: "POST", body: form });
      setFile(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const current = docs.find((d) => d.is_current);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${current ? "border-success/40 text-success" : "border-border text-muted"} hover:bg-background`}
        title="Guía de despacho"
      >
        <Paperclip size={12} /> {current ? "Guía adjunta" : "Adjuntar guía"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Guía de despacho &middot; {date}</h4>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1 text-xs text-foreground"
              />
              <button
                onClick={handleUpload}
                disabled={!file || saving}
                className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                <Upload size={12} /> {saving ? "Subiendo..." : "Adjuntar"}
              </button>
            </div>

            <div className="space-y-2">
              {docs.length === 0 && <p className="text-xs text-muted">Sin documentos adjuntos para este día.</p>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                  <div>
                    <p className="text-foreground">
                      {d.file_name} {d.is_current && <span className="text-success">(vigente)</span>}
                    </p>
                    <p className="text-muted">v{d.version} &middot; {d.uploaded_by || "—"}</p>
                  </div>
                  <div className="flex gap-1">
                    <a
                      href={`/api/transport/dispatch-documents/${d.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-border px-2 py-1 text-foreground hover:bg-background"
                    >
                      Ver
                    </a>
                    <a
                      href={`/api/transport/dispatch-documents/${d.id}/download?dl=1`}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-foreground hover:bg-background"
                    >
                      <Download size={11} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
