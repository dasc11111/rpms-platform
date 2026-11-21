import { sql } from "@/lib/db";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Activity, AlertTriangle, CheckCircle, Package } from "lucide-react";

export const dynamic = "force-dynamic";

interface Dosimeter {
  id: number;
  serial_number: string;
  worker_rut: string | null;
  worker_name: string | null;
  dosimeter_type: string;
  status: string;
  issued_at: string | null;
  returned_at: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "En uso", cls: "text-emerald-700 bg-emerald-50" },
    returned: { label: "Devuelto", cls: "text-blue-700 bg-blue-50" },
    lost: { label: "Extraviado", cls: "text-red-700 bg-red-50" },
    damaged: { label: "Dañado", cls: "text-amber-700 bg-amber-50" },
  };
  return map[s] ?? { label: s, cls: "text-muted-foreground bg-muted" };
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    tld: "TLD",
    osl: "OSL",
    film: "Película",
    electronic: "Electrónico",
    ring: "Anillo",
    extremity: "Extremidad",
  };
  return map[t] ?? t;
}

export default async function DosimetersPage() {
  let dosimeters: Dosimeter[] = [];
  let totalActive = 0;
  let totalReturned = 0;
  let totalLostDamaged = 0;
  let totalAll = 0;

  try {
    const r = await sql`
      SELECT d.id, d.serial_number, d.worker_rut, d.dosimeter_type,
             d.status, d.issued_at::text, d.returned_at::text,
             d.period_start::text, d.period_end::text, d.notes,
             w.name as worker_name
      FROM dosimeters d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      ORDER BY d.issued_at DESC NULLS LAST
      LIMIT 200
    `;
    dosimeters = r.rows as Dosimeter[];
    totalAll = dosimeters.length;
    totalActive = dosimeters.filter((d) => d.status === "active").length;
    totalReturned = dosimeters.filter((d) => d.status === "returned").length;
    totalLostDamaged = dosimeters.filter((d) => d.status === "lost" || d.status === "damaged").length;
  } catch {
    // tabla no existe aún
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Dosímetros</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control de asignación, devolución y estado de dosímetros personales.
          DS 3/1985 MINSAL — control dosimétrico trabajadores ocupacionalmente expuestos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total" value={totalAll} href="/dosimeters" icon={Package} tone="default" />
        <KPICard label="En Uso" value={totalActive} href="/dosimeters" icon={Activity} tone={totalActive > 0 ? "info" : "default"} />
        <KPICard label="Devueltos" value={totalReturned} href="/dosimeters" icon={CheckCircle} tone="default" />
        <KPICard
          label="Extraviados/Dañados"
          value={totalLostDamaged}
          href="/dosimeters"
          icon={AlertTriangle}
          tone={totalLostDamaged > 0 ? "danger" : "default"}
        />
      </div>

      {totalLostDamaged > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>⚠ {totalLostDamaged} dosímetro(s) extraviado(s) o dañado(s).</strong>{" "}
          Notificar a CCHEN según NS-06.0 y registrar en el libro de novedades.
        </div>
      )}

      {/* Tabla */}
      {dosimeters.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay dosímetros registrados.</p>
          <p className="text-xs mt-1">Use la API POST /api/dosimeters para registrar dosímetros.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">N° Serie</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Trabajador</th>
                <th className="px-4 py-3 text-left font-medium">RUT</th>
                <th className="px-4 py-3 text-left font-medium">Emisión</th>
                <th className="px-4 py-3 text-left font-medium">Período</th>
                <th className="px-4 py-3 text-left font-medium">Devolución</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {dosimeters.map((d) => {
                const st = statusLabel(d.status);
                return (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{d.serial_number}</td>
                    <td className="px-4 py-2.5">{typeLabel(d.dosimeter_type)}</td>
                    <td className="px-4 py-2.5">{d.worker_name ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{d.worker_rut ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.issued_at ? new Date(d.issued_at).toLocaleDateString("es-CL") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {d.period_start && d.period_end
                        ? `${new Date(d.period_start).toLocaleDateString("es-CL")} – ${new Date(d.period_end).toLocaleDateString("es-CL")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.returned_at ? new Date(d.returned_at).toLocaleDateString("es-CL") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Límites de dosis */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold mb-3">Límites de Dosis — DS 3/1985 MINSAL / ICRP 103</h3>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium text-xs mb-2 text-muted-foreground uppercase tracking-wide">Categoría A (≥ 6 mSv/año)</p>
            <ul className="space-y-1">
              {[
                "Dosis efectiva: 20 mSv/año promedio 5 años (máx 50 mSv/año)",
                "Cristalino: 20 mSv/año (ICRP 103)",
                "Piel / extremidades: 500 mSv/año",
                "Mujer embarazada: 1 mSv durante embarazo",
              ].map((l) => (
                <li key={l} className="flex gap-2 text-xs">
                  <span className="text-accent">▸</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-xs mb-2 text-muted-foreground uppercase tracking-wide">Categoría B (1–6 mSv/año)</p>
            <ul className="space-y-1">
              {[
                "Dosis efectiva: 6 mSv/año",
                "Monitoreo trimestral mínimo",
                "Registro anual obligatorio",
                "Notificación a CCHEN: > 1 mSv trimestral",
              ].map((l) => (
                <li key={l} className="flex gap-2 text-xs">
                  <span className="text-accent">▸</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
