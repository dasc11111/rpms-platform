import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";
import { formatRut, rutMatchKey } from "@/lib/rut";

export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedDosimeterRow {
  rowIndex: number;
  raw_code: string;
  raw_rut: string;
  raw_name: string;
  raw_service: string;
  raw_type: string;
  code_normalized: string;
  rut_normalized: string;
  worker_matched: boolean;
  worker_id: number | null;
  worker_name_system: string | null;
  worker_name_report: string;
  service_system: string | null;
  dosimeter_exists: boolean;
  dosimeter_id: number | null;
  dosimeter_status: string | null;
  conflict: boolean;
  conflict_reason: string;
  resolution: "asignar" | "reasignar" | "crear_y_asignar" | "ya_asignado" | "sin_trabajador";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Extract dosimeter entries from raw PDF text.
 * Looks for lines containing a dosimeter code (XA-NNNN or similar) + RUT pattern.
 */
function parseDoximeterLines(text: string): { code: string; rut: string; name: string; service: string; type: string }[] {
  const results: { code: string; rut: string; name: string; service: string; type: string }[] = [];
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);

  // Pattern: code is XA followed by digits, or just a numeric code
  // RUT is Chilean: 7-9 digits + hyphen + digit/K
  const rutPattern = /\b(\d{7,9}-[\dKk])\b/;
  const codePattern = /\b(XA[-\s]?\d{3,6}|\d{4,6})\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const rutMatch = line.match(rutPattern);
    const codeMatch = line.match(codePattern);
    if (!rutMatch || !codeMatch) continue;

    const rut = rutMatch[1] ?? "";
    const code = codeMatch[1] ?? "";

    // Attempt to extract name: usually follows RUT or precedes it in same line
    // or is on the previous/next line if split
    let name = "";
    // Remove code and RUT from line, what remains may be name
    const remainder = line
      .replace(codeMatch[0] ?? "", "")
      .replace(rutMatch[0] ?? "", "")
      .replace(/\d{1,3}[.,]\d{3}[.,]\d{3}-[\dKk]/g, "")
      .replace(/[|;,\t]+/g, " ")
      .trim();
    name = remainder.replace(/\s{2,}/g, " ").trim();
    // Remove common noise
    name = name.replace(/^[-–—:]+/, "").replace(/[-–—:]+$/, "").trim();

    // Service: check surrounding lines for department/service info
    let service = "";
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
      if (j === i) continue;
      const ctx = (lines[j] ?? "").toLowerCase();
      if (ctx.includes("servicio") || ctx.includes("departamento") || ctx.includes("unidad")) {
        service = (lines[j] ?? "").replace(/servicio|departamento|unidad/gi, "").replace(/[:=]+/, "").trim();
        break;
      }
    }

    // Dosimeter type: TLD, OSL, film, cuerpo entero, extremidades
    let type = "cuerpo_entero";
    const lineLower = line.toLowerCase();
    if (lineLower.includes("tld") || lineLower.includes("termoluminiscente")) type = "tld";
    else if (lineLower.includes("osl")) type = "osl";
    else if (lineLower.includes("film")) type = "film";
    else if (lineLower.includes("extremidad") || lineLower.includes("muñeca") || lineLower.includes("dedo")) type = "extremidades";
    else if (lineLower.includes("cristalino") || lineLower.includes("ojo")) type = "cristalino";

    results.push({ code, rut, name, service, type });
  }

  return results;
}

