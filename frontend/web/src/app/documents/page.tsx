import { FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

const DOCUMENTS = [
  { id: "doc-1", name: "Reglamento de Protección Radiológica", category: "Normativa interna", version: "v3.2", expires: "2027-01-15", status: "valid" },
  { id: "doc-2", name: "Licencia de operación LINAC Sala 3", category: "Licencia SSS", version: "v1.0", expires: "2026-08-01", status: "expiring" },
  { id: "doc-3", name: "Plan de emergencia radiológica", category: "Plan de emergencia", version: "v2.1", expires: "2026-12-01", status: "valid" },
  { id: "doc-4", name: "Certificado de calibración cámara de ionización", category: "Certificado", version: "v1.0", expires: "2026-07-30", status: "expiring" },
  { id: "doc-5", name: "Autorización individual - Andrés Silva", category: "Autorización personal", version: "v1.0", expires: "2026-05-10", status: "expired" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  valid: { label: "Vigente", className: "text-success" },
  expiring: { label: "Por vencer", className: "text-warning" },
  expired: { label: "Vencido", className: "text-danger" },
};

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Documentos</h1>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <KPICard label="Documentos vigentes" value={86} href="/documents" icon={FileText} />
        <KPICard label="Por vencer (90 días)" value={9} href="/documents" icon={AlertTriangle} tone="warning" />
        <KPICard label="Vencidos" value={1} href="/documents" icon={CheckCircle2} tone="danger" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Versión</th>
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {DOCUMENTS.map((d) => (
              <tr key={d.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{d.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.category}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.version}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.expires}</td>
                <td className={`px-3 py-2.5 ${STATUS_LABEL[d.status].className}`}>{STATUS_LABEL[d.status].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
