"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX, UserCheck, Loader2 } from "lucide-react";

export function StatusActionButton({ rut, active }: { rut: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const confirmMsg = active
      ? `¿Dar de baja a este trabajador? Sus datos se conservarán y podrás recuperarlos si vuelve a ingresar.`
      : `¿Reactivar a este trabajador? Se restaurarán sus datos previos.`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const endpoint = active ? "/api/workers/deactivate" : "/api/workers/reactivate";
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-60 ${
        active
          ? "border-border hover:border-danger hover:text-danger"
          : "border-border hover:border-success hover:text-success"
      }`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : active ? (
        <UserX className="h-3 w-3" />
      ) : (
        <UserCheck className="h-3 w-3" />
      )}
      {active ? "Dar de baja" : "Reactivar"}
    </button>
  );
}