// ─── POST: Preview ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, pagesText, fileName, fileHash, usedOcr, action } = body as {
      rawText: string;
      pagesText?: string[];
      fileName?: string;
      fileHash?: string;
      usedOcr?: boolean;
      action?: "preview" | "confirm";
      rows?: ParsedDosimeterRow[];
    };

    if (action === "confirm") {
      return handleConfirm(req, body);
    }

    // ── PREVIEW ──────────────────────────────────────────────────────────────
    await ensureDosimeterTables();

    const fullText = pagesText ? pagesText.join("\n") : rawText;
    const parsed = parseDoximeterLines(fullText);

    if (parsed.length === 0) {
      return NextResponse.json({
        ok: true,
        fileName,
        fileHash,
        usedOcr,
        rows: [],
        warnings: ["No se detectaron registros de dosímetros en el PDF. Verifica que el formato sea compatible."],
        errors: [],
        duplicateFile: false,
      });
    }

    // Check for duplicate file
    let duplicateFile = false;
    if (fileHash) {
      const { rows: existingDoc } = await sql`
        SELECT id FROM dosimetry_documents WHERE file_hash = ${fileHash} LIMIT 1
      `.catch(() => ({ rows: [] }));
      duplicateFile = existingDoc.length > 0;
    }

    // Load all workers and dosimeters for matching
    const { rows: workers } = await sql`
      SELECT id, rut, name, service, unit FROM workers WHERE status <> 'inactive'
    `;
    const { rows: dosimetersDb } = await sql`
      SELECT id, code, status, worker_rut, worker_name FROM dosimeters
    `;

    const workerByRut = new Map<string, typeof workers[0]>();
    const workerByName = new Map<string, typeof workers[0]>();
    for (const w of workers) {
      if (w.rut) workerByRut.set(rutMatchKey(String(w.rut)), w);
      if (w.name) workerByName.set(String(w.name).toLowerCase().trim(), w);
    }

    const dosimeterByCode = new Map<string, typeof dosimetersDb[0]>();
    for (const d of dosimetersDb) {
      dosimeterByCode.set(normalizeCode(String(d.code)), d);
    }

    const enrichedRows: ParsedDosimeterRow[] = parsed.map((p, i) => {
      const codeNorm = normalizeCode(p.code);
      const rutNorm = p.rut ? formatRut(p.rut) : "";
      const rutKey = rutNorm ? rutMatchKey(rutNorm) : "";

      // Match worker
      const workerByRutMatch = rutKey ? workerByRut.get(rutKey) : undefined;
      const workerByNameMatch = p.name ? workerByName.get(p.name.toLowerCase().trim()) : undefined;
      const matchedWorker = workerByRutMatch ?? workerByNameMatch ?? null;

      // Match dosimeter
      const existingDosimeter = dosimeterByCode.get(codeNorm) ?? null;

      let conflict = false;
      let conflictReason = "";
      let resolution: ParsedDosimeterRow["resolution"] = "asignar";

      if (!matchedWorker) {
        resolution = "sin_trabajador";
      } else if (existingDosimeter) {
        if (existingDosimeter.status === "asignado" && existingDosimeter.worker_rut) {
          const currentKey = rutMatchKey(String(existingDosimeter.worker_rut));
          const newKey = rutKey;
          if (currentKey === newKey) {
            resolution = "ya_asignado";
          } else {
            conflict = true;
            conflictReason = `Dosímetro asignado a ${existingDosimeter.worker_name ?? existingDosimeter.worker_rut}`;
            resolution = "reasignar";
          }
        } else {
          resolution = "asignar";
        }
      } else {
        resolution = "crear_y_asignar";
      }

      return {
        rowIndex: i,
        raw_code: p.code,
        raw_rut: p.rut,
        raw_name: p.name,
        raw_service: p.service,
        raw_type: p.type,
        code_normalized: codeNorm,
        rut_normalized: rutNorm,
        worker_matched: !!matchedWorker,
        worker_id: matchedWorker ? Number((matchedWorker as { id: unknown }).id) : null,
        worker_name_system: matchedWorker ? String((matchedWorker as { name: unknown }).name) : null,
        worker_name_report: p.name,
        service_system: matchedWorker ? String((matchedWorker as { service: unknown }).service ?? "") : null,
        dosimeter_exists: !!existingDosimeter,
        dosimeter_id: existingDosimeter ? Number((existingDosimeter as { id: unknown }).id) : null,
        dosimeter_status: existingDosimeter ? String((existingDosimeter as { status: unknown }).status) : null,
        conflict,
        conflict_reason: conflictReason,
        resolution,
      };
    });

    const warnings: string[] = [];
    const noWorker = enrichedRows.filter((r) => !r.worker_matched).length;
    const conflicts = enrichedRows.filter((r) => r.conflict).length;
    if (noWorker > 0) warnings.push(`${noWorker} registro(s) sin trabajador coincidente — edita el RUT/nombre para relacionarlos.`);
    if (conflicts > 0) warnings.push(`${conflicts} dosímetro(s) actualmente asignados a otro trabajador — serán reasignados.`);

    return NextResponse.json({
      ok: true,
      fileName,
      fileHash,
      usedOcr: !!usedOcr,
      duplicateFile,
      totalDetected: parsed.length,
      newDosimeters: enrichedRows.filter((r) => !r.dosimeter_exists).length,
      existingDosimeters: enrichedRows.filter((r) => r.dosimeter_exists).length,
      rows: enrichedRows,
      warnings,
      errors: [],
    });
  } catch (err) {
    console.error("[dosimeters/import-pdf POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Confirm handler ─────────────────────────────────────────────────────────

async function handleConfirm(_req: NextRequest, body: { rows?: ParsedDosimeterRow[]; uploadedBy?: string; fileHash?: string; fileName?: string }) {
  const { rows, uploadedBy, fileHash, fileName } = body;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No rows to process" }, { status: 400 });
  }

  await ensureDosimeterTables();

  let created = 0, assigned = 0, skipped = 0, errors = 0;
  const alerts: string[] = [];

  for (const row of rows) {
    if (row.resolution === "ya_asignado" || row.resolution === "sin_trabajador") {
      skipped++;
      continue;
    }

    try {
      if (row.resolution === "crear_y_asignar") {
        // Create dosimeter and assign
        const { rows: inserted } = await sql`
          INSERT INTO dosimeters (code, type, status, worker_rut, worker_name, service, delivery_date, estimated_return_date, updated_at)
          VALUES (
            ${row.code_normalized},
            ${row.raw_type ?? "cuerpo_entero"},
            'asignado',
            ${row.rut_normalized || null},
            ${(row.worker_name_system || row.worker_name_report) || null},
            ${(row.service_system || row.raw_service) || null},
            CURRENT_DATE,
            (CURRENT_DATE + INTERVAL '3 months')::date,
            now()
          )
          ON CONFLICT (code) DO UPDATE SET
            status = 'asignado',
            worker_rut = EXCLUDED.worker_rut,
            worker_name = EXCLUDED.worker_name,
            service = EXCLUDED.service,
            delivery_date = EXCLUDED.delivery_date,
            estimated_return_date = EXCLUDED.estimated_return_date,
            updated_at = now()
          RETURNING id
        `;
        if (inserted.length > 0) created++;
      } else if (row.resolution === "asignar" || row.resolution === "reasignar") {
        // Update existing dosimeter
        await sql`
          UPDATE dosimeters SET
            status = 'asignado',
            worker_rut = ${row.rut_normalized || null},
            worker_name = ${(row.worker_name_system || row.worker_name_report) || null},
            service = ${(row.service_system || row.raw_service) || null},
            delivery_date = COALESCE(delivery_date, CURRENT_DATE),
            estimated_return_date = COALESCE(estimated_return_date, (CURRENT_DATE + INTERVAL '3 months')::date),
            updated_at = now()
          WHERE id = ${row.dosimeter_id}
        `;
        assigned++;
      }
    } catch (e) {
      errors++;
      alerts.push(`Error en dosímetro ${row.code_normalized}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Record the import in dosimetry_documents if table exists
  if (fileHash) {
    await sql`
      INSERT INTO dosimetry_documents (file_name, file_hash, source_type, uploaded_by, record_count, created_at)
      VALUES (${fileName ?? "import-dosimeters.pdf"}, ${fileHash}, 'dosimeters_pdf', ${uploadedBy ?? "Sistema"}, ${rows.length}, now())
      ON CONFLICT DO NOTHING
    `.catch(() => { /* table may not exist yet */ });
  }

  return NextResponse.json({
    ok: true,
    created,
    assigned,
    skipped,
    errors,
    alerts,
  });
}
