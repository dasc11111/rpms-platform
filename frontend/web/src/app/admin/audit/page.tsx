"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

type AuditLog = {
  id: number;
  created_at: string;
  actor_email: string | null;
  action: string;
  category: string | null;
  details: unknown;
  ip_address: string | null;
  success: boolean;
};

export default function AdminAuditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin") {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?limit=${limit}&offset=${offset}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || "No se pudo cargar el historial de auditoria.");
      }
    } catch {
      setError("Error de conexion al cargar la auditoria.");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    if (user?.role === "super_admin") {
      loadLogs();
    }
  }, [user, loadLogs]);

  if (authLoading || (user && user.role !== "super_admin")) {
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-lg font-semibold text-foreground">Auditoría</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Registro de todas las acciones realizadas en la plataforma. Este historial nunca puede eliminarse.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Accion</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>Cargando...</td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>No hay registros de auditoria.</td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">{log.actor_email || "-"}</td>
                <td className="px-3 py-2">{log.action}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{log.category || "-"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{log.ip_address || "-"}</td>
                <td className="px-3 py-2">
                  {log.success ? (
                    <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">Exito</span>
                  ) : (
                    <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">Fallo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-accent hover:text-foreground disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={logs.length < limit}
          onClick={() => setOffset(offset + limit)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-accent hover:text-foreground disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
