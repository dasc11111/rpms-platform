"use client";

import { useState, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

type LoginStep = "credentials" | "set-password" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const finishLogin = useCallback(async () => {
    await refresh();
    router.push("/");
  }, [refresh, router]);

  const attemptLogin = useCallback(
    async (pwd: string, token?: string) => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pwd, totpToken: token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "No se pudo iniciar sesion.");
          return;
        }
        if (data.needsPasswordSetup) {
          setStep("set-password");
          return;
        }
        if (data.mfaRequired) {
          setStep("mfa");
          return;
        }
        if (data.user) {
          await finishLogin();
        }
      } catch {
        setError("Error de conexion. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    },
    [email, finishLogin]
  );

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await attemptLogin(password);
  };

  const handleSetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 10) {
      setError("La contrasena debe tener al menos 10 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo establecer la contrasena.");
        setLoading(false);
        return;
      }
      await attemptLogin(newPassword);
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await attemptLogin(password, totpToken);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-lg">
        <h1 className="mb-1 text-xl font-semibold text-foreground">RPMS</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sistema de Gestion de Proteccion Radiologica
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Correo electronico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Contrasena</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        )}

        {step === "set-password" && (
          <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Primer ingreso: establece tu contrasena de Super Administrador.
            </p>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Nueva contrasena</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Confirmar contrasena</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar y continuar"}
            </button>
          </form>
        )}

        {step === "mfa" && (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingresa el codigo de verificacion de tu aplicacion de autenticacion.
            </p>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Codigo</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {loading ? "Verificando..." : "Verificar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
