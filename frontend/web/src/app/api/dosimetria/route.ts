import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── ensureTable ───────────────────────────────────────────────────────────────
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_trabajadores (
      id              SERIAL PRIMARY KEY,
      rut             TEXT NOT NULL,
      nombre          TEXT NOT NULL,
      departamento    TEXT NOT NULL,
      estamento       TEXT,
      estado          TEXT DEFAULT 'ACTIVO',   -- ACTIVO | INACTIVO
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_registros (
      id              SERIAL PRIMARY KEY,
      trabajador_id   INT REFERENCES dosimetria_trabajadores(id) ON DELETE CASCADE,
      rut             TEXT NOT NULL,
      nombre          TEXT NOT NULL,
      departamento    TEXT NOT NULL,
      periodo         TEXT NOT NULL,           -- e.g. "T 1-2026"
      trimestre       INT NOT NULL,            -- 1,2,3,4
      anio            INT NOT NULL,
      tipo_dosimetro  TEXT NOT NULL,           -- I1, I5, I2
      numero_dosimetro TEXT,
      proceso         TEXT,                    -- PH, PM, PL, BH, BM, BL
      fecha_proceso   DATE,
      -- cualitativos
      hp10_cual       TEXT,
      hp3_cual        TEXT,
      hp007_cual      TEXT,
      -- cuantitativos trimestre
      hp10_trim       NUMERIC(8,4),
      hp3_trim        NUMERIC(8,4),
      hp007_trim      NUMERIC(8,4),
      -- acumulados año calendario
      hp10_anio       NUMERIC(8,4),
      hp3_anio        NUMERIC(8,4),
      hp007_anio      NUMERIC(8,4),
      -- últimos 12 meses
      hp10_12m        NUMERIC(8,4),
      hp3_12m         NUMERIC(8,4),
      hp007_12m       NUMERIC(8,4),
      -- últimos 60 meses
      hp10_60m        NUMERIC(8,4),
      hp3_60m         NUMERIC(8,4),
      hp007_60m       NUMERIC(8,4),
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_devueltos_fuera_plazo (
      id              SERIAL PRIMARY KEY,
      rut             TEXT NOT NULL,
      nombre          TEXT NOT NULL,
      departamento    TEXT NOT NULL,
      periodo         TEXT NOT NULL,
      trimestre       INT,
      anio            INT,
      numero_dosimetro TEXT,
      fecha_lectura   DATE,
      alerta_dosis    BOOLEAN DEFAULT FALSE,
      observacion     TEXT,
      adjunto_url     TEXT,
      adjunto_nombre  TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_no_devueltos (
      id              SERIAL PRIMARY KEY,
      rut             TEXT NOT NULL,
      nombre          TEXT NOT NULL,
      departamento    TEXT NOT NULL,
      periodo         TEXT NOT NULL,
      trimestre       INT,
      anio            INT,
      tipo_dosimetro  TEXT,
      numero_dosimetro TEXT,
      extraviado      BOOLEAN DEFAULT FALSE,
      observacion     TEXT,
      adjunto_url     TEXT,
      adjunto_nombre  TEXT,
      fecha_registro  DATE DEFAULT CURRENT_DATE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_adjuntos (
      id              SERIAL PRIMARY KEY,
      tabla_origen    TEXT NOT NULL,           -- registros | devueltos | no_devueltos
      registro_id     INT NOT NULL,
      nombre_archivo  TEXT NOT NULL,
      tipo_archivo    TEXT,                    -- pdf | xlsx | csv
      url             TEXT NOT NULL,
      subido_por      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Check if already seeded
  const { rows } = await sql`SELECT COUNT(*) FROM dosimetria_registros`;
  if (parseInt(rows[0].count) > 0) return;

  // ─── Seed workers ─────────────────────────────────────────────────────────
  const workers = [
    { rut: "15261618-K", nombre: "CABELLO MIRANDA, CAROLA", departamento: "MEDICINA NUCLEAR", estamento: "TM", estado: "ACTIVO" },
    { rut: "14094639-7", nombre: "CURILLAN DON JUAN, SILVIA", departamento: "MEDICINA NUCLEAR", estamento: "TM", estado: "ACTIVO" },
    { rut: "16598909-0", nombre: "GUTIERREZ OTTH, DANIELA", departamento: "MEDICINA NUCLEAR", estamento: "TM", estado: "ACTIVO" },
    { rut: "13318254-3", nombre: "PALMA PALMA, LORETO ANDREA", departamento: "MEDICINA NUCLEAR", estamento: "TM", estado: "ACTIVO" },
    { rut: "16672389-2", nombre: "VERA VARGAS, VICTOR", departamento: "MEDICINA NUCLEAR", estamento: "TM", estado: "ACTIVO" },
    { rut: "13862447-1", nombre: "ARAYA CAMPOS, SUSANA", departamento: "CARDIOLOGIA", estamento: "TM", estado: "INACTIVO" },
    { rut: "14645058-K", nombre: "ESCOBAR ESCOBAR, JORGE", departamento: "CARDIOLOGIA", estamento: "MEDICO", estado: "ACTIVO" },
    { rut: "15550173-1", nombre: "HENRIQUEZ UBILLA, MARCELO", departamento: "CARDIOLOGIA", estamento: "ENF", estado: "ACTIVO" },
    { rut: "9293985-5",  nombre: "ACEITON VASQUEZ, PATRICIA", departamento: "PABELLON CENTRAL", estamento: "TENS", estado: "ACTIVO" },
    { rut: "15961689-4", nombre: "ABARZA YAÑEZ, JUAN", departamento: "PABELLON CENTRAL", estamento: "TM", estado: "ACTIVO" },
    { rut: "19820806-K", nombre: "PAÑINAO ANTINAO, MARCELA", departamento: "IMAGENOLOGIA", estamento: "TENS", estado: "ACTIVO" },
    { rut: "19305231-2", nombre: "AEDO SALDES, NINETTE", departamento: "IMAGENOLOGIA", estamento: "TM", estado: "ACTIVO" },
    { rut: "16315004-2", nombre: "MEDINA MUÑOZ, MACARENA", departamento: "IMAGENOLOGIA", estamento: "TM", estado: "ACTIVO" },
    { rut: "19520230-3", nombre: "GONZALEZ MAUREIRA, DIEGO", departamento: "IMAGENOLOGIA", estamento: "TM", estado: "ACTIVO" },
  ];

  const wIds: Record<string, number> = {};
  for (const w of workers) {
    const r = await sql`
      INSERT INTO dosimetria_trabajadores (rut, nombre, departamento, estamento, estado)
      VALUES (${w.rut}, ${w.nombre}, ${w.departamento}, ${w.estamento}, ${w.estado})
      RETURNING id
    `;
    wIds[w.rut] = r.rows[0].id;
  }

  // ─── Seed registros trimestrales (datos reales del Excel) ─────────────────
  const registros = [
    // CABELLO MIRANDA - T4-2025
    { rut:"15261618-K", periodo:"T 4-2025", trim:4, anio:2025, tipo:"I1", dosimetro:"XA02147878W", proceso:"PM", fecha:"2026-02-03",
      hp10_qual:"0.71", hp3_qual:"0.75", hp007_qual:"0.75", hp10_trim:0.71, hp3_trim:0.75, hp007_trim:0.75,
      hp10_anio:0.71, hp3_anio:0.75, hp007_anio:0.75, hp10_12m:0.71, hp3_12m:0.75, hp007_12m:0.75, hp10_60m:0.71, hp3_60m:0.75, hp007_60m:0.75 },
    { rut:"15261618-K", periodo:"T 4-2025", trim:4, anio:2025, tipo:"I5", dosimetro:"XA03768874R", proceso:"PH", fecha:"2026-02-03",
      hp10_qual:"", hp3_qual:"", hp007_qual:"2.02", hp10_trim:null, hp3_trim:null, hp007_trim:2.02,
      hp10_anio:null, hp3_anio:null, hp007_anio:2.02, hp10_12m:null, hp3_12m:null, hp007_12m:2.02, hp10_60m:null, hp3_60m:null, hp007_60m:2.02 },
    // CABELLO MIRANDA - T1-2026
    { rut:"15261618-K", periodo:"T 1-2026", trim:1, anio:2026, tipo:"I1", dosimetro:"XA03789409R", proceso:"PH", fecha:"2026-05-08",
      hp10_qual:"1.14", hp3_qual:"1.12", hp007_qual:"1.08", hp10_trim:1.14, hp3_trim:1.12, hp007_trim:1.08,
      hp10_anio:1.14, hp3_anio:1.12, hp007_anio:1.08, hp10_12m:1.85, hp3_12m:1.87, hp007_12m:1.83, hp10_60m:1.85, hp3_60m:1.87, hp007_60m:1.83 },
    // CABELLO MIRANDA - T2-2026
    { rut:"15261618-K", periodo:"T 2-2026", trim:2, anio:2026, tipo:"I1", dosimetro:"XA011745468", proceso:"", fecha:"2026-08-05",
      hp10_qual:"0.48", hp3_qual:"0.66", hp007_qual:"0.87", hp10_trim:0.48, hp3_trim:0.66, hp007_trim:0.87,
      hp10_anio:1.62, hp3_anio:1.78, hp007_anio:1.95, hp10_12m:2.33, hp3_12m:2.53, hp007_12m:2.70, hp10_60m:2.33, hp3_60m:2.53, hp007_60m:2.70 },
    // CURILLAN - T1-2023
    { rut:"14094639-7", periodo:"T 1-2023", trim:1, anio:2023, tipo:"I1", dosimetro:"XA02528796Z", proceso:"", fecha:"2023-05-11",
      hp10_qual:"MNR", hp3_qual:"MNR", hp007_qual:"MNR", hp10_trim:0.05, hp3_trim:0.05, hp007_trim:0.04,
      hp10_anio:0.05, hp3_anio:0.05, hp007_anio:0.04, hp10_12m:0.20, hp3_12m:0.19, hp007_12m:0.18, hp10_60m:0.83, hp3_60m:0.81, hp007_60m:0.79 },
    { rut:"14094639-7", periodo:"T 2-2023", trim:2, anio:2023, tipo:"I1", dosimetro:"XA02705187F", proceso:"", fecha:"2023-08-08",
      hp10_qual:"0.19", hp3_qual:"0.19", hp007_qual:"0.19", hp10_trim:0.19, hp3_trim:0.19, hp007_trim:0.19,
      hp10_anio:0.24, hp3_anio:0.24, hp007_anio:0.23, hp10_12m:0.38, hp3_12m:0.37, hp007_12m:0.36, hp10_60m:1.02, hp3_60m:1.00, hp007_60m:0.98 },
    // GUTIERREZ - T1-2023
    { rut:"16598909-0", periodo:"T 1-2023", trim:1, anio:2023, tipo:"I1", dosimetro:"XA03787671Y", proceso:"", fecha:"2023-05-01",
      hp10_qual:"0.19", hp3_qual:"0.19", hp007_qual:"0.19", hp10_trim:0.19, hp3_trim:0.19, hp007_trim:0.19,
      hp10_anio:0.19, hp3_anio:0.19, hp007_anio:0.19, hp10_12m:0.19, hp3_12m:0.19, hp007_12m:0.19, hp10_60m:0.19, hp3_60m:0.19, hp007_60m:0.19 },
    { rut:"16598909-0", periodo:"T 2-2023", trim:2, anio:2023, tipo:"I1", dosimetro:"XA03787671Y", proceso:"", fecha:"2023-08-01",
      hp10_qual:"0.88", hp3_qual:"0.88", hp007_qual:"0.88", hp10_trim:0.88, hp3_trim:0.88, hp007_trim:0.88,
      hp10_anio:1.07, hp3_anio:1.07, hp007_anio:1.07, hp10_12m:1.07, hp3_12m:1.07, hp007_12m:1.07, hp10_60m:1.07, hp3_60m:1.07, hp007_60m:1.07 },
    { rut:"16598909-0", periodo:"T 3-2023", trim:3, anio:2023, tipo:"I1", dosimetro:"XA03787671Y", proceso:"", fecha:"2023-11-01",
      hp10_qual:"0.69", hp3_qual:"0.69", hp007_qual:"0.69", hp10_trim:0.69, hp3_trim:0.69, hp007_trim:0.69,
      hp10_anio:1.76, hp3_anio:1.76, hp007_anio:1.76, hp10_12m:1.76, hp3_12m:1.76, hp007_12m:1.76, hp10_60m:1.76, hp3_60m:1.76, hp007_60m:1.76 },
    { rut:"16598909-0", periodo:"T 4-2023", trim:4, anio:2023, tipo:"I1", dosimetro:"XA03787671Y", proceso:"", fecha:"2024-02-01",
      hp10_qual:"0.90", hp3_qual:"0.90", hp007_qual:"0.90", hp10_trim:0.90, hp3_trim:0.90, hp007_trim:0.90,
      hp10_anio:2.66, hp3_anio:2.66, hp007_anio:2.66, hp10_12m:2.66, hp3_12m:2.66, hp007_12m:2.66, hp10_60m:2.66, hp3_60m:2.66, hp007_60m:2.66 },
    // ESCOBAR - CARDIOLOGIA
    { rut:"14645058-K", periodo:"T 1-2023", trim:1, anio:2023, tipo:"I1", dosimetro:"XA021111111", proceso:"", fecha:"2023-05-01",
      hp10_qual:"0.31", hp3_qual:"0.31", hp007_qual:"0.31", hp10_trim:0.31, hp3_trim:0.31, hp007_trim:0.31,
      hp10_anio:0.31, hp3_anio:0.31, hp007_anio:0.31, hp10_12m:0.31, hp3_12m:0.31, hp007_12m:0.31, hp10_60m:0.31, hp3_60m:0.31, hp007_60m:0.31 },
    { rut:"14645058-K", periodo:"T 2-2023", trim:2, anio:2023, tipo:"I1", dosimetro:"XA021111112", proceso:"", fecha:"2023-08-01",
      hp10_qual:"0.44", hp3_qual:"0.44", hp007_qual:"0.44", hp10_trim:0.44, hp3_trim:0.44, hp007_trim:0.44,
      hp10_anio:0.75, hp3_anio:0.75, hp007_anio:0.75, hp10_12m:0.75, hp3_12m:0.75, hp007_12m:0.75, hp10_60m:0.75, hp3_60m:0.75, hp007_60m:0.75 },
    { rut:"14645058-K", periodo:"T 3-2023", trim:3, anio:2023, tipo:"I1", dosimetro:"XA021111113", proceso:"", fecha:"2023-11-01",
      hp10_qual:"0.10", hp3_qual:"0.10", hp007_qual:"0.10", hp10_trim:0.10, hp3_trim:0.10, hp007_trim:0.10,
      hp10_anio:0.85, hp3_anio:0.85, hp007_anio:0.85, hp10_12m:0.85, hp3_12m:0.85, hp007_12m:0.85, hp10_60m:0.85, hp3_60m:0.85, hp007_60m:0.85 },
    { rut:"14645058-K", periodo:"T 4-2023", trim:4, anio:2023, tipo:"I1", dosimetro:"XA021111114", proceso:"", fecha:"2024-02-01",
      hp10_qual:"0.17", hp3_qual:"0.17", hp007_qual:"0.17", hp10_trim:0.17, hp3_trim:0.17, hp007_trim:0.17,
      hp10_anio:1.02, hp3_anio:1.02, hp007_anio:1.02, hp10_12m:1.02, hp3_12m:1.02, hp007_12m:1.02, hp10_60m:1.02, hp3_60m:1.02, hp007_60m:1.02 },
    // HENRIQUEZ - CARDIOLOGIA
    { rut:"15550173-1", periodo:"T 1-2023", trim:1, anio:2023, tipo:"I1", dosimetro:"XA027992136", proceso:"", fecha:"2023-05-01",
      hp10_qual:"0.01", hp3_qual:"0.01", hp007_qual:"0.01", hp10_trim:0.01, hp3_trim:0.01, hp007_trim:0.01,
      hp10_anio:0.01, hp3_anio:0.01, hp007_anio:0.01, hp10_12m:0.01, hp3_12m:0.01, hp007_12m:0.01, hp10_60m:0.01, hp3_60m:0.01, hp007_60m:0.01 },
    // PALMA - MN 2026
    { rut:"13318254-3", periodo:"T 1-2026", trim:1, anio:2026, tipo:"I1", dosimetro:"XA04029634B", proceso:"PH", fecha:"2026-05-01",
      hp10_qual:"0.52", hp3_qual:"0.48", hp007_qual:"0.44", hp10_trim:0.52, hp3_trim:0.48, hp007_trim:0.44,
      hp10_anio:0.52, hp3_anio:0.48, hp007_anio:0.44, hp10_12m:0.52, hp3_12m:0.48, hp007_12m:0.44, hp10_60m:0.52, hp3_60m:0.48, hp007_60m:0.44 },
    { rut:"13318254-3", periodo:"T 1-2026", trim:1, anio:2026, tipo:"I5", dosimetro:"XA00607824G", proceso:"PM", fecha:"2026-05-01",
      hp10_qual:"", hp3_qual:"", hp007_qual:"1.20", hp10_trim:null, hp3_trim:null, hp007_trim:1.20,
      hp10_anio:null, hp3_anio:null, hp007_anio:1.20, hp10_12m:null, hp3_12m:null, hp007_12m:1.20, hp10_60m:null, hp3_60m:null, hp007_60m:1.20 },
    // GONZALEZ - IMAGENOLOGIA
    { rut:"19520230-3", periodo:"T 1-2024", trim:1, anio:2024, tipo:"I1", dosimetro:"XA03815090P", proceso:"", fecha:"2024-05-01",
      hp10_qual:"0.08", hp3_qual:"0.08", hp007_qual:"0.08", hp10_trim:0.08, hp3_trim:0.08, hp007_trim:0.08,
      hp10_anio:0.08, hp3_anio:0.08, hp007_anio:0.08, hp10_12m:0.08, hp3_12m:0.08, hp007_12m:0.08, hp10_60m:0.08, hp3_60m:0.08, hp007_60m:0.08 },
    { rut:"19520230-3", periodo:"T 2-2024", trim:2, anio:2024, tipo:"I1", dosimetro:"XA03815090P", proceso:"", fecha:"2024-08-01",
      hp10_qual:"0.12", hp3_qual:"0.12", hp007_qual:"0.12", hp10_trim:0.12, hp3_trim:0.12, hp007_trim:0.12,
      hp10_anio:0.20, hp3_anio:0.20, hp007_anio:0.20, hp10_12m:0.20, hp3_12m:0.20, hp007_12m:0.20, hp10_60m:0.20, hp3_60m:0.20, hp007_60m:0.20 },
    { rut:"19520230-3", periodo:"T 3-2024", trim:3, anio:2024, tipo:"I1", dosimetro:"XA03815090P", proceso:"", fecha:"2024-11-01",
      hp10_qual:"0.15", hp3_qual:"0.15", hp007_qual:"0.15", hp10_trim:0.15, hp3_trim:0.15, hp007_trim:0.15,
      hp10_anio:0.35, hp3_anio:0.35, hp007_anio:0.35, hp10_12m:0.35, hp3_12m:0.35, hp007_12m:0.35, hp10_60m:0.35, hp3_60m:0.35, hp007_60m:0.35 },
    { rut:"19520230-3", periodo:"T 4-2024", trim:4, anio:2024, tipo:"I1", dosimetro:"XA03815090P", proceso:"", fecha:"2025-02-01",
      hp10_qual:"0.09", hp3_qual:"0.09", hp007_qual:"0.09", hp10_trim:0.09, hp3_trim:0.09, hp007_trim:0.09,
      hp10_anio:0.44, hp3_anio:0.44, hp007_anio:0.44, hp10_12m:0.44, hp3_12m:0.44, hp007_12m:0.44, hp10_60m:0.44, hp3_60m:0.44, hp007_60m:0.44 },
  ];

  for (const r of registros) {
    const wId = wIds[r.rut];
    if (!wId) continue;
    await sql`
      INSERT INTO dosimetria_registros (
        trabajador_id, rut, nombre, departamento, periodo, trimestre, anio,
        tipo_dosimetro, numero_dosimetro, proceso, fecha_proceso,
        hp10_cual, hp3_cual, hp007_cual,
        hp10_trim, hp3_trim, hp007_trim,
        hp10_anio, hp3_anio, hp007_anio,
        hp10_12m, hp3_12m, hp007_12m,
        hp10_60m, hp3_60m, hp007_60m
      ) VALUES (
        ${wId}, ${r.rut},
        (SELECT nombre FROM dosimetria_trabajadores WHERE id=${wId}),
        (SELECT departamento FROM dosimetria_trabajadores WHERE id=${wId}),
        ${r.periodo}, ${r.trim}, ${r.anio},
        ${r.tipo}, ${r.dosimetro ?? null}, ${r.proceso ?? null},
        ${r.fecha ?? null},
        ${r.hp10_qual ?? null}, ${r.hp3_qual ?? null}, ${r.hp007_qual ?? null},
        ${r.hp10_trim ?? null}, ${r.hp3_trim ?? null}, ${r.hp007_trim ?? null},
        ${r.hp10_anio ?? null}, ${r.hp3_anio ?? null}, ${r.hp007_anio ?? null},
        ${r.hp10_12m ?? null}, ${r.hp3_12m ?? null}, ${r.hp007_12m ?? null},
        ${r.hp10_60m ?? null}, ${r.hp3_60m ?? null}, ${r.hp007_60m ?? null}
      )
    `;
  }

  // ─── Seed devueltos fuera de plazo ─────────────────────────────────────────
  const devFP = [
    { rut:"15550173-1", nombre:"HENRIQUEZ UBILLA, MARCELO", departamento:"CARDIOLOGIA", periodo:"T 2-2021", trim:2, anio:2021, dosimetro:"XA027992136", fecha:"2024-11-15", alerta:false },
    { rut:"15852049-4", nombre:"TORRES SILVA, MARIO", departamento:"CARDIOLOGIA", periodo:"T 3-2023", trim:3, anio:2023, dosimetro:"XA02046997W", fecha:"2024-11-15", alerta:false },
    { rut:"19820806-K", nombre:"PAÑINAO ANTINAO, MARCELA", departamento:"IMAGENOLOGIA", periodo:"T 1-2024", trim:1, anio:2024, dosimetro:"XA03487912Z", fecha:"2024-11-15", alerta:false },
    { rut:"19305231-2", nombre:"AEDO SALDES, NINETTE", departamento:"IMAGENOLOGIA", periodo:"T 2-2024", trim:2, anio:2024, dosimetro:"XA041090100", fecha:"2024-11-15", alerta:false },
    { rut:"18829877-K", nombre:"INFANTE CHEUQUEAN, IVANA", departamento:"IMAGENOLOGIA", periodo:"T 2-2024", trim:2, anio:2024, dosimetro:"XA03616077E", fecha:"2024-11-15", alerta:false },
    { rut:"16315004-2", nombre:"MEDINA MUÑOZ, MACARENA", departamento:"IMAGENOLOGIA", periodo:"T 2-2024", trim:2, anio:2024, dosimetro:"XA034555068", fecha:"2024-11-15", alerta:false },
    { rut:"19520230-3", nombre:"GONZALEZ MAUREIRA, DIEGO", departamento:"IMAGENOLOGIA", periodo:"T 2-2024", trim:2, anio:2024, dosimetro:"XA03815090P", fecha:"2024-11-15", alerta:false },
    { rut:"15846117-K", nombre:"DIAZ FUENTES, CAROLINA", departamento:"PABELLON CENTRAL", periodo:"T 2-2023", trim:2, anio:2023, dosimetro:"XA00987858M", fecha:"2024-11-15", alerta:false },
    { rut:"16947291-2", nombre:"FERRADA FUENTES, MACARENA", departamento:"PABELLON CENTRAL", periodo:"T 3-2023", trim:3, anio:2023, dosimetro:"XA02163420P", fecha:"2024-11-15", alerta:false },
  ];
  for (const d of devFP) {
    await sql`
      INSERT INTO dosimetria_devueltos_fuera_plazo
        (rut, nombre, departamento, periodo, trimestre, anio, numero_dosimetro, fecha_lectura, alerta_dosis)
      VALUES (${d.rut}, ${d.nombre}, ${d.departamento}, ${d.periodo}, ${d.trim}, ${d.anio},
              ${d.dosimetro}, ${d.fecha}, ${d.alerta})
    `;
  }

  // ─── Seed no devueltos ─────────────────────────────────────────────────────
  const noDevs = [
    { rut:"15961689-4", nombre:"ABARZA YAÑEZ, JUAN", departamento:"PABELLON CENTRAL", periodo:"T 2-2024", trim:2, anio:2024, tipo:"I1", dosimetro:"XA03779604Z", extraviado:false },
    { rut:"15961689-4", nombre:"ABARZA YAÑEZ, JUAN", departamento:"PABELLON CENTRAL", periodo:"T 3-2026", trim:3, anio:2026, tipo:"I1", dosimetro:"XA04212920L", extraviado:false },
    { rut:"15961689-4", nombre:"ABARZA YAÑEZ, JUAN", departamento:"PABELLON CENTRAL", periodo:"T 4-2026", trim:4, anio:2026, tipo:"I1", dosimetro:"XA02420651O", extraviado:false },
    { rut:"19075916-4", nombre:"ABARZUA GAJARDO, ROCIO", departamento:"CMA", periodo:"T 1-2021", trim:1, anio:2021, tipo:"I1", dosimetro:"XA00873121O", extraviado:false },
    { rut:"12194646-7", nombre:"ACEITON LEYTON, YASMIN", departamento:"PABELLON CENTRAL", periodo:"T 1-2021", trim:1, anio:2021, tipo:"I1", dosimetro:"XA02692180F", extraviado:false },
    { rut:"12194646-7", nombre:"ACEITON LEYTON, YASMIN", departamento:"PABELLON CENTRAL", periodo:"T 1-2022", trim:1, anio:2022, tipo:"I1", dosimetro:"XA024609255", extraviado:false },
    { rut:"12194646-7", nombre:"ACEITON LEYTON, YASMIN", departamento:"PABELLON CENTRAL", periodo:"T 2-2023", trim:2, anio:2023, tipo:"I1", dosimetro:"XA03430086J", extraviado:false },
    { rut:"12194646-7", nombre:"ACEITON LEYTON, YASMIN", departamento:"PABELLON CENTRAL", periodo:"T 4-2023", trim:4, anio:2023, tipo:"I1", dosimetro:"XA037478051", extraviado:false },
    { rut:"9293985-5",  nombre:"ACEITON VASQUEZ, PATRICIA", departamento:"PABELLON CENTRAL", periodo:"T 4-2021", trim:4, anio:2021, tipo:"I1", dosimetro:"XA030963174", extraviado:false },
  ];
  for (const n of noDevs) {
    await sql`
      INSERT INTO dosimetria_no_devueltos
        (rut, nombre, departamento, periodo, trimestre, anio, tipo_dosimetro, numero_dosimetro, extraviado)
      VALUES (${n.rut}, ${n.nombre}, ${n.departamento}, ${n.periodo}, ${n.trim}, ${n.anio},
              ${n.tipo}, ${n.dosimetro}, ${n.extraviado})
    `;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).trim());
  return isNaN(n) ? null : n;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") ?? "summary";
    const anio = searchParams.get("anio");
    const trimestre = searchParams.get("trimestre");
    const departamento = searchParams.get("departamento");
    const rut = searchParams.get("rut");

    // ── SUMMARY DASHBOARD ────────────────────────────────────────────────────
    if (view === "summary") {
      const [totTrab, totReg, devFP, noDev, alertas] = await Promise.all([
        sql`SELECT COUNT(DISTINCT rut) as n FROM dosimetria_trabajadores WHERE estado='ACTIVO'`,
        sql`SELECT COUNT(*) as n FROM dosimetria_registros`,
        sql`SELECT COUNT(*) as n FROM dosimetria_devueltos_fuera_plazo`,
        sql`SELECT COUNT(*) as n FROM dosimetria_no_devueltos`,
        sql`SELECT COUNT(*) as n FROM dosimetria_no_devueltos WHERE extraviado=TRUE`,
      ]);

      // Dosis promedio hospital por año
      const promedios = await sql`
        SELECT anio,
          ROUND(AVG(hp10_trim)::numeric,3) as avg_hp10,
          ROUND(AVG(hp3_trim)::numeric,3) as avg_hp3,
          ROUND(AVG(hp007_trim)::numeric,3) as avg_hp007,
          COUNT(*) as n_registros
        FROM dosimetria_registros
        WHERE hp10_trim IS NOT NULL
        GROUP BY anio ORDER BY anio
      `;

      // Por departamento
      const porDepto = await sql`
        SELECT departamento,
          ROUND(AVG(hp10_trim)::numeric,3) as avg_hp10,
          MAX(hp10_trim) as max_hp10,
          COUNT(*) as n
        FROM dosimetria_registros
        WHERE hp10_trim IS NOT NULL
        GROUP BY departamento ORDER BY avg_hp10 DESC
      `;

      // Límites: 20 mSv/año ocupacional → alerta 15 mSv (75%)
      const sobreLimite = await sql`
        SELECT rut, nombre, departamento, anio, hp10_anio
        FROM dosimetria_registros
        WHERE hp10_anio > 15
        ORDER BY hp10_anio DESC
        LIMIT 20
      `;

      return NextResponse.json({
        kpis: {
          trabajadores_activos: parseInt(totTrab.rows[0].n),
          total_registros: parseInt(totReg.rows[0].n),
          devueltos_fuera_plazo: parseInt(devFP.rows[0].n),
          no_devueltos: parseInt(noDev.rows[0].n),
          extraviados: parseInt(alertas.rows[0].n),
        },
        promedios_por_anio: promedios.rows,
        por_departamento: porDepto.rows,
        sobre_75_limite: sobreLimite.rows,
      });
    }

    // ── TRIMESTRAL ───────────────────────────────────────────────────────────
    if (view === "trimestral") {
      let q = `SELECT r.*, t.estamento
               FROM dosimetria_registros r
               JOIN dosimetria_trabajadores t ON t.rut=r.rut
               WHERE 1=1`;
      const params: (string | number)[] = [];
      if (anio) { params.push(anio); q += ` AND r.anio=$${params.length}`; }
      if (trimestre) { params.push(trimestre); q += ` AND r.trimestre=$${params.length}`; }
      if (departamento) { params.push(departamento); q += ` AND r.departamento=$${params.length}`; }
      if (rut) { params.push(rut); q += ` AND r.rut=$${params.length}`; }
      q += " ORDER BY r.anio, r.trimestre, r.departamento, r.nombre";

      // Build query safely using sql tag based on filters
      const rows = await sql.query(q, params);
      return NextResponse.json({ registros: rows.rows });
    }

    // ── ANUAL ────────────────────────────────────────────────────────────────
    if (view === "anual") {
      const filtAnio = anio ? `AND anio = ${parseInt(anio)}` : "";
      const filtDepto = departamento ? `AND departamento = '${departamento.replace(/'/g,"''")}'` : "";
      const rows = await sql.query(`
        SELECT rut, nombre, departamento,
          anio,
          SUM(CASE WHEN trimestre=1 THEN hp10_trim ELSE 0 END) as T1,
          SUM(CASE WHEN trimestre=2 THEN hp10_trim ELSE 0 END) as T2,
          SUM(CASE WHEN trimestre=3 THEN hp10_trim ELSE 0 END) as T3,
          SUM(CASE WHEN trimestre=4 THEN hp10_trim ELSE 0 END) as T4,
          SUM(hp10_trim) as total_anual,
          COUNT(*) as n_trimestres
        FROM dosimetria_registros
        WHERE tipo_dosimetro='I1' ${filtAnio} ${filtDepto}
        GROUP BY rut, nombre, departamento, anio
        ORDER BY anio, departamento, nombre
      `);
      return NextResponse.json({ registros: rows.rows });
    }

    // ── DEVUELTOS FUERA DE PLAZO ──────────────────────────────────────────────
    if (view === "devueltos_fp") {
      const rows = await sql.query(`
        SELECT * FROM dosimetria_devueltos_fuera_plazo
        WHERE 1=1
        ${anio ? `AND anio=${parseInt(anio)}` : ""}
        ${trimestre ? `AND trimestre=${parseInt(trimestre)}` : ""}
        ${departamento ? `AND departamento='${departamento.replace(/'/g,"''")}'` : ""}
        ORDER BY anio DESC, trimestre DESC, departamento, nombre
      `);
      return NextResponse.json({ registros: rows.rows });
    }

    // ── NO DEVUELTOS ──────────────────────────────────────────────────────────
    if (view === "no_devueltos") {
      const rows = await sql.query(`
        SELECT * FROM dosimetria_no_devueltos
        WHERE 1=1
        ${anio ? `AND anio=${parseInt(anio)}` : ""}
        ${trimestre ? `AND trimestre=${parseInt(trimestre)}` : ""}
        ${departamento ? `AND departamento='${departamento.replace(/'/g,"''")}'` : ""}
        ORDER BY anio DESC, trimestre DESC, departamento, nombre
      `);
      return NextResponse.json({ registros: rows.rows });
    }

    // ── DASHBOARD COMPARATIVO ────────────────────────────────────────────────
    if (view === "dashboard") {
      const [byDepto, byAnio, byTrim, top10, hist] = await Promise.all([
        sql`
          SELECT departamento,
            ROUND(AVG(hp10_trim)::numeric,4) as avg_hp10,
            ROUND(AVG(hp3_trim)::numeric,4) as avg_hp3,
            ROUND(AVG(hp007_trim)::numeric,4) as avg_hp007,
            MAX(hp10_trim) as max_hp10,
            COUNT(*) as n,
            SUM(CASE WHEN hp10_trim>15 THEN 1 ELSE 0 END) as sobre_alerta
          FROM dosimetria_registros WHERE hp10_trim IS NOT NULL
          GROUP BY departamento ORDER BY avg_hp10 DESC
        `,
        sql`
          SELECT anio,
            ROUND(AVG(hp10_trim)::numeric,4) as avg_hp10,
            COUNT(DISTINCT rut) as n_trabajadores,
            MAX(hp10_trim) as max_hp10
          FROM dosimetria_registros WHERE hp10_trim IS NOT NULL
          GROUP BY anio ORDER BY anio
        `,
        sql`
          SELECT anio, trimestre,
            ROUND(AVG(hp10_trim)::numeric,4) as avg_hp10,
            COUNT(*) as n
          FROM dosimetria_registros WHERE hp10_trim IS NOT NULL
          GROUP BY anio, trimestre ORDER BY anio, trimestre
        `,
        sql`
          SELECT rut, nombre, departamento,
            MAX(hp10_anio) as max_anual,
            MAX(hp10_60m) as max_60m
          FROM dosimetria_registros
          WHERE hp10_anio IS NOT NULL
          GROUP BY rut, nombre, departamento
          ORDER BY max_anual DESC LIMIT 10
        `,
        sql`
          SELECT rut, nombre, departamento, anio, trimestre, periodo,
            hp10_trim, hp3_trim, hp007_trim
          FROM dosimetria_registros
          WHERE rut=${rut ?? ""}
          ORDER BY anio, trimestre
        `,
      ]);

      return NextResponse.json({
        por_departamento: byDepto.rows,
        tendencia_anual: byAnio.rows,
        tendencia_trimestral: byTrim.rows,
        top_trabajadores: top10.rows,
        historico_individual: hist.rows,
        limite_anual_mSv: 20,
        alerta_75pct_mSv: 15,
      });
    }

    // ── TRABAJADORES ─────────────────────────────────────────────────────────
    if (view === "trabajadores") {
      const rows = await sql`
        SELECT t.*,
          COUNT(r.id) as n_registros,
          MAX(r.hp10_anio) as ultima_dosis_anual
        FROM dosimetria_trabajadores t
        LEFT JOIN dosimetria_registros r ON r.rut=t.rut
        GROUP BY t.id ORDER BY t.departamento, t.nombre
      `;
      return NextResponse.json({ trabajadores: rows.rows });
    }

    return NextResponse.json({ error: "view no válido" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─── POST — crear registro / devuelto / no_devuelto / trabajador ──────────────
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { tabla } = body;

    if (tabla === "registro") {
      const { rut, nombre, departamento, periodo, trimestre, anio, tipo_dosimetro,
              numero_dosimetro, proceso, fecha_proceso,
              hp10_qual, hp3_qual, hp007_qual,
              hp10_trim, hp3_trim, hp007_trim,
              hp10_anio, hp3_anio, hp007_anio } = body;

      // Ensure worker exists
      await sql`
        INSERT INTO dosimetria_trabajadores (rut, nombre, departamento)
        VALUES (${rut}, ${nombre}, ${departamento})
        ON CONFLICT DO NOTHING
      `;
      const tRow = await sql`SELECT id FROM dosimetria_trabajadores WHERE rut=${rut} LIMIT 1`;

      const r = await sql`
        INSERT INTO dosimetria_registros (
          trabajador_id, rut, nombre, departamento, periodo, trimestre, anio,
          tipo_dosimetro, numero_dosimetro, proceso, fecha_proceso,
          hp10_cual, hp3_cual, hp007_cual,
          hp10_trim, hp3_trim, hp007_trim,
          hp10_anio, hp3_anio, hp007_anio
        ) VALUES (
          ${tRow.rows[0]?.id ?? null}, ${rut}, ${nombre}, ${departamento},
          ${periodo}, ${trimestre}, ${anio}, ${tipo_dosimetro},
          ${numero_dosimetro ?? null}, ${proceso ?? null}, ${fecha_proceso ?? null},
          ${hp10_qual ?? null}, ${hp3_qual ?? null}, ${hp007_qual ?? null},
          ${parseNum(hp10_trim)}, ${parseNum(hp3_trim)}, ${parseNum(hp007_trim)},
          ${parseNum(hp10_anio)}, ${parseNum(hp3_anio)}, ${parseNum(hp007_anio)}
        ) RETURNING id
      `;
      return NextResponse.json({ ok: true, id: r.rows[0].id });
    }

    if (tabla === "devuelto_fp") {
      const { rut, nombre, departamento, periodo, trimestre, anio,
              numero_dosimetro, fecha_lectura, alerta_dosis, observacion } = body;
      const r = await sql`
        INSERT INTO dosimetria_devueltos_fuera_plazo
          (rut, nombre, departamento, periodo, trimestre, anio, numero_dosimetro,
           fecha_lectura, alerta_dosis, observacion)
        VALUES (${rut}, ${nombre}, ${departamento}, ${periodo}, ${trimestre}, ${anio},
                ${numero_dosimetro ?? null}, ${fecha_lectura ?? null},
                ${alerta_dosis ?? false}, ${observacion ?? null})
        RETURNING id
      `;
      return NextResponse.json({ ok: true, id: r.rows[0].id });
    }

    if (tabla === "no_devuelto") {
      const { rut, nombre, departamento, periodo, trimestre, anio,
              tipo_dosimetro, numero_dosimetro, extraviado, observacion } = body;
      const r = await sql`
        INSERT INTO dosimetria_no_devueltos
          (rut, nombre, departamento, periodo, trimestre, anio,
           tipo_dosimetro, numero_dosimetro, extraviado, observacion)
        VALUES (${rut}, ${nombre}, ${departamento}, ${periodo}, ${trimestre}, ${anio},
                ${tipo_dosimetro ?? "I1"}, ${numero_dosimetro ?? null},
                ${extraviado ?? false}, ${observacion ?? null})
        RETURNING id
      `;
      return NextResponse.json({ ok: true, id: r.rows[0].id });
    }

    if (tabla === "trabajador") {
      const { rut, nombre, departamento, estamento, estado } = body;
      const r = await sql`
        INSERT INTO dosimetria_trabajadores (rut, nombre, departamento, estamento, estado)
        VALUES (${rut}, ${nombre}, ${departamento}, ${estamento ?? null}, ${estado ?? "ACTIVO"})
        ON CONFLICT DO NOTHING RETURNING id
      `;
      return NextResponse.json({ ok: true, id: r.rows[0]?.id });
    }

    return NextResponse.json({ error: "tabla no válida" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─── PATCH — marcar extraviado, adjunto, etc. ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { tabla, id, ...fields } = body;

    if (tabla === "no_devuelto") {
      const { extraviado, observacion } = fields;
      await sql`
        UPDATE dosimetria_no_devueltos
        SET extraviado=${extraviado ?? false},
            observacion=${observacion ?? null}
        WHERE id=${id}
      `;
      return NextResponse.json({ ok: true });
    }

    if (tabla === "devuelto_fp") {
      const { alerta_dosis, observacion } = fields;
      await sql`
        UPDATE dosimetria_devueltos_fuera_plazo
        SET alerta_dosis=${alerta_dosis ?? false},
            observacion=${observacion ?? null}
        WHERE id=${id}
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "tabla no válida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
