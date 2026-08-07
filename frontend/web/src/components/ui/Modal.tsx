"use client";
import * as React from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className={clsx("relative z-10 w-full rounded-lg border border-border bg-surface-elevated shadow-xl transition-all", SIZE_CLASSES[size])}>
        {title ? (
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="text-base font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-border p-4">{footer}</div> : null}
      </div>
    </div>
  );
}
