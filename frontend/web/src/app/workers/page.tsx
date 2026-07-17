import Link from "next/link";
import { Plus, Search } from "lucide-react";

const WORKERS = [
  { id: "w-1", name: "Javiera Muñoz", rut: "17.245.892-0", role: "Físico Médico", service: "Radioterapia", category: "A", status: "active", annualDose: 3.2 },
  { id: "w-2", name: "Marcelo Rojas", rut: "18.123.456-3", role: "Tecnólogo Médico", service: "Medicina Nuclear", category: "A", status: "active", annualDose: 4.1 },
  { id: "w-3", name: "Camila Torres", rut: "15.987.654-3", role: "Ingeniero", service: "Biomédica", category: "B", status: "active", annualDose: 0.8 },
  { id: "w-4", name: "Andrés Silva", rut: "16.456.789-3", role: "Radiofarmaceuta", service: "Medicina Nuclear", category: "A", status: "suspended", annualDose: 2.4 },
];

export default function WorkersPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-4">Trabajadores</h1>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">RUT</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Dosis 2026</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {WORKERS,�ap((w) => (
              <tr key={w.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <Link href={`/workers/${w.id}`} className="font-medium hover:text-accent">{w.name}</Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{w.rut}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{w.service}</td>
                <td className="px-3 py-2.5">
                  {w.status === "active" ? <span className="text-success">Activa</span> : <span className="text-warning">Suspendida</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{w.annualDose.toFixed(2)} mSv</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
