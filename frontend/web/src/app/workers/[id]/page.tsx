import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn, formatMSv } from "@/lib/utils";

const MOCK = { id: "w-1", fullName: "Javiera Muñoz", nationalId: "17.245.892-0", role: "Físico Médico", service: "Radioterapia", category: "A", status: "active", annualDose: 3.2, fiveYearDose: 18.4, monthlyDoses: [0.22, 0.28, 0.24, 0.30, 0.26, 0.31, 0.29, 0.24, 0.27, 0.34, 0.28, 0.29] };

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return notFound();
  const w = MOCK;
  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <Link href="/workers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" />Trabajadores
      </Link>
      <h1 className="text-xl font-semibold mb-1">{w.fullName}</h1>
      <p className="text-xs text-muted-foreground mb-4">{w.role} ₷ {w.service} · Categoría {w.category} (ICRP)</p>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold mb-3">Dosis Hp(10) últimos 12 meses</h2>
        <p className="text-xs text-muted-foreground mb-2">Anual: {formatMSv(w.annualDose)} ₷ 5-anual: {formatMSv(w.fiveYearDose)}</p>
        <div className="flex h-16 items-end gap-1">
          {w.monthlyDoses.map((v, i) => {
            const max = Math.max(...w.monthlyDoses);
            const h = (v / max) * 80 + 20;
            return <div key={i} className="flex-1 rounded-t bg-accent-subtle hover:bg-accent" style={{ height: `${h}%` }} title={`${v.toFixed(2)} mSv`} />;
          })}
        </div>
      </div>
    </div>
  );
}
