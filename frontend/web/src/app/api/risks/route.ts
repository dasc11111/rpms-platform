import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS radiological_risks (
      id                SERIAL PRIMARY KEY,
      risk_code         VARCHAR(30) UNIQUE NOT NULL,
      title             TEXT NOT NULL,
      risk_category     VARCHAR(50) NOT NULL DEFAULT 'occupational',
      area              VARCHAR(120),
      process           TEXT,
      hazard            TEXT,
      potential_harm    TEXT,
      exposed_workers   VARCHAR(200),
      probability       INT NOT NULL DEFAULT 2 CHECK (probability BETWEEN 1 AND 5),
      consequence       INT NOT NULL DEFAULT 2 CHECK (consequence BETWEEN 1 AND 5),
      risk_score        INT GENERATED ALWAYS AS (probability * consequence) STORED,
      risk_level        VARCHAR(20) NOT NULL DEFAULT 'medium',
      existing_controls TEXT,
      additional_controls TEXT,
      residual_probability INT DEFAULT 2 CHECK (residual_probability BETWEEN 1 AND 5),
      residual_consequence INT DEFAULT 2 CHECK (residual_consequence BETWEEN 1 AND 5),
      residual_score    INT GENERATED ALWAYS AS (residual_probability * residual_consequence) STORED,
      residual_level    VARCHAR(20),
      responsible       VARCHAR(120),
      review_date       DATE,
      status            VARCHAR(30) NOT NULL DEFAULT 'active',
      alara_measures    TEXT,
      regulatory_ref    TEXT,
      observations      TEXT,
      active            BOOLEAN NOT NULL DEFAULT TRUE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const { rows:[{cnt}] } = await sql`SELECT COUNT(*)::int AS cnt FROM radiological_risks`;
  if (cnt > 0) return;

  const risks = [
    {
      code:"RR-001", title:"Exposición a radiación gamma durante administración I-131 terapéutico",
      cat:"occupational", area:"Sala de administración I-131", proc:"Administración de I-131 terapéutico",
      hazard:"Emisión gamma 364 keV de I-131 durante manipulación y administración",
      harm:"Irradiación de manos y cuerpo del TM/médico", workers:"TM Medicina Nuclear, Médico Nuclear",
      prob:3, cons:3, level:"high",
      controls:"Uso de blindaje plomado, jeringa blindada, minimizar tiempo de manipulación, maximizar distancia",
      additional:"Monitoreo de dosis en tiempo real, rotación del personal",
      r_prob:2, r_cons:2, r_level:"low",
      alara:"Protocolo ALARA: blindaje + tiempo + distancia; objetivo dosis < 0.5 mSv/administración",
      ref:"NS-06.0 §3.1; IAEA SSG-46"
    },
    {
      code:"RR-002", title:"Contaminación superficial con Tc-99m en radiofarmacia",
      cat:"occupational", area:"Radiofarmacia", proc:"Preparación y marcación de radiofármacos Tc-99m",
      hazard:"Derrame o aerosol de solución con Tc-99m durante fraccionamiento",
      harm:"Contaminación cutánea y posible ingestión de radionucleido", workers:"TM Radiofarmacia",
      prob:3, cons:2, level:"medium",
      controls:"Campana de cabina con vidrio plomado, EPP completo, monitorización de área post-procedimiento",
      additional:"Protocolo de descontaminación inmediata, formación continua",
      r_prob:2, r_cons:1, r_level:"low",
      alara:"Preparación en volúmenes mínimos necesarios; verificación de integridad de envases",
      ref:"NS-06.0 §3.1.3; IAEA SSG-62"
    },
    {
      code:"RR-003", title:"Irradiación de miembros del público en sala de espera PET/CT",
      cat:"public", area:"Sala de espera PET/CT", proc:"Espera post-inyección FDG",
      hazard:"Emisión de positrones y radiación aniquilación 511 keV de pacientes post-inyección FDG",
      harm:"Dosis a acompañantes y público general", workers:"Público general, acompañantes",
      prob:4, cons:2, level:"high",
      controls:"Sala de espera aislada, distancia mínima controlada, límite de tiempo de visita",
      additional:"Señalización de zona controlada, restricción de acceso",
      r_prob:2, r_cons:2, r_level:"low",
      alara:"Sala de espera exclusiva post-inyección; objetivo < 1 mSv/año para acompañantes",
      ref:"NS-06.0 §3.2; IAEA SSG-46 §4"
    },
    {
      code:"RR-004", title:"Fuga de fuente sellada de Ge-68 en PET/CT",
      cat:"accidental", area:"PET/CT", proc:"Calibración y control de calidad PET",
      hazard:"Falla de integridad de fuente de calibración Ge-68 (68 µCi)",
      harm:"Contaminación del equipo y personal, irradiación interna por inhalación",
      workers:"TM PET/CT, Físico Médico, Servicio técnico",
      prob:1, cons:5, level:"medium",
      controls:"Verificación periódica de integridad, prueba de fuga bianual, almacenamiento en blindaje",
      additional:"Protocolo de emergencia por fuga de fuente sellada",
      r_prob:1, r_cons:4, r_level:"medium",
      alara:"Prueba de fuga cada 6 meses; reemplazar fuente según vida útil declarada",
      ref:"NS-06.0 §3.4; IAEA SSS No.14"
    },
    {
      code:"RR-005", title:"Exposición crónica de POE por acumulación de dosis efectiva anual",
      cat:"occupational", area:"Todo el Servicio MN", proc:"Trabajo rutinario con material radiactivo",
      hazard:"Exposición continuada a radiaciones ionizantes durante jornada laboral",
      harm:"Efectos estocásticos por exposición crónica acumulada", workers:"Todos los POE del Servicio MN",
      prob:2, cons:3, level:"medium",
      controls:"Dosimetría personal TLD mensual, revisión trimestral de dosis, límites CCHEN 20 mSv/año",
      additional:"Alerta temprana al 60% del límite anual, restricción temporal si supera 15 mSv",
      r_prob:2, r_cons:2, r_level:"low",
      alara:"Objetivo institucional < 5 mSv/año promedio del equipo; ALARA proactivo",
      ref:"NS-06.0 §3.2; DS 3/1985 Art. 15"
    },
    {
      code:"RR-006", title:"Accidente de transporte de residuos radiactivos al almacén",
      cat:"accidental", area:"Vías de tránsito hospital", proc:"Transporte interno de residuos",
      hazard:"Caída o derrame de contenedor de residuos en tránsito",
      harm:"Contaminación de zonas no controladas y exposición de no POE",
      workers:"TM PR, personal de limpieza, pacientes",
      prob:2, cons:4, level:"high",
      controls:"Contenedores certificados, rutas y horarios definidos, carro de transporte con blindaje",
      additional:"Señalización de ruta, acompañamiento de TM PR, comunicación previa a áreas de tránsito",
      r_prob:1, r_cons:3, r_level:"medium",
      alara:"Rutas cortas y directas; horarios de bajo tráfico; kit de descontaminación disponible",
      ref:"NS-06.0 §3.5; IAEA SSR-6 Vol.I"
    },
  ];

  for (const r of risks) {
    await sql`
      INSERT INTO radiological_risks
        (risk_code, title, risk_category, area, process, hazard, potential_harm, exposed_workers,
         probability, consequence, risk_level, existing_controls, additional_controls,
         residual_probability, residual_consequence, residual_level,
         responsible, alara_measures, regulatory_ref)
      VALUES
        (${r.code}, ${r.title}, ${r.cat}, ${r.area}, ${r.proc}, ${r.hazard}, ${r.harm}, ${r.workers},
         ${r.prob}, ${r.cons}, ${r.level}, ${r.controls}, ${r.additional},
         ${r.r_prob}, ${r.r_cons}, ${r.r_level},
         'TM Jefe PR', ${r.alara}, ${r.ref})
      ON CONFLICT (risk_code) DO NOTHING
    `;
  }
}

