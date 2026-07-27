import { sql } from "@/lib/db";
import { DOSIMETER_TYPE_LABELS } from "@/lib/dosimeters";
import { DosimetersSubnav } from "@/components/dosimeters/dosimeters-subnav";
import { formatMSv } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Bar({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{hint ?? value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

type Bucket = { label: string; min: number; max: number; n: number };

function bucketDose(values: number[]): Bucket[] {
  const buckets: Bucket[] = [
    { label: "< 0,1 mSv", min: -Infinity, max: 0.1, n: 0 },
    { label: "0,1 - 0,5 mSv", min: 0.1, max: 0.5, n: 0 },
    { label: "0,5 - 1,6 mSv", min: 0.5, max: 1.6, n: 0 },
    { label: "1,6 - 5 mSv", min: 1.6, max: 5, n: 0 },
    { label: ">= 5 mSv", min: 5, max: Infinity, n: 0 },
  ];
  const fallback = buckets[buckets.length - 1] as Bucket;
  for (const v of values) {
    const found = buckets.find((b) => v >= b.min && v < b.max);
    const b: Bucket = found ?? fallback;
    b.n++;
  }
  return buckets;
}

export default async function DosimetersStatsPage() {
  let avgByService: { label: string; avg_dose: number; n: number }[] = [];
  let avgByUnit: { label: string; avg_dose: number; n: number }[] = [];
  let doseValues: { dose_body: number; dose_lens: number; dose_skin: number }[] = [];
  let byYear: { year: number; avg_dose: number; total_dose: number; n: number }[] = [];
  let byQuarter: { year: number; quarter: number; period_label: string; avg_dose: number }[] = [];
  let top20Annual: { worker_rut: string; worker_name: string; accum_year_body: number }[] = [];
  let top20Accum60m: { worker_rut: string; worker_name: string; accum_60m_body: number }[] = [];
  let monitoredByService: { label: string; n: number }[] = [];
  let institutionalEvolution: { year: number; quarter: number; period_label: string; total_dose: number }[] = [];
  let dosimeterTypeDist: { type: string; n: number }[] = [];

  try {
    const { rows } = await sql`
      SELECT COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio') as label, AVG(q.dose_body)::float as avg_dose, COUNT(*)::int as n
      FROM dosimetry_quarterly q JOIN workers w ON w.rut = q.worker_rut
      GROUP BY 1 ORDER BY avg_dose DESC
    `;
    avgByService = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`
      SELECT COALESCE(NULLIF(TRIM(w.unit), ''), 'Sin unidad') as label, AVG(q.dose_body)::float as avg_dose, COUNT(*)::int as n
      FROM dosimetry_quarterly q JOIN workers w ON w.rut = q.worker_rut
      GROUP BY 1 ORDER BY avg_dose DESC
    `;
    avgByUnit = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`SELECT dose_body, dose_lens, dose_skin FROM dosimetry_quarterly`;
    doseValues = (rows as any[]).map((r) => ({
      dose_body: Number(r.dose_body) || 0,
      dose_lens: Number(r.dose_lens) || 0,
      dose_skin: Number(r.dose_skin) || 0,
    }));
  } catch {}

  try {
    const { rows } = await sql`
      SELECT year, AVG(dose_body)::float as avg_dose, SUM(dose_body)::float as total_dose, COUNT(*)::int as n
      FROM dosimetry_quarterly GROUP BY year ORDER BY year
    `;
    byYear = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`
      SELECT year, quarter, period_label, AVG(dose_body)::float as avg_dose
      FROM dosimetry_quarterly GROUP BY year, quarter, period_label ORDER BY year, quarter
    `;
    byQuarter = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`
      WITH maxyear AS (SELECT MAX(year) as y FROM dosimetry_quarterly),
      latest_year_rows AS (
        SELECT DISTINCT ON (q.worker_rut) q.worker_rut, q.worker_name, q.accum_year_body
        FROM dosimetry_quarterly q, maxyear
        WHERE q.year = maxyear.y
        ORDER BY q.worker_rut, q.quarter DESC
      )
      SELECT worker_rut, worker_name, accum_year_body::float as accum_year_body FROM latest_year_rows ORDER BY accum_year_body DESC LIMIT 20
    `;
    top20Annual = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`
      WITH latest_overall AS (
        SELECT DISTINCT ON (worker_rut) worker_rut, worker_name, accum_60m_body
        FROM dosimetry_quarterly
        ORDER BY worker_rut, year DESC, quarter DESC
      )
      SELECT worker_rut, worker_name, accum_60m_body::float as accum_60m_body FROM latest_overall ORDER BY accum_60m_body DESC LIMIT 20
    `;
    top20Accum60m = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`
      SELECT COALESCE(NULLIF(TRIM(w.service), ''), 'Sin servicio') as label, COUNT(DISTINCT q.worker_rut)::int as n
      FROM dosimetry_quarterly q JOIN workers w ON w.rut = q.worker_rut
      GROUP BY 1 ORDER BY n DESC
    `;
    monitoredByService = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`
      SELECT year, quarter, period_label, SUM(dose_body)::float as total_dose
      FROM dosimetry_quarterly GROUP BY year, quarter, period_label ORDER BY year, quarter
    `;
    institutionalEvolution = rows as any[];
  } catch {}

  try {
    const { rows } = await sql`SELECT type, COUNT(*)::int as n FROM dosimeters GROUP BY type ORDER BY n DESC`;
    dosimeterTypeDist = rows as any[];
  } catch {}

  const bucketsBody = bucketDose(doseValues.map((d) => d.dose_body));
  const bucketsLens = bucketDose(doseValues.map((d) => d.dose_lens));
  const bucketsSkin = bucketDose(doseValues.map((d) => d.dose_skin));

  const maxServiceAvg = Math.max(...avgByService.map((r) => Number(r.avg_dose) || 0), 0.01);
  const maxUnitAvg = Math.max(...avgByUnit.map((r) => Number(r.avg_dose) || 0), 0.01);
  const maxYearTotal = Math.max(...byYear.map((r) => Number(r.total_dose) || 0), 0.01);
  const maxQuarterAvg = Math.max(...byQuarter.map((r) => Number(r.avg_dose) || 0), 0.01);
  const maxTop20Annual = Math.max(...top20Annual.map((r) => Number(r.accum_year_body) || 0), 0.01);
  const maxTop20Accum = Math.max(...top20Accum60m.map((r) => Number(r.accum_60m_body) || 0), 0.01);
  const maxMonitored = Math.max(...monitoredByService.map((r) => r.n), 1);
  const maxInstitutional = Math.max(...institutionalEvolution.map((r) => Number(r.total_dose) || 0), 0.01);
  const maxTypeDist = Math.max(...dosimeterTypeDist.map((r) => r.n), 1);
  const maxBucket = Math.max(...bucketsBody.map((b) => b.n), ...bucketsLens.map((b) => b.n), ...bucketsSkin.map((b) => b.n), 1);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-1">Dosimetros</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Analisis estadistico institucional en base a los reportes trimestrales de dosimetria importados (Hp10 / Hp3 / Hp0,07).
      </p>

      <DosimetersSubnav active="estadisticas" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Dosis promedio por servicio (Hp10)">
          {avgByService.length > 0 ? (
            avgByService.map((r, i) => (
              <Bar key={i} label={`${r.label} (n=${r.n})`} value={Number(r.avg_dose) || 0} max={maxServiceAvg} hint={formatMSv(Number(r.avg_dose))} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>

        <Section title="Dosis promedio por unidad (Hp10)">
          {avgByUnit.length > 0 ? (
            avgByUnit.map((r, i) => (
              <Bar key={i} label={`${r.label} (n=${r.n})`} value={Number(r.avg_dose) || 0} max={maxUnitAvg} hint={formatMSv(Number(r.avg_dose))} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>

        <Section title="Distribución de Hp(10)">
          {bucketsBody.map((b, i) => (
            <Bar key={i} label={b.label} value={b.n} max={maxBucket} hint={String(b.n)} />
          ))}
        </Section>

        <Section title="Distribución de Hp(3)">
          {bucketsLens.map((b, i) => (
            <Bar key={i} label={b.label} value={b.n} max={maxBucket} hint={String(b.n)} />
          ))}
        </Section>

        <Section title="Distribución de Hp(0,07)">
          {bucketsSkin.map((b, i) => (
            <Bar key={i} label={b.label} value={b.n} max={maxBucket} hint={String(b.n)} />
          ))}
        </Section>

        <Section title="Distribución por tipo de dosímetro">
          {dosimeterTypeDist.length > 0 ? (
            dosimeterTypeDist.map((r, i) => (
              <Bar key={i} label={DOSIMETER_TYPE_LABELS[r.type as keyof typeof DOSIMETER_TYPE_LABELS] ?? r.type} value={r.n} max={maxTypeDist} hint={String(r.n)} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Sin dosímetros físicos registrados todavía.</p>
          )}
        </Section>

        <Section title="Comparación entre años (dosis total Hp10)">
          {byYear.length > 0 ? (
            byYear.map((r, i) => (
              <Bar key={i} label={`${r.year} (n=${r.n})`} value={Number(r.total_dose) || 0} max={maxYearTotal} hint={formatMSv(Number(r.total_dose))} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>

        <Section title="Comparación entre trimestres (dosis promedio Hp10)">
          {byQuarter.length > 0 ? (
            byQuarter.map((r, i) => (
              <Bar key={i} label={r.period_label} value={Number(r.avg_dose) || 0} max={maxQuarterAvg} hint={formatMSv(Number(r.avg_dose))} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>

        <Section title="Trabajadores monitorizados por servicio">
          {monitoredByService.length > 0 ? (
            monitoredByService.map((r, i) => <Bar key={i} label={r.label} value={r.n} max={maxMonitored} hint={String(r.n)} />)
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>

        <Section title="Evolución histórica de la dosis institucional (total Hp10 por trimestre)">
          {institutionalEvolution.length > 0 ? (
            <div className="flex h-24 items-end gap-1">
              {institutionalEvolution.map((r, i) => {
                const h = (Number(r.total_dose) / maxInstitutional) * 80 + 20;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-accent-subtle hover:bg-accent"
                    style={{ height: `${h}%` }}
                    title={`${r.period_label}: ${Number(r.total_dose).toFixed(2)} mSv`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={`Top 20 trabajadores con mayor dosis anual (${top20Annual[0] ? "año vigente" : "sin datos"})`}>
          {top20Annual.length > 0 ? (
            <ol className="space-y-1 text-xs">
              {top20Annual.map((r, i) => (
                <li key={i} className="flex items-center justify-between border-b border-border/60 pb-1">
                  <span>
                    <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                    {r.worker_name}
                  </span>
                  <span className="font-medium">{formatMSv(Number(r.accum_year_body))}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>

        <Section title="Top 20 trabajadores con mayor dosis acumulada en 60 meses">
          {top20Accum60m.length > 0 ? (
            <ol className="space-y-1 text-xs">
              {top20Accum60m.map((r, i) => (
                <li key={i} className="flex items-center justify-between border-b border-border/60 pb-1">
                  <span>
                    <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                    {r.worker_name}
                  </span>
                  <span className="font-medium">{formatMSv(Number(r.accum_60m_body))}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
