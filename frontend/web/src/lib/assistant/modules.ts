export const MODULE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/workers": "Trabajadores",
  "/dosimetry": "Dosimetría",
  "/i131": "Administración I-131",
  "/contamination": "Registro de Contaminación",
  "/room-release": "Liberación de Sala",
  "/equipment": "Equipos",
  "/documents": "Documentos",
  "/incidents": "Incidentes",
  "/compliance": "Cumplimiento",
  "/reports": "Reportes",
  "/instruments": "Instrumentos",
  "/settings": "Ajustes",
};

export function getModuleRoot(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  return "/" + segments[0];
}

export function getModuleLabel(pathname: string | null | undefined): string {
  const root = getModuleRoot(pathname);
  return MODULE_LABELS[root] ?? "Plataforma RPMS";
}