export async function GET(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const cat   = sp.get("cat") ?? "";
    const level = sp.get("level") ?? "";

    const { rows } = await sql`
      SELECT * FROM radiological_risks
      WHERE active = TRUE
        AND (${cat}   = '' OR risk_category = ${cat})
        AND (${level} = '' OR risk_level     = ${level})
      ORDER BY risk_score DESC, risk_code
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*)                                                   ::int AS total,
        COUNT(*) FILTER (WHERE risk_level = 'critical')            ::int AS critical,
        COUNT(*) FILTER (WHERE risk_level = 'high')                ::int AS high,
        COUNT(*) FILTER (WHERE risk_level = 'medium')              ::int AS medium,
        COUNT(*) FILTER (WHERE risk_level = 'low')                 ::int AS low,
        COUNT(*) FILTER (WHERE risk_category = 'occupational')     ::int AS occupational,
        COUNT(*) FILTER (WHERE risk_category = 'public')           ::int AS public_risk,
        COUNT(*) FILTER (WHERE risk_category = 'accidental')       ::int AS accidental,
        ROUND(AVG(risk_score),1)::numeric                                AS avg_score,
        ROUND(AVG(residual_score),1)::numeric                            AS avg_residual
      FROM radiological_risks WHERE active = TRUE
    `;

    return NextResponse.json({ rows, stats: stats[0] });
  }, NextResponse.json({ rows:[], stats:{} }, { status:500 }));
}

