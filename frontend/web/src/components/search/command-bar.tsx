"use client";
import { Command } from "cmdk";
import { useEffect } from "react";
import { FileText, Radio, User } from "lucide-react";
interface Props { open: boolean; onOpenChange: (open: boolean) => void; }
export function CommandBar({ open, onOpenChange }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onOpenChange(!open); }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-xl rounded-lg border border-border bg-surface-elevated" onClick={(e) => e.stopPropagation()}>
        <Command label="Búsqueda universal RPMS">
          <div className="border-b border-border px-3 py-2">
            <Command.Input placeholder="Buscar trabajadores, equipos, documentos..." className="w-full bg-transparent text-sm placeholder:text-muted-foreground" autoFocus />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</Command.Empty>
            <Command.Group heading="Trabajadores">
              <Command.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm">
                <User className="h-4 w-4" /> Javiera Muñoz — Físico Médico
              </Command.Item>
              <Command.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm">
                <User className="h-4 w-4" /> Marcelo Rojas — Tecnólogo Médico
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Equipos">
              <Command.Item className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm">
                <Radio className="h-4 w-4" /> Varian TrueBeam — LINAC · Sala 3
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
