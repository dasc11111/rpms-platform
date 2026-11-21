import { sql } from "@/lib/db";
import type { ComponentType } from "react";
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Crown,
  Eye,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface UserRow {
  id: number;
  rut: string;
  full_name: string;
  email: string | null;
  role: string;
  department: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  opr: "OPR",
  medico_nuclear: "Médico Nuclear",
  tm: "Tecnólogo Médico",
  admin: "Administrador",
  readonly: "Solo Lectura",
};

const ROLE_PERMISSIONS: Record<string, { label: string; allowed: string[] }> = {
  opr: {
    label: "Oficial de Protección Radiológica",
    allowed: [
      "Lectura y escritura completa",
      "Aprobar expedientes y documentos",
      "Gestionar autorizaciones y fuentes",
      "Registrar incidentes y acciones correctivas",
      "Generar informes regulatorios (CCHEN, MINSAL)",
      "Administrar usuarios del sistema",
      "Configurar alertas y umbrales",
    ],
  },
  medico_nuclear: {
    label: "Médico Nuclear Especialista",
    allowed: [
      "Lectura de todos los módulos",
      "Crear y editar expedientes de pacientes",
      "Aprobar protocolos clínicos",
      "Consultar dosimetría y fuentes",
      "Ver informes y cumplimiento",
    ],
  },
  tm: {
    label: "Tecnólogo Médico",
    allowed: [
      "Lectura de módulos asignados",
      "Registrar CC MN y estudios",
      "Gestionar radiofármacos (carga/administración)",
      "Registrar contaminación superficial",
      "Ver dosimetría personal",
    ],
  },
  admin: {
    label: "Administrador de Sistema",
    allowed: [
      "Gestión completa de usuarios",
      "Configuración del sistema",
      "Acceso a logs y auditoría",
      "Backups y restauración",
    ],
  },
  readonly: {
    label: "Solo Lectura",
    allowed: ["Ver dashboard y estadísticas", "Consultar informes públicos"],
  },
};

function roleTone(role: string): "success" | "info" | "default" | "warning" | "danger" {
  if (role === "opr") return "danger";
  if (role === "medico_nuclear") return "info";
  if (role === "tm") return "success";
  if (role === "admin") return "warning";
  return "default";
}

export default async function UsersPage() {
  let users: UserRow[] = [];

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS system_users (
        id SERIAL PRIMARY KEY,
        rut VARCHAR(12) UNIQUE NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE,
        role VARCHAR(50) NOT NULL DEFAULT 'readonly',
        department VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM system_users`;
    if ((cnt[0] as { n: number }).n === 0) {
      await sql`
        INSERT INTO system_users (rut, full_name, email, role, department)
        VALUES
          ('16397583-1', 'Diego Armando Solís Catalán', 'diego.solis@hospital.cl', 'opr', 'Prevención de Riesgos'),
          ('12345678-9', 'María González López', 'maria.gonzalez@hospital.cl', 'medico_nuclear', 'Medicina Nuclear'),
          ('98765432-1', 'Carlos Muñoz Pérez', 'carlos.munoz@hospital.cl', 'tm', 'Medicina Nuclear'),
          ('11111111-1', 'Ana Torres Vidal', 'ana.torres@hospital.cl', 'readonly', 'Administración')
      `;
    }

    const { rows } = await sql`
      SELECT id, rut, full_name, email, role, department, is_active,
             last_login::text, created_at::text
      FROM system_users ORDER BY role ASC, full_name ASC
    `;
    users = rows as UserRow[];
  } catch {
    // tabla no creada aún
  }

  const total = users.length;
  const activos = users.filter((u) => u.is_active).length;
  const inactivos = total - activos;
  const oprCount = users.filter((u) => u.role === "opr").length;

  const roleGroups: Record<string, UserRow[]> = {};
  for (const u of users) {
    if (!roleGroups[u.role]) roleGroups[u.role] = [];
    roleGroups[u.role]!.push(u);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios y Control de Acceso</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestión de roles del sistema — NS-06.0 §4, DS 133/1984 Art. 15 · RBAC por función
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total usuarios"
          value={total}
          icon={Users as ComponentType<{ className?: string }>}
          href="/users"
          tone="default"
        />
        <KPICard
          label="Activos"
          value={activos}
          icon={UserCheck as ComponentType<{ className?: string }>}
          href="/users"
          tone="success"
        />
        <KPICard
          label="Inactivos"
          value={inactivos}
          icon={UserX as ComponentType<{ className?: string }>}
          href="/users"
          tone={inactivos > 0 ? "warning" : "default"}
        />
        <KPICard
          label="OPR designados"
          value={oprCount}
          icon={Crown as ComponentType<{ className?: string }>}
          href="/users"
          tone={oprCount === 0 ? "danger" : "info"}
          hint="NS-06.0 §4"
        />
      </div>

      {/* Alerta sin OPR */}
      {oprCount === 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>⚠ Sin OPR designado:</strong> NS-06.0 §4 exige al menos un Oficial de Protección Radiológica autorizado por CCHEN. Asigne un usuario con rol OPR.
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Usuarios del Sistema</h2>
          <span className="text-xs text-muted-foreground">Autenticación: próximamente</span>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay usuarios registrados. Visite <code>/api/users</code> para inicializar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">RUT</th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Departamento</th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.rut}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "opr" ? "bg-red-100 text-red-800" :
                        u.role === "medico_nuclear" ? "bg-blue-100 text-blue-800" :
                        u.role === "tm" ? "bg-emerald-100 text-emerald-800" :
                        u.role === "admin" ? "bg-amber-100 text-amber-800" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.department ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Matriz de permisos por rol */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">Matriz de Permisos por Rol</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(ROLE_PERMISSIONS).map(([role, info]) => (
            <div key={role} className={`rounded-lg border p-4 ${
              role === "opr" ? "border-red-200 bg-red-50/40" :
              role === "medico_nuclear" ? "border-blue-200 bg-blue-50/40" :
              role === "tm" ? "border-emerald-200 bg-emerald-50/40" :
              role === "admin" ? "border-amber-200 bg-amber-50/40" :
              "border-border bg-muted/20"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {role === "readonly"
                  ? <Eye className="h-4 w-4 text-muted-foreground" />
                  : <ShieldCheck className={`h-4 w-4 ${
                      role === "opr" ? "text-red-600" :
                      role === "medico_nuclear" ? "text-blue-600" :
                      role === "tm" ? "text-emerald-600" :
                      "text-amber-600"
                    }`} />
                }
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">
                    {ROLE_LABELS[role] ?? role}
                  </p>
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                </div>
              </div>
              <ul className="space-y-1">
                {info.allowed.map((perm) => (
                  <li key={perm} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-emerald-600 shrink-0">✓</span>
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Referencia regulatoria */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Marco regulatorio:</strong>{" "}
        NS-06.0 CCHEN §4 — Requisito de OPR autorizado · DS 133/1984 Art. 15 — Responsabilidad del titular de la instalación ·
        DS 3/1985 MINSAL — Protección radiológica del personal · ISO 27001 — Control de acceso a información sensible
      </div>
    </div>
  );
}
