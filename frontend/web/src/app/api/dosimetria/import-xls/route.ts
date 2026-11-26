import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s || s === "" || s === "-") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parsePeriodo(periodo: string): { trimestre: number; anio: number } | null {
  if (!periodo) return null;
  // Formats: "T 1-2026", "T1-2026", "T 1 -2026", "T 2 -2021"
  const m = String(periodo).replace(/\s+/g, " ").trim().match(/T\s*(\d)\s*-?\s*(\d{4})/i);
  if (!m) return null;
  return { trimestre: parseInt(m[1]), anio: parseInt(m[2]) };
}

function normalizeText(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

// ─── ensureTable ──────────────────────────────────────────────────────────────
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_trabajadores (
      id SERIAL PRIMARY KEY, rut TEXT NOT NULL, nombre TEXT NOT NULL,
      departamento TEXT NOT NULL, estamento TEXT, estado TEXT DEFAULT 'ACTIVO',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_registros (
      id SERIAL PRIMARY KEY, trabajador_id INT, rut TEXT NOT NULL,
      nombre TEXT NOT NULL, departamento TEXT NOT NULL,
      periodo TEXT NOT NULL, trimestre INT NOT NULL, anio INT NOT NULL,
      tipo_dosimetro TEXT NOT NULL, numero_dosimetro TEXT,
      proceso TEXT, fecha_proceso DATE,
      hp10_cual TEXT, hp3_cual TEXT, hp007_cual TEXT,
      hp10_trim NUMERIC(8,4), hp3_trim NUMERIC(8,4), hp007_trim NUMERIC(8,4),
      hp10_anio NUMERIC(8,4), hp3_anio NUMERIC(8,4), hp007_anio NUMERIC(8,4),
      hp10_12m NUMERIC(8,4), hp3_12m NUMERIC(8,4), hp007_12m NUMERIC(8,4),
      hp10_60m NUMERIC(8,4), hp3_60m NUMERIC(8,4), hp007_60m NUMERIC(8,4),
      fuente TEXT DEFAULT 'manual',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_devueltos_fuera_plazo (
      id SERIAL PRIMARY KEY, rut TEXT NOT NULL, nombre TEXT NOT NULL,
      departamento TEXT NOT NULL, periodo TEXT NOT NULL, trimestre INT, anio INT,
      numero_dosimetro TEXT, fecha_lectura DATE, alerta_dosis BOOLEAN DEFAULT FALSE,
      observacion TEXT, adjunto_url TEXT, adjunto_nombre TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetria_no_devueltos (
      id SERIAL PRIMARY KEY, rut TEXT NOT NULL, nombre TEXT NOT NULL,
      departamento TEXT NOT NULL, periodo TEXT NOT NULL, trimestre INT, anio INT,
      tipo_dosimetro TEXT, numero_dosimetro TEXT, extraviado BOOLEAN DEFAULT FALSE,
      observacion TEXT, adjunto_url TEXT, adjunto_nombre TEXT,
      fecha_registro DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  // Add fuente column if missing
  try {
    await sql`ALTER TABLE dosimetria_registros ADD COLUMN IF NOT EXISTS fuente TEXT DEFAULT 'manual'`;
  } catch {}
}

// ─── Upsert worker and return ID ──────────────────────────────────────────────
async function upsertWorker(rut: string, nombre: string, departamento: string): Promise<number | null> {
  if (!rut) return null;
  const existing = await sql`SELECT id FROM dosimetria_trabajadores WHERE rut=${rut} LIMIT 1`;
  if (existing.rows.length) return existing.rows[0].id;
  const ins = await sql`
    INSERT INTO dosimetria_trabajadores (rut, nombre, departamento, estado)
    VALUES (${rut}, ${nombre}, ${departamento}, 'ACTIVO')
    RETURNING id
  `;
  return ins.rows[0].id;
}

// ─── POST: receive XLSX file, parse all sheets, upsert to DB ─────────────────
export async function POST(req: NextRequest) {
  try {
    await ensureTable();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const soloPreview = formData.get("preview") === "1";

    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheetNames = workbook.SheetNames;

    // Parse all sheets to JSON (first row = headers)
    const sheets: Record<string, Record<string, unknown>[]> = {};
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name];
      sheets[name] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
    }

    // ── Map known CCHEN sheet names ───────────────────────────────────────────
    const findSheet = (keywords: string[]): Record<string, unknown>[] => {
      for (const kw of keywords) {
        const found = sheetNames.find(n => normalizeText(n).includes(normalizeText(kw)));
        if (found) return sheets[found] ?? [];
      }
      return [];
    };

    const rowsTrim  = findSheet(["Reporte_trimestral", "Trimestral", "Reporte"]);
    const rowsAnual = findSheet(["Resumen_anual", "Anual", "Resumen"]);
    const rowsDev   = findSheet(["Devueltos_fuera_de_plazo", "Devueltos_fuera", "Devueltos"]);
    const rowsNoDev = findSheet(["No_devueltos", "No devueltos", "No_Dev"]);
    const rowsU2T   = findSheet(["Lista_U2T", "U2T", "Lista"]);
    const rowsSiglas = findSheet(["siglas", "Siglas"]);

    // ── Preview mode: return parsed data without saving ───────────────────────
    if (soloPreview) {
      return NextResponse.json({
        sheets: sheetNames,
        preview: {
          trimestral:   rowsTrim.slice(0, 10),
          anual:        rowsAnual.slice(0, 10),
          devueltos_fp: rowsDev.slice(0, 10),
          no_devueltos: rowsNoDev.slice(0, 10),
          u2t:          rowsU2T.slice(0, 10),
          siglas:        rowsSiglas.slice(0, 20),
        },
        counts: {
          trimestral:   rowsTrim.length,
          anual:        rowsAnual.length,
          devueltos_fp: rowsDev.length,
          no_devueltos: rowsNoDev.length,
          u2t:          rowsU2T.length,
        }
      });
    }

    // ── IMPORT: process each sheet ────────────────────────────────────────────
    const stats = {
      trimestral:   { inserted: 0, skipped: 0, updated: 0 },
      anual:        { inserted: 0, skipped: 0, updated: 0 },
      devueltos_fp: { inserted: 0, skipped: 0, updated: 0 },
      no_devueltos: { inserted: 0, skipped: 0, updated: 0 },
      u2t:          { inserted: 0, skipped: 0, updated: 0 },
    };

    // ── 1. Reporte_trimestral ─────────────────────────────────────────────────
    for (const row of rowsTrim) {
      try {
        // Column names (may vary slightly)
        const rut     = String(row["RUN"] || row["RUT"] || "").trim();
        const nombre  = String(row["NOMBRE"] || "").trim();
        const depto   = String(row["DEPARTAMENTO"] || "").trim();
        const periodoStr = String(row["PERIODO"] || "").trim();
        const tipo    = String(row["tipo"] || row["TIPO"] || "I1").trim();
        const dosim   = String(row["dosimetro"] || row["DOSIMETRO"] || "").trim();
        const proceso = String(row["proceso"] || row["PROCESO"] || "").trim();

        if (!rut || !periodoStr) { stats.trimestral.skipped++; continue; }

        const pp = parsePeriodo(periodoStr);
        if (!pp) { stats.trimestral.skipped++; continue; }

        // Dose columns — qualitative
        const hp10_cual  = String(row["Dosis cuerpo entero Hp(10) del trimestre (cualitativo)"] || "").trim();
        const hp3_cual   = String(row["Dosis cristalino Hp(3) del trimestre (cualitativo)"] || "").trim();
        const hp007_cual = String(row["Dosis piel Hp(0.07) del trimestre (cualitativo)"] || "").trim();
        // Quantitative
        const hp10_trim  = parseNum(row["Dosis cuerpo entero Hp(10) del trimestre (cuantitativo)"]);
        const hp3_trim   = parseNum(row["Dosis cristalino Hp(3) del trimestre (cuantitativo)"]);
        const hp007_trim = parseNum(row["Dosis piel Hp(0.07) del trimestre (cuantitativo)"]);
        // Annual cumulative
        const hp10_anio  = parseNum(row["Suma de Dosis cuerpo entero Hp(10) del año calendario"]);
        const hp3_anio   = parseNum(row["Suma de Dosis cristalino Hp(3) del año calendario"]);
        const hp007_anio = parseNum(row["Suma de Dosis piel Hp(0.07) del año calendario"]);
        // 12 months
        const hp10_12m   = parseNum(row["Suma de Dosis cuerpo entero Hp(10) últimos 12 meses"]);
        const hp3_12m    = parseNum(row["Suma de Dosis cristalino Hp(3) últimos 12 meses"]);
        const hp007_12m  = parseNum(row["Suma de Dosis piel Hp(0.07) últimos 12 meses"]);
        // 60 months
        const hp10_60m   = parseNum(row["Suma de Dosis cuerpo entero Hp(10) últimos 60 meses"]);
        const hp3_60m    = parseNum(row["Suma de Dosis cristalino Hp(3) últimos 60 meses"]);
        const hp007_60m  = parseNum(row["Suma de Dosis piel Hp(0.07) últimos 60 meses"]);

        const workerId = await upsertWorker(rut, nombre, depto);

        // Check if record already exists
        const existing = await sql`
          SELECT id FROM dosimetria_registros
          WHERE rut=${rut} AND periodo=${periodoStr} AND tipo_dosimetro=${tipo}
          LIMIT 1
        `;

        if (existing.rows.length) {
          // Update existing record
          await sql`
            UPDATE dosimetria_registros SET
              nombre=${nombre}, departamento=${depto},
              hp10_cual=${hp10_cual||null}, hp3_cual=${hp3_cual||null}, hp007_cual=${hp007_cual||null},
              hp10_trim=${hp10_trim}, hp3_trim=${hp3_trim}, hp007_trim=${hp007_trim},
              hp10_anio=${hp10_anio}, hp3_anio=${hp3_anio}, hp007_anio=${hp007_anio},
              hp10_12m=${hp10_12m}, hp3_12m=${hp3_12m}, hp007_12m=${hp007_12m},
              hp10_60m=${hp10_60m}, hp3_60m=${hp3_60m}, hp007_60m=${hp007_60m},
              numero_dosimetro=${dosim||null}, proceso=${proceso||null},
              fuente='xls'
            WHERE id=${existing.rows[0].id}
          `;
          stats.trimestral.updated++;
        } else {
          await sql`
            INSERT INTO dosimetria_registros (
              trabajador_id, rut, nombre, departamento, periodo, trimestre, anio,
              tipo_dosimetro, numero_dosimetro, proceso,
              hp10_cual, hp3_cual, hp007_cual,
              hp10_trim, hp3_trim, hp007_trim,
              hp10_anio, hp3_anio, hp007_anio,
              hp10_12m, hp3_12m, hp007_12m,
              hp10_60m, hp3_60m, hp007_60m,
              fuente
            ) VALUES (
              ${workerId}, ${rut}, ${nombre}, ${depto}, ${periodoStr}, ${pp.trimestre}, ${pp.anio},
              ${tipo}, ${dosim||null}, ${proceso||null},
              ${hp10_cual||null}, ${hp3_cual||null}, ${hp007_cual||null},
              ${hp10_trim}, ${hp3_trim}, ${hp007_trim},
              ${hp10_anio}, ${hp3_anio}, ${hp007_anio},
              ${hp10_12m}, ${hp3_12m}, ${hp007_12m},
              ${hp10_60m}, ${hp3_60m}, ${hp007_60m},
              'xls'
            )
          `;
          stats.trimestral.inserted++;
        }
      } catch (e) {
        console.error("trimestral row error:", e);
        stats.trimestral.skipped++;
      }
    }

    // ── 2. Resumen_anual (annual summaries — just update worker info, not stored separately) ───
    // The annual view is computed from dosimetria_registros, but we can store separate annual records
    // that come from the XLS if they differ from the computed totals.
    // For now we just count them (the page computes annual from registros).
    for (const row of rowsAnual) {
      try {
        const rut   = String(row["RUN"] || row["RUT"] || "").trim();
        const nombre = String(row["NOMBRE"] || "").trim();
        const depto  = String(row["DEPARTAMENTO"] || "").trim();
        if (!rut) { stats.anual.skipped++; continue; }
        // Upsert worker so they appear in trabajadores
        await upsertWorker(rut, nombre, depto);
        stats.anual.inserted++;
      } catch {
        stats.anual.skipped++;
      }
    }

    // ── 3. Devueltos_fuera_de_plazo ───────────────────────────────────────────
    for (const row of rowsDev) {
      try {
        const rut     = String(row["RUN"] || row["RUT"] || "").trim();
        const nombre  = String(row["NOMBRE"] || "").trim();
        const depto   = String(row["DEPARTAMENTO"] || "").trim();
        const periodo = String(row["PERIODO"] || "").trim();
        const dosim   = String(row["Dosímetro"] || row["Dosimetro"] || "").trim();
        const fechaStr = row["Fecha de lectura"] ? String(row["Fecha de lectura"]).trim() : null;
        const alertaStr = String(row["¿Es alerta de dosis?"] || row["alerta"] || "NO").trim();
        const alerta  = alertaStr.toUpperCase() === "SI" || alertaStr.toUpperCase() === "SÍ";

        if (!rut || !periodo) { stats.devueltos_fp.skipped++; continue; }

        const pp = parsePeriodo(periodo);

        // Check duplicate
        const existing = await sql`
          SELECT id FROM dosimetria_devueltos_fuera_plazo
          WHERE rut=${rut} AND numero_dosimetro=${dosim} AND periodo=${periodo}
          LIMIT 1
        `;
        if (existing.rows.length) { stats.devueltos_fp.skipped++; continue; }

        await sql`
          INSERT INTO dosimetria_devueltos_fuera_plazo
            (rut, nombre, departamento, periodo, trimestre, anio, numero_dosimetro, fecha_lectura, alerta_dosis)
          VALUES (
            ${rut}, ${nombre}, ${depto}, ${periodo},
            ${pp?.trimestre ?? null}, ${pp?.anio ?? null},
            ${dosim || null}, ${fechaStr}, ${alerta}
          )
        `;
        stats.devueltos_fp.inserted++;
      } catch (e) {
        console.error("devueltos row error:", e);
        stats.devueltos_fp.skipped++;
      }
    }

    // ── 4. No_devueltos ───────────────────────────────────────────────────────
    for (const row of rowsNoDev) {
      try {
        // Columns: dosímetro, INSTITUCIÓN, UNIDAD, nombrepart, dcto(rut), tipod, dosímetro, trimestre_d, ¿extraviado?
        const rut    = String(row["dcto"] || row["RUT"] || row["rut"] || "").trim();
        const nombre = String(row["nombrepart"] || row["NOMBRE"] || "").trim();
        const depto  = String(row["UNIDAD"] || row["DEPARTAMENTO"] || "").trim();
        const dosim  = String(row["dosímetro"] || row["dosimetro"] || row["Dosímetro"] || "").trim();
        const tipo   = String(row["tipod"] || row["TIPOD"] || "I1").trim();
        const periodoStr = String(row["trimestre_d"] || row["PERIODO"] || "").trim();
        const exStr  = String(row["¿extraviado?"] || row["extraviado"] || "").trim();
        const extraviado = exStr.toUpperCase() === "SI" || exStr.toUpperCase() === "SÍ" || exStr === "1";

        if (!rut || !periodoStr) { stats.no_devueltos.skipped++; continue; }

        const pp = parsePeriodo(periodoStr);

        const existing = await sql`
          SELECT id FROM dosimetria_no_devueltos
          WHERE rut=${rut} AND numero_dosimetro=${dosim} AND periodo=${periodoStr}
          LIMIT 1
        `;
        if (existing.rows.length) { stats.no_devueltos.skipped++; continue; }

        await sql`
          INSERT INTO dosimetria_no_devueltos
            (rut, nombre, departamento, periodo, trimestre, anio, tipo_dosimetro, numero_dosimetro, extraviado)
          VALUES (
            ${rut}, ${nombre}, ${depto}, ${periodoStr},
            ${pp?.trimestre ?? null}, ${pp?.anio ?? null},
            ${tipo}, ${dosim || null}, ${extraviado}
          )
        `;
        stats.no_devueltos.inserted++;
      } catch (e) {
        console.error("no_devueltos row error:", e);
        stats.no_devueltos.skipped++;
      }
    }

    // ── 5. Lista_U2T (pending dosimeters awaiting delivery to workers) ─────────
    // These are dosimeters assigned but not yet sent — we upsert workers and log
    for (const row of rowsU2T) {
      try {
        const rut   = String(row["documento"] || row["dcto"] || row["RUT"] || "").trim();
        const nombre = String(row["nombrepart"] || row["NOMBRE"] || "").trim();
        const depto  = String(row["unidad"] || row["UNIDAD"] || "").trim();
        if (!rut) { stats.u2t.skipped++; continue; }
        await upsertWorker(rut, nombre, depto);
        stats.u2t.inserted++;
      } catch {
        stats.u2t.skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      archivo: file.name,
      hojas: sheetNames,
      stats,
    });
  } catch (e) {
    console.error("import-xls error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─── GET: return last import metadata ─────────────────────────────────────────
export async function GET() {
  try {
    await ensureTable();
    const result = await sql`
      SELECT
        COUNT(*) FILTER (WHERE fuente='xls') as xls_records,
        MAX(created_at) FILTER (WHERE fuente='xls') as ultima_importacion
      FROM dosimetria_registros
    `;
    return NextResponse.json(result.rows[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
