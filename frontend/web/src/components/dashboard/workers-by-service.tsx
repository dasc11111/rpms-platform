type ServiceCount = { service: string; count: number };

export function WorkersByService({ data }: { data: ServiceCount[] }) {
  if (!data.length) {
    return <p className="text-xs text-muted-foreground">No hay trabajadores activos registrados.</p>;
  }

  const maxCount = Math.max(...data.map((r) => r.count));

  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.service} className="flex items-center gap-3">
          <span className="w-48 shrink-0 truncate text-xs text-muted-foreground" title={r.service}>
            {r.service}
          </span>
          <div className="h-2 flex-1 rounded bg-border">
            <div
              className="h-2 rounded bg-accent"
              style={{ width: maxCount ? `${(r.count / maxCount) * 100}%` : "0%" }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{r.count}</span>
        </div>
      ))}
    </div>
  );
}
