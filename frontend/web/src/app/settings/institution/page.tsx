"use client";

import { useState, useEffect, FormEvent } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface InstitutionData {
  name: string;
  rut: string;
  address: string;
  commune: string;
  region: string;
  phone: string;
  email: string;
  director: string;
  opr_name: string;
  opr_phone: string;
  cchen_code: string;
  seremi_code: string;
}

const EMPTY: InstitutionData = {
  name: "", rut: "", address: "", commune: "", region: "",
  phone: "", email: "", director: "", opr_name: "", opr_phone: "",
  cchen_code: "", seremi_code: "",
};

export default function InstitutionPage() {
  const [data, setData] = useState<InstitutionData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/institution")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData({ ...EMPTY, ...d }); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/institution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof InstitutionData, placeholder?: string) {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={data[key]}
          placeholder={placeholder}
          onChange={(e) => setData({ ...data, [key]: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[700px] p-6">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">Datos del Establecimiento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Identificación</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Nombre del establecimiento", "name", "Hospital Regional…")}
            {field("RUT institución", "rut", "XX.XXX.XXX-X")}
            {field("Dirección", "address", "Av. …")}
            {field("Comuna", "commune")}
            {field("Región", "region")}
            {field("Teléfono central", "phone", "+56 2 XXXX XXXX")}
            {field("Correo institucional", "email")}
            {field("Director médico / Director general", "director")}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Oficial de Protección Radiológica</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Nombre del OPR", "opr_name")}
            {field("Teléfono OPR", "opr_phone")}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Códigos regulatorios</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Código CCHEN", "cchen_code")}
            {field("Código SEREMI de Salud", "seremi_code")}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Estos datos aparecen en los encabezados de los informes regulatorios exportados (DS 133/1984, DS 3/1985 MINSAL).</p>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {saved && <span className="text-xs text-green-600">Guardado correctamente.</span>}
        </div>
      </form>
    </div>
  );
}
