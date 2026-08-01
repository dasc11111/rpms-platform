"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export default function SecuritySettingsPage() {
  const { user, refresh } = useAuth();
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  const [timeoutInput, setTimeoutInput] = useState("30");
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null);
  const [timeoutError, setTimeoutError] = useState<string | null>(null);
  const [timeoutLoading, setTimeoutLoading] = useState(false);

  useEffect(() => {
    if (user?.role === "super_admin") {
      fetch("/api/settings/security", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.sessionTimeoutMinutes === "number") {
            setTimeoutInput(String(data.sessionTimeoutMinutes));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  async function startMfaSetup() {
    setMfaError(null);
    setMfaMessage(null);
    setMfaLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMfaError(data.error || "No se pudo iniciar la configuracion de MFA");
      } else {
        setMfaSecret(data.secret);
        setOtpauthUri(data.otpauthUri);
      }
    } catch {
      setMfaError("Error de red");
    } finally {
      setMfaLoading(false);
    }
  }

  async function verifyMfa() {
    setMfaError(null);
    setMfaMessage(null);
    setMfaLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMfaError(data.error || "Codigo invalido");
      } else {
        setMfaMessage("MFA activado correctamente.");
        setMfaSecret(null);
        setOtpauthUri(null);
        setTotpCode("");
        await refresh();
      }
    } catch {
      setMfaError("Error de red");
    } finally {
      setMfaLoading(false);
    }
  }

  async function disableMfa() {
    setMfaError(null);
    setMfaMessage(null);
    setMfaLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMfaError(data.error || "Codigo invalido");
      } else {
        setMfaMessage("MFA desactivado.");
        setTotpCode("");
        await refresh();
      }
    } catch {
      setMfaError("Error de red");
    } finally {
      setMfaLoading(false);
    }
  }

  async function saveTimeout() {
    setTimeoutError(null);
    setTimeoutMessage(null);
    setTimeoutLoading(true);
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionTimeoutMinutes: parseInt(timeoutInput, 10) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTimeoutError(data.error || "No se pudo guardar");
      } else {
        setTimeoutMessage("Guardado correctamente.");
      }
    } catch {
      setTimeoutError("Error de red");
    } finally {
      setTimeoutLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[800px] p-6">
      <h1 className="text-lg font-semibold mb-1">Seguridad y permisos</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Autenticacion multifactor y control de sesion.
      </p>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Autenticacion de dos factores (MFA)</h2>
        {user?.mfa_enabled ? (
          <div>
            <p className="mb-3 text-xs text-success">MFA esta activo en tu cuenta.</p>
            <label className="mb-1 block text-xs text-muted-foreground">Codigo de verificacion</label>
            <input
              className="mb-2 w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="123456"
            />
            <div>
              <button
                onClick={disableMfa}
                disabled={mfaLoading || totpCode.length === 0}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Desactivar MFA
              </button>
            </div>
          </div>
        ) : mfaSecret ? (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Escanea este codigo en tu aplicacion de autenticacion o ingresalo manualmente:
            </p>
            <p className="mb-2 break-all rounded-md bg-background p-2 font-mono text-xs">{mfaSecret}</p>
            <p className="mb-3 break-all text-[11px] text-muted-foreground">{otpauthUri}</p>
            <label className="mb-1 block text-xs text-muted-foreground">Codigo de 6 digitos</label>
            <input
              className="mb-2 w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="123456"
            />
            <div>
              <button
                onClick={verifyMfa}
                disabled={mfaLoading || totpCode.length === 0}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
              >
                Verificar y activar
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-muted-foreground">MFA no esta activo en tu cuenta.</p>
            <button
              onClick={startMfaSetup}
              disabled={mfaLoading}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
            >
              Activar MFA
            </button>
          </div>
        )}
        {mfaError && <p className="mt-2 text-xs text-danger">{mfaError}</p>}
        {mfaMessage && <p className="mt-2 text-xs text-success">{mfaMessage}</p>}
      </div>

      {user?.role === "super_admin" && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Duracion de sesion</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Minutos de inactividad antes de cerrar sesion automaticamente (1 a 1440).
          </p>
          <input
            type="number"
            min={1}
            max={1440}
            className="mb-2 w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
            value={timeoutInput}
            onChange={(e) => setTimeoutInput(e.target.value)}
          />
          <div>
            <button
              onClick={saveTimeout}
              disabled={timeoutLoading}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          {timeoutError && <p className="mt-2 text-xs text-danger">{timeoutError}</p>}
          {timeoutMessage && <p className="mt-2 text-xs text-success">{timeoutMessage}</p>}
        </div>
      )}
    </div>
  );
}
