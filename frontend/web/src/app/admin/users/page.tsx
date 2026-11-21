"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

type ManagedUser = {
  id: number;
  email: string;
  name: string | null;
  role: "super_admin" | "admin" | "user";
  status: string;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin") {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      } else {
        setError(data.error || "No se pudo cargar la lista de usuarios.");
      }
    } catch {
      setError("Error de conexion al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "super_admin") {
      loadUsers();
    }
  }, [user, loadUsers]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el usuario.");
        return;
      }
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("user");
      await loadUsers();
    } catch {
      setError("Error de conexion al crear el usuario.");
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (id: number, patch: Record<string, unknown>) => {
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el usuario.");
        return;
      }
      await loadUsers();
    } catch {
      setError("Error de conexion al actualizar el usuario.");
    }
  };

  const resetPassword = async (id: number) => {
    const pwd = prompt("Ingresa la nueva contrasena temporal (minimo 10 caracteres):");
    if (!pwd) return;
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo restablecer la contrasena.");
        return;
      }
      alert("Contrasena restablecida correctamente.");
    } catch {
      setError("Error de conexion al restablecer la contrasena.");
    }
  };

  const deleteUser = async (id: number, email: string) => {
    if (!confirm(`Eliminar al usuario ${email}? Esta accion no se puede deshacer.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el usuario.");
        return;
      }
      await loadUsers();
    } catch {
      setError("Error de conexion al eliminar el usuario.");
    }
  };

  if (authLoading || (user && user.role !== "super_admin")) {
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-lg font-semibold text-foreground">Administración de Usuarios</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Solo el Super Administrador puede crear, editar y eliminar usuarios. No es posible crear un segundo Super Administrador desde esta interfaz.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <form onSubmit={handleCreate} className="mb-8 grid max-w-2xl grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-sm font-medium text-foreground">Crear nuevo usuario</h2>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Correo electronico</label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Contrasena inicial</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {creating ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">MFA</th>
              <th className="px-3 py-2">Ultimo ingreso</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={7}>Cargando...</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={7}>No hay usuarios registrados.</td>
              </tr>
            )}
            {users.map((u) => {
              const isSuperAdmin = u.role === "super_admin";
              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.name || "-"}</td>
                  <td className="px-3 py-2">
                    {isSuperAdmin ? (
                      <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-foreground">
                        Super Administrador
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                      >
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isSuperAdmin ? (
                      <span className="text-xs text-muted-foreground">Activo</span>
                    ) : (
                      <select
                        value={u.status}
                        onChange={(e) => updateUser(u.id, { status: e.target.value })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                      >
                        <option value="active">Activo</option>
                        <option value="suspended">Suspendido</option>
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{u.mfa_enabled ? "Si" : "No"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Nunca"}
                  </td>
                  <td className="px-3 py-2">
                    {!isSuperAdmin && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => resetPassword(u.id)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-accent hover:text-foreground"
                        >
                          Restablecer contrasena
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUser(u.id, u.email)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-danger hover:border-danger"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
