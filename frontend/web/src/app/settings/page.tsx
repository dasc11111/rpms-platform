import { Bell, Building2, Shield, User } from "lucide-react";

const SECTIONS = [
  { icon: User, title: "Perfil", description: "Nombre, cargo y datos de contacto del usuario." },
  { icon: Building2, title: "Institución", description: "Datos del establecimiento, servicios y sedes registradas." },
  { icon: Bell, title: "Notificaciones", description: "Alertas de vencimientos, dosis e incidentes por correo y en la plataforma." },
  { icon: Shield, title: "Seguridad y permisos", description: "Roles, autenticación y control de acceso por servicio." },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Ajustes</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle text-accent">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <h2 className="text-sm font-semibold">{s.title}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