async function nextCode() {
  const { rows:[{cnt}] } = await sql`SELECT COUNT(*)::int AS cnt FROM radiological_risks`;
  return `RR-${String(cnt+1).padStart(3,"0")}`;
}

export async function POST(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const b = await req.json();
    const code = b.risk_code ?? await nextCode();
    const { rows:[row] } = await sql`
      INSERT INTO radiological_risks
        (risk_code, title, risk_category, area, process, hazard, potential_harm, exposed_workers,
         probability, consequence, risk_level, existing_controls, additional_controls,
         residual_probability, residual_consequence, residual_level,
         responsible, review_date, alara_measures, regulatory_ref, observations)
      VALUES
        (${code}, ${b.title}, ${b.risk_category??'occupational'}, ${b.area??null},
         ${b.process??null}, ${b.hazard??null}, ${b.potential_harm??null}, ${b.exposed_workers??null},
         ${b.probability??2}, ${b.consequence??2}, ${b.risk_level??'medium'},
         ${b.existing_controls??null}, ${b.additional_controls??null},
         ${b.residual_probability??null}, ${b.residual_consequence??null}, ${b.residual_level??null},
         ${b.responsible??null}, ${b.review_date??null}, ${b.alara_measures??null},
         ${b.regulatory_ref??null}, ${b.observations??null})
      RETURNING *
    `;
    return NextResponse.json(row, { status:201 });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}

export async function PATCH(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const b = await req.json();
    const { id, ...rest } = b;
    const fields = Object.keys(rest).filter(k=>!["risk_score","residual_score"].includes(k));
    if (!fields.length) return NextResponse.json({ error:"no fields" }, { status:400 });
    const setClauses = fields.map((f,i) => `"${f}" = $${i+2}`).join(", ");
    const vals = fields.map(f => (rest as Record<string,unknown>)[f]);
    const { rows:[row] } = await sql.unsafe(
      `UPDATE radiological_risks SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...vals]
    );
    return NextResponse.json(row);
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}

export async function DELETE(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const { id } = await req.json();
    await sql`UPDATE radiological_risks SET active = FALSE WHERE id = ${id}`;
    return NextResponse.json({ ok:true });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}
