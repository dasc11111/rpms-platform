import Link from "next/link";
import {
  formatDaysRemaining,
  SEMAPHORE_DOT_CLASS,
  SEMAPHORE_TEXT_CLASS,
  type WorkerAuthSummary,
} from "@/lib/authorization";
import { cn } from "@/lib/utils";

/**
 * Tabla "Autorizaciones próximas a vencer": lista trabajadores cuya
 * Autorizacion de Desempeno esta en semaforo amarillo o rojo, ordenados
 * de menor a mayor cantidad de dias restantes (el mas urgente primero).
 * Muestra el correo electronico visible para poder copiarlo y contactar
 * manualmente al trabajador; no se envia ningun correo automaticamente.
 */
export function ExpiringAuthorizationsTable({ items }: { items: WorkerAuthSummary[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No hay autorizaciones próximas a vencer ni vencidas. Todo al día.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Trabajador</th>
            <th className="px-3 py-2">Correo electrónico</th>
            <th className="px-3 py-2">N° autorización</th>
            <th className="px-3 py-2">Vencimiento</th>
            <th className="px-3 py-2 text-right">Días restantes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {items.map((it) => (
            <tr key={it.rut} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link href={`/workers/${encodeURIComponent(it.rut)}`} className="font-medium hover:text-accent">
                  {it.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{it.email || "—"}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{it.authorization_number || "—"}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{it.authorization_expiry_date || "—"}</td>
              <td className="px-3 py-2 text-right">
                <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", SEMAPHORE_TEXT_CLASS[it.semaphore])}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", SEMAPHORE_DOT_CLASS[it.semaphore])} />
                  {formatDaysRemaining(it.days)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
