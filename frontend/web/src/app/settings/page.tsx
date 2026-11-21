import { Bell, Building2, Database, Shield, User, Zap } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes del Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuración de la plataforma RPMS — Radioprotección Medicina Nuclear.
        </p>
      </div>

      {/* Institución */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Building2 className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">Institución</h2>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Establecimiento</p>
            <p className="font-medium">Hospital Dr. Hernán Henríquez Aravena</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Servicio de Salud</p>
            <p className="font-medium">Araucanía Sur</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ciudad</p>
            <p className="font-medium">Temuco, Región de La Araucanía</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Autorización CCHEN</p>
            <p className="font-medium">NS-06.0 — Vigente</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Área de aplicación</p>
            <p className="font-medium">Medicina Nuclear / Radiodiagnóstico / Radioterapia</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Versión RPMS</p>
            <p className="font-mono text-sm font-medium">2.0.0-beta</p>
          </div>
        </div>
      </div>

      {/* OPR / Administradores */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <User className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">Oficial de Protección Radiológica (OPR)</h2>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nombre</p>
            <p className="font-medium">Tecnólogo Médico — Medicina Nuclear</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Departamento</p>
            <p className="font-medium">Departamento de Prevención de Riesgos</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Autorización OPR</p>
            <p className="font-medium">CCHEN — Vigente</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Base regulatoria</p>
            <p className="font-medium">NS-06.0 §4 — DS 133/1984 Art. 15</p>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">Notificaciones y Alertas</h2>
        </div>
        <div className="space-y-3 text-sm">
          {[
            { label: "Autorizaciones por vencer (90 días)", estado: "Activo", cls: "text-emerald-700 bg-emerald-50" },
            { label: "Autorizaciones vencidas", estado: "Activo", cls: "text-emerald-700 bg-emerald-50" },
            { label: "CC MN fallidos", estado: "Activo", cls: "text-emerald-700 bg-emerald-50" },
            { label: "Fuentes con inventario vencido", estado: "Activo", cls: "text-emerald-700 bg-emerald-50" },
            { label: "Radiofármacos próximos a vencer (24h)", estado: "Activo", cls: "text-emerald-700 bg-emerald-50" },
            { label: "Incidentes INES ≥ 1 sin notificación", estado: "Activo", cls: "text-emerald-700 bg-emerald-50" },
            { label: "Notificación por correo electrónico", estado: "Próximamente", cls: "text-muted-foreground bg-muted" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${item.cls}`}>
                {item.estado}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Seguridad */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Shield className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">Seguridad y Control de Acceso</h2>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: "Autenticación", value: "Próximamente — Auth multi-rol", pending: true },
            { label: "Roles disponibles", value: "OPR · Médico Nuclear · TM · Admin · Solo lectura", pending: false },
            { label: "Acceso por servicio", value: "Próximamente — filtro por unidad/servicio", pending: true },
            { label: "Auditoría de cambios", value: "Próximamente — log de acciones", pending: true },
            { label: "Sesión actual", value: "Modo demo — sin autenticación", pending: false },
          ].map((item) => (
            <div key={item.label} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0 gap-4">
              <span className="text-muted-foreground shrink-0">{item.label}</span>
              <span className={`text-right text-xs ${item.pending ? "text-amber-600" : "font-medium"}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Base de datos / Sistema */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Database className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">Base de Datos y Sistema</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start justify-between py-2 border-b border-border/50 gap-4">
            <span className="text-muted-foreground">Proveedor</span>
            <span className="font-medium text-xs">Vercel Postgres (Neon)</span>
          </div>
          <div className="flex items-start justify-between py-2 border-b border-border/50 gap-4">
            <span className="text-muted-foreground">Framework</span>
            <span className="font-mono text-xs">Next.js 15 App Router</span>
          </div>
          <div className="flex items-start justify-between py-2 border-b border-border/50 gap-4">
            <span className="text-muted-foreground">Deploy</span>
            <span className="font-mono text-xs">Vercel (auto-deploy desde main)</span>
          </div>
          <div className="flex items-start justify-between py-2 gap-4">
            <span className="text-muted-foreground">Inicializar tablas y datos</span>
            <a href="/api/init" className="font-mono text-xs text-accent underline">GET /api/init</a>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Zap className="h-4 w-4" />
          </div>
          <h2 className="font-semibold">APIs Disponibles</h2>
        </div>
        <div className="grid gap-2 text-xs md:grid-cols-3">
          {[
            "/api/init", "/api/workers", "/api/dosimetry", "/api/dosimeters",
            "/api/i131", "/api/contamination", "/api/waste", "/api/sources",
            "/api/radiopharmacy", "/api/shielding", "/api/quality-control",
            "/api/equipment", "/api/instruments", "/api/training",
            "/api/documents", "/api/incidents", "/api/incidents/actions",
            "/api/compliance", "/api/workers/create", "/api/workers/update",
          ].map((api) => (
            <a key={api} href={api} className="font-mono text-accent hover:underline truncate">
              {api}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
