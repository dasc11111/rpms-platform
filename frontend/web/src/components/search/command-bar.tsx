"use client";

import { Command } from "cmdk";
import { useEffect } from "react";
import {
  Activity,
  FileText,
  Radio,
  ShieldAlert,
  User,
  Wrench,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CommandBar universal (⌘K)
 * Ranking híbrido: BM25 (OpenSearch) + coseno (pgvector) + boost por recency.
 * Ver /docs/architecture: sección 6.2.4 - Búsqueda universal.
 */
export function CommandBar({ open, onOpenChange }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-border bg-surface-elevated shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Búsqueda universal RPMS" className="[&_[cmdk-input]]:outline-none">
          <div className="border-b border-border px-3 py-2">
            <Command.Input
              placeholder="Escriba para buscar…  (t: tipo · e: equipo · w: trabajador · v: vence antes de)"
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados. Pruebe con otro término.
            </Command.Empty>

            <Command.Group heading="Trabajadores" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
              <Item icon={<User className="h-4 w-4" />} label="Javiera Muñoz" sub="17.245.892-0 · Físico Médico · Radioterapia" />
              <Item icon={<User className="h-4 w-4" />} label="Marcelo Rojas" sub="18.123.456-3 · Tecnólogo Médico · Medicina Nuclear" />
            </Command.Group>

            <Command.Group heading="Equipos" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
              <Item icon={<Radio className="h-4 w-4" />} label="Varian TrueBeam" sub="LINAC · S/N TB-45781 · Sala 3" />
              <Item icon={<Radio className="h-4 w-4" />} label="Siemens Biograph" sub="PET/CT · S/N BV-33221 · Medicina Nuclear" />
            </Command.Group>

            <Command.Group heading="Documentos" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
              <Item icon={<FileText className="h-4 w-4" />} label="Informe dosimétrico junio 2026" sub="DT002 · Landauer · 47 trabajadores" />
              <Item icon={<FileText className="h-4 w-4" />} label="Certificado calibración Ludlum" sub="DT001 · Vence 2027-04-12" />
            </Command.Group>

            <Command.Group heading="Cumplimiento" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
              <Item icon={<ShieldAlert className="h-4 w-4" />} label="Reporte trimestral SEREMI Q3-2026" sub="Vence en 3 días" />
              <Item icon={<Wrench className="h-4 w-4" />} label="Renovación autorización OPR" sub="Vence 30/08/2026" />
              <Item icon={<Activity className="h-4 w-4" />} label="Anomalía dosimétrica Cat. A" sub="1 caso · Investigación pendiente" />
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <div className="flex gap-3">
              <span>
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↑↓</kbd> navegar
              </span>
              <span>
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↵</kbd> abrir
              </span>
              <span>
                <kbd className="rounded bg-muted px-1 py-0.5 font-mono">esc</kbd> cerrar
              </span>
            </div>
            <span className="text-[10px]">RPMS Copilot &middot; ⌥·</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function Item({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Command.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-accent-subtle">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="flex flex-col overflow-hidden">
        <span className="truncate">{label}</span>
        <span className="truncate text-[11px] text-muted-foreground">{sub}</span>
      </div>
    </Command.Item>
  );
}
