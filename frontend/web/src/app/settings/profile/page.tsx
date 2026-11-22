"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, FormEvent } from "react";
import { ArrowLeft, Save, Lock, Eye, EyeOff } from "lucide-react";
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
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setProfile({ name: data.name ?? "", email: data.email ?? "", role: data.role ?? "", phone: data.phone ?? "" });
      })
      .catch(() => {});
  }, []);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);

    if (newPassword !== confirmPassword) {
      setPwError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 10) {
      setPwError("La nueva contraseña debe tener al menos 10 caracteres");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(data.error || "Error al cambiar contraseña");
      } else {
        setPwSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPwSaved(false), 4000);
      }
    } catch {
      setPwError("Error de red");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[600px] p-6 space-y-6">
      <div className="mb-2 flex items-center gap-2">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold">Perfil de Usuario</h1>
      </div>

      {/* Profile data */}
      <form onSubmit={handleProfileSubmit}>
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <h2 className="text-sm font-semibold">Información personal</h2>
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

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {saved && <span className="text-xs text-success">Guardado correctamente.</span>}
            {profileError && <span className="text-xs text-danger">{profileError}</span>}
          </div>
        </div>
      </form>

      {/* Password change */}
      <form onSubmit={handlePasswordSubmit}>
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Cambiar contraseña</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Contraseña actual</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm pr-9"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm pr-9"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Mínimo 10 caracteres.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-danger">Las contraseñas no coinciden</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {pwSaving ? "Cambiando…" : "Cambiar contraseña"}
            </button>
            {pwSaved && <span className="text-xs text-success">Contraseña cambiada correctamente.</span>}
            {pwError && <span className="text-xs text-danger">{pwError}</span>}
          </div>
        </div>
      </form>
    </div>
  );
}
