"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";

type DriverFicha = {
  name: string;
  company: string | null;
  totalTransports: number;
  firstTransport: string;
  lastTransport: string;
  avgPerYear: number;
  history: { id: number; transport_date: string; correlative_number: number; material_code: string; it_value: number | null }[];
};

const MATERIAL_LABELS: Record<string, string> = {
  MO_TC99: "Generador Mo-99/Tc-99m",
  I131: "I-131",
};

export default function DriverFichaPage() {
  const params = useParams();
  const name = decodeURIComponent(String(params?.name || ""));
  const [driver, setDriver] = useState<DriverFicha | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;
    fetch("/api/transport/drivers/" + encodeURIComponent(name))
      .then((r) => r.json())
      .then((data) => setDriver(data.driver || null))
      .finally(() => setLoading(false));
  }, [name]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Link href="/transport" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Volver a Transporte
      </Link>
      <div className="flex items-center gap-2">
        <Truck size={20} />
        <h1 className="text-xl font-semibold text-foreground">Ficha del transportista</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        Esta ficha es unicamente informativa y no forma parte del Dashboard General.
      </p>
      {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
      {!loading && !driver && <p className="text-sm text-muted-foreground">No se encontraron transportes para este conductor.</p>}
      {driver && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{driver.name}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Empresa</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{driver.company || "-"}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Total transportes</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{driver.totalTransports}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Promedio anual</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{driver.avgPerYear}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Primer transporte</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{String(driver.firstTransport).slice(0, 10)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Ultimo transporte</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{String(driver.lastTransport).slice(0, 10)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">Historial completo</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">N</th>
                  <th className="p-2">IT</th>
                  <th className="p-2">Material</th>
                </tr>
              </thead>
              <tbody>
                {driver.history.map((h) => (
                  <tr key={h.id} className="border-b border-border/50">
                    <td className="p-2 text-foreground">{String(h.transport_date).slice(0, 10)}</td>
                    <td className="p-2 text-foreground">{h.correlative_number}</td>
                    <td className="p-2 text-foreground">{h.it_value ?? "-"}</td>
                    <td className="p-2 text-foreground">{MATERIAL_LABELS[h.material_code] || h.material_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
