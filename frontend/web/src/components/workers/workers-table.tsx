"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, GraduationCap, Search } from "lucide-react";
import { buildAuthSummary, formatDaysRemaining, SEMAPHORE_DOT_CLASS, SEMAPHORE_TEXT_CLASS } from "@/lib/authorization";
import { composeWorkerName, workerSortKey } from "@/lib/worker-name";
import { matchesWorkerSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { WorkerEditModal } from "@/components/workers/worker-edit-modal";
import { StatusActionButton } from "@/components/workers/status-action-button";

export type WorkerRow = {
  rut: string;
  name: string;
  last_name_1: string | null;
  last_name_2: string | null;
  first_names: string | null;
  role: string | null;
  service: string | null;
  category: string | null;
  status: string;
  annual_dose: string;
  dv: string | null;
  sex: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  estamento: string | null;
  contract_type: string | null;
  unit: string | null;
  course_pr_completed: boolean;
  course_pr_date: string | null;
  authorization_number: string | null;
  authorization_issue_date: string | null;
  authorization_expiry_date: string | null;
  notes: string | null;
};

type SortField = "apellido" | "rut" | "service" | "unit" | "role" | "status" | "authorization";
type SortDir = "asc" | "desc";

const ALL = "__all__";

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

export function WorkersTable({ workers }: { workers: WorkerRow[] }) {
  const [search, setSearch] = useState("");
  const [service, setService] = useState(ALL);
  const [unit, setUnit] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [authFilter, setAuthFilter] = useState(ALL);
  const [coursePr, setCoursePr] = useState(ALL);
  const [sortField, setSortField] = useState<SortField>("apellido");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const serviceOptions = useMemo(() => uniqueSorted(workers.map((w) => w.service)), [workers]);
  const unitOptions = useMemo(() => uniqueSorted(workers.map((w) => w.unit)), [workers]);
  const roleOptions = useMemo(() => uniqueSorted(workers.map((w) => w.role)), [workers]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    const enriched = workers.map((w) => {
      const auth = buildAuthSummary(w);
      const displayName = composeWorkerName(w);
      return { w, auth, displayName };
    });

    const filtered = enriched.filter(({ w, auth, displayName }) => {
      if (!matchesWorkerSearch(search, { rut: w.rut, displayName, email: w.email, service: w.service, unit: w.unit, role: w.role })) {
        return false;
      }
      if (service !== ALL && (w.service ?? "") !== service) return false;
      if (unit !== ALL && (w.unit ?? "") !== unit) return false;
      if (role !== ALL && (w.role ?? "") !== role) return false;
      if (status !== ALL && w.status !== status) return false;
      if (authFilter !== ALL && auth.status !== authFilter) return false;
      if (coursePr === "si" && !w.course_pr_completed) return false;
      if (coursePr === "no" && w.course_pr_completed) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === "apellido") cmp = workerSortKey(a.w).localeCompare(workerSortKey(b.w), "es");
      else if (sortField === "rut") cmp = a.w.rut.localeCompare(b.w.rut, "es");
      else if (sortField === "service") cmp = (a.w.service ?? "").localeCompare(b.w.service ?? "", "es");
      else if (sortField === "unit") cmp = (a.w.unit ?? "").localeCompare(b.w.unit ?? "", "es");
      else if (sortField === "role") cmp = (a.w.role ?? "").localeCompare(b.w.role ?? "", "es");
      else if (sortField === "status") cmp = a.w.status.localeCompare(b.w.status, "es");
      else if (sortField === "authorization") cmp = (a.auth.days ?? 999999) - (b.auth.days ?? 999999);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [workers, search, service, unit, role, status, authFilter, coursePr, sortField, sortDir]);

  function SortHeader({ field, label, align }: { field: SortField; label: string; align?: "right" | "center" }) {
    const active = sortField === field;
    return (
      <th className={cn("px-3 py-2 cursor-pointer select-none hover:text-foreground", align === "right" && "text-right", align === "center" && "text-center")} onClick={() => toggleSort(field)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apellido, RUN, correo, servicio, unidad o cargo..."
            className="w-72 rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-accent"
          />
        </div>
        <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent">
          <option value={ALL}>Servicio (todos)</option>
          {serviceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent">
          <option value={ALL}>Unidad (todas)</option>
          {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent">
          <option value={ALL}>Profesión / cargo (todos)</option>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent">
          <option value={ALL}>Estado (todos)</option>
          <option value="active">Activa</option>
          <option value="suspended">Suspendida</option>
        </select>
        <select value={authFilter} onChange={(e) => setAuthFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent">
          <option value={ALL}>Autorización (todas)</option>
          <option value="vigente">Vigente</option>
          <option value="proxima_vencer">Próxima a vencer</option>
          <option value="vencida">Vencida</option>
          <option value="sin_autorizacion">Sin autorización</option>
        </select>
        <select value={coursePr} onChange={(e) => setCoursePr(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent">
          <option value={ALL}>Curso PR (todos)</option>
          <option value="si">Con curso PR</option>
          <option value="no">Sin curso PR</option>
        </select>
        <span className="text-[11px] text-muted-foreground">{rows.length} de {workers.length} trabajadores</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <SortHeader field="apellido" label="Trabajador" />
              <SortHeader field="rut" label="RUT" />
              <SortHeader field="service" label="Servicio" />
              <SortHeader field="status" label="Estado" />
              <th className="px-3 py-2 text-right">Dosis 2026</th>
              <th className="px-3 py-2 text-center">Curso PR</th>
              <SortHeader field="authorization" label="Autorización" />
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {rows.map(({ w, auth, displayName }) => (
              <tr key={w.rut} className="hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <Link href={`/workers/${encodeURIComponent(w.rut)}`} className="font-medium hover:text-accent">{displayName}</Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{w.rut}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{w.service}</td>
                <td className="px-3 py-2.5">
                  {w.status === "active" ? <span className="text-success">Activa</span> : <span className="text-warning">Suspendida</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(w.annual_dose).toFixed(2)} mSv</td>
                <td className="px-3 py-2.5 text-center">
                  {w.course_pr_completed ? (
                    <GraduationCap className="mx-auto h-4 w-4 text-success" strokeWidth={2} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", SEMAPHORE_TEXT_CLASS[auth.semaphore])}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", SEMAPHORE_DOT_CLASS[auth.semaphore])} />
                    {auth.authorization_number ? `${auth.authorization_number} · ` : ""}
                    {formatDaysRemaining(auth.days)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <WorkerEditModal worker={w} />
                    <StatusActionButton rut={w.rut} active={true} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Ningún trabajador coincide con la búsqueda o los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
