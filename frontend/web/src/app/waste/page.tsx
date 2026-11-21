import { sql } from "@vercel/postgres";
import { Trash2, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";

export const dynamic = "force-dynamic";

interface WasteRow {
  id: number;
  waste_date: string;
  radionuclido: string;
  descripcion: string;
  cantidad_mci: string | null;
  cantidad_gbq: string | null;
  tipo_residuo: string;
  contenedor: string | null;
  estado: string;
  decaimiento_previsto: string | null;
  responsable: string | null;
}

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  almacenado: { label: "Almacenado", className: "text-warning" },
  en_decaimiento: { label: "En decaimiento", className: "text-muted-foreground" },
  eliminado: { label: "Eliminado", className: "text-success" },
  pendiente_evaluacion: { label: "Pend. evaluación", className: "text-danger" },
};

const TIPO_LABEL: Record<string, string> = {
  solido: "Sólido",
  liquido: "Líquido",
  gaseoso: "Gaseoso",
};

export default async function WastePage() {
  let wasteList: WasteRow[] = [];
  let totalCount = 0;
  let almacenadoCount = 0;
  let decaimientoCount = 0;
  let eliminadoCount = 0;

  try {
    const { rows } = await sql`
      SELECT id, waste_date::text, radionuclido, descripcion,
             cantidad_mci::text, cantidad_gbq::text,
             tipo_residuo, contenedor, estado,
             decaimiento_previsto::text, responsable
      FROM waste_records
      ORDER BY waste_date DESC
      LIMIT 100
    `;
    wasteList = rows as WasteRow[];
    totalCount = wasteList.length;
    almacenadoCount = wasteList.filter((r) => r.estado === "almacenado").length;
    decaimientoCount = wasteList.filter((r) => r.estado === "en_decaimiento").length;
    eliminadoCount = wasteList.filter((r) => r.estado === "eliminado").length;
  } catch {
    // La tabla puede no existir aún — mostrar vacío
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Gestión de Residuos Radiactivos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            DS 133/1984 · DS 3/1985 · NS-06.0
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Residuos registrados" value={totalCount} href="/waste" icon={Trash2} />
        <KPICard label="Almacenados" value={almacenadoCount} href="/waste" icon={Clock} tone="warning" />
        <KPICard label="En decaimiento" value={decaimientoCount} href="/waste" icon={AlertTriangle} tone="warning" />
        <KPICard label="Eliminados" value={eliminadoCount} href="/waste" icon={CheckCircle2} />
      </div>

      {wasteList.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No hay residuos registrados.{" "}
          <span className="block mt-1">
            Ejecuta{" "}
            <code className="font-mono text-xs">/api/init</code>{" "}
            para inicializar las tablas.
          </span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Radionúclido</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Cant. (mCi)</th>
                <th className="px-3 py-2">Contenedor</th>
                <th className="px-3 py-2">Decaimiento previsto</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {wasteList.map((w) => {
                const est = ESTADO_LABEL[w.estado] ?? { label: w.estado, className: "" };
                return (
                  <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground">{w.waste_date}</td>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{w.radionuclido}</td>
                    <td className="px-3 py-2">{w.descripcion}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {TIPO_LABEL[w.tipo_residuo] ?? w.tipo_residuo}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {w.cantidad_mci ? Number(w.cantidad_mci).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{w.contenedor ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{w.decaimiento_previsto ?? "—"}</td>
                    <td className={`px-3 py-2 font-medium ${est.className}`}>{est.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
