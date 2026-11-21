"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface ProfileData {
  name: string;
  email: string;
  role: string;
  phone: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({ name: "", email: "", role: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setProfile({ name: data.name ?? "", email: data.email ?? "", role: data.role ?? "", phone: data.phone ?? "" });
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[600px] p-6">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">Perfil de Usuario</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre completo</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Correo electrónico</label>
            <input
              className="w-full rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground"
              value={profile.email}
              disabled
            />
            <p className="mt-1 text-xs text-muted-foreground">El correo no puede ser modificado desde aquí.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cargo / Rol</label>
            <input
              className="w-full rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground"
              value={profile.role}
              disabled
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Teléfono de contacto</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              value={profile.phone}
              placeholder="+56 9 XXXX XXXX"
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>
        </div>

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
