import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";
import { formatRut, rutMatchKey } from "@/lib/rut";

export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedDosimeterRow {
  rowIndex: number;
  raw_code: string;
  raw_rut: string;
  raw_name: string;
  raw_service: string;
  raw_type: string;
  raw_delivery_date: string;
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
  // XA followed by digits: strip spaces/dashes between XA and number
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  return upper.replace(/^XA[-]?(\d+)$/, "XA$1");
}

function detectType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("tld") || t.includes("termoluminiscente")) return "tld";
  if (t.includes("osl")) return "osl";
  if (t.includes("film")) return "film";
  if (t.includes("extremidad") || t.includes("muñeca") || t.includes("dedo")) return "extremidades";
  if (t.includes("cristalino") || t.includes("ojo")) return "cristalino";
  return "cuerpo_entero";
}

// ── PDF text parser ───────────────────────────────────────────────────────────

function parsePdfLines(text: string): { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] {
  const results: { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] = [];
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);

  // XA code: XA optionally followed by dash/space then 3-6 digits
  const rutPattern = /\b(\d{7,9}-[\dKk])\b/;
  const codePattern = /\b(XA[-\s]?\d{3,6})\b/i;
  const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const rutMatch = line.match(rutPattern);
    const codeMatch = line.match(codePattern);
    if (!codeMatch) continue; // code is required; RUT can be on adjacent line

    const code = codeMatch[1] ?? "";

    // Try to find RUT on same line or adjacent lines (±2)
    let rut = rutMatch?.[1] ?? "";
    if (!rut) {
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
        if (j === i) continue;
        const m = (lines[j] ?? "").match(rutPattern);
        if (m) { rut = m[1] ?? ""; break; }
      }
    }

    const dateMatch = line.match(datePattern);
    const deliveryDate = dateMatch?.[1] ?? "";

    // Name: remove known fields from line
    const remainder = line
      .replace(codeMatch[0] ?? "", "")
      .replace(rutMatch?.[0] ?? "", "")
      .replace(dateMatch?.[0] ?? "", "")
      .replace(/[|;,\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const name = remainder.replace(/^[-–—:]+/, "").replace(/[-–—:]+$/, "").trim();

    // Service: check surrounding lines for department/service info
    let service = "";
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
      if (j === i) continue;
      const ctx = (lines[j] ?? "").toLowerCase();
      if (ctx.includes("servicio") || ctx.includes("departamento") || ctx.includes("unidad")) {
        service = (lines[j] ?? "").replace(/servicio|departamento|unidad/gi, "").replace(/[:=]+/, "").trim();
        break;
      }
    }

    results.push({ code, rut, name, service, type: detectType(line), deliveryDate });
  }

  return results;
}

// ── XLS/XLSX parser ───────────────────────────────────────────────────────────

function parseXlsxBuffer(buf: Buffer): { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] {
  // Dynamic require inside function to avoid SSR issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  const results: { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    for (const row of rows) {
      // Try to find the XA code in any column
      let code = "";
      let rut = "";
      let name = "";
      let service = "";
      let type = "cuerpo_entero";
      let deliveryDate = "";

      const codeRe = /^XA[-\s]?\d{3,6}$/i;
      const rutRe = /^\d{7,9}-[\dKk]$/;

      for (const [key, val] of Object.entries(row)) {
        const str = String(val ?? "").trim();
        const keyL = key.toLowerCase();

        if (!code && codeRe.test(str)) code = str;
        if (!code && codeRe.test(keyL)) code = keyL; // header might have the code
        if (!rut && rutRe.test(str.replace(/\./g, ""))) rut = str.replace(/\./g, "");

        if (!name && (keyL.includes("nombre") || keyL.includes("trabajador") || keyL.includes("apellido"))) {
          name = str;
        }
        if (!service && (keyL.includes("servicio") || keyL.includes("unidad") || keyL.includes("departamento"))) {
          service = str;
        }
        if (!type && (keyL.includes("tipo") || keyL.includes("dosimetro") || keyL.includes("dosímetro"))) {
          type = detectType(str);
        }
        if (!deliveryDate && (keyL.includes("entrega") || keyL.includes("fecha"))) {
          if (val instanceof Date) {
            deliveryDate = val.toISOString().split("T")[0] ?? "";
          } else if (str) {
            deliveryDate = str;
          }
        }
      }

      // If code not found in values, check each cell value more broadly
      if (!code) {
        for (const val of Object.values(row)) {
          const str = String(val ?? "").trim();
          if (codeRe.test(str)) { code = str; break; }
        }
      }
      if (!name) {
        // fall back to any string column that looks like a name (letters, >5 chars)
        for (const val of Object.values(row)) {
          const str = String(val ?? "").trim();
          if (/^[A-ZÁÉÍÓÚÜÑ ]{5,}$/i.test(str) && !codeRe.test(str) && !rutRe.test(str)) {
            name = str; break;
          }
        }
      }

      if (!code) continue; // skip rows with no XA code

      results.push({ code, rut, name, service, type, deliveryDate });
    }
  }

  return results;
}

// ─── Shared matching logic ────────────────────────────────────────────────────

async function enrichRows(
  parsed: { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[]
): Promise<ParsedDosimeterRow[]> {
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

  return parsed.map((p, i) => {
    const codeNorm = normalizeCode(p.code);
    const rutNorm = p.rut ? formatRut(p.rut) : "";
    const rutKey = rutNorm ? rutMatchKey(rutNorm) : "";

    const workerByRutMatch = rutKey ? workerByRut.get(rutKey) : undefined;
    const workerByNameMatch = p.name ? workerByName.get(p.name.toLowerCase().trim()) : undefined;
    const matchedWorker = workerByRutMatch ?? workerByNameMatch ?? null;

    const existingDosimeter = dosimeterByCode.get(codeNorm) ?? null;

    let conflict = false;
    let conflictReason = "";
    let resolution: ParsedDosimeterRow["resolution"] = "asignar";

    if (!matchedWorker) {
      resolution = "sin_trabajador";
    } else if (existingDosimeter) {
      if (existingDosimeter.status === "asignado" && existingDosimeter.worker_rut) {
        const currentKey = rutMatchKey(String(existingDosimeter.worker_rut));
        if (currentKey === rutKey) {
          resolution = "ya_asignado";
        } else {
          conflict = true;
          conflictReason = `Asignado a ${existingDosimeter.worker_name ?? existingDosimeter.worker_rut}`;
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
      raw_delivery_date: p.deliveryDate,
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
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // ── FormData branch (XLS/XLSX or PDF as binary) ───────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = formData.get("action") as string ?? "preview";
      const file = formData.get("file") as File | null;
      const provider = formData.get("provider") as string ?? "";

      if (action === "confirm") {
        const rowsRaw = formData.get("rows") as string ?? "[]";
        const rows: ParsedDosimeterRow[] = JSON.parse(rowsRaw);
        return handleConfirm({
          rows,
          uploadedBy: formData.get("uploadedBy") as string ?? "Usuario RPMS",
          fileHash: formData.get("fileHash") as string ?? "",
          fileName: file?.name ?? formData.get("fileName") as string ?? "",
          provider,
        });
      }

      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      await ensureDosimeterTables();

      const arrayBuffer = await file.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);

      // Hash
      let fileHash = "";
      try {
        const hashBuf = await crypto.subtle.digest("SHA-256", buf);
        fileHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch { /* ignore */ }

      // Duplicate check
      let duplicateFile = false;
      if (fileHash) {
        const { rows: existingDoc } = await sql`
          SELECT id FROM dosimetry_documents WHERE file_hash = ${fileHash} LIMIT 1
        `.catch(() => ({ rows: [] }));
        duplicateFile = existingDoc.length > 0;
      }

      const name = file.name.toLowerCase();
      let parsed: { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] = [];

      if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
        parsed = parseXlsxBuffer(buf);
      } else {
        // PDF: convert buffer to text via pdfjs (not available server-side, so text must be passed separately)
        // This path is used only if caller sends multipart with pdf file — in that case expect rawText field too
        const rawText = formData.get("rawText") as string ?? "";
        parsed = parsePdfLines(rawText);
      }

      if (parsed.length === 0) {
        return NextResponse.json({
          ok: true,
          fileName: file.name,
          fileHash,
          duplicateFile,
          rows: [],
          warnings: ["No se detectaron registros con código XA en el archivo. Verifica que el formato sea compatible."],
          errors: [],
        });
      }

      const enrichedRows = await enrichRows(parsed);
      return buildPreviewResponse(enrichedRows, file.name, fileHash, false, duplicateFile);
    }

    // ── JSON branch (PDF text from client + action) ────────────────────────────
    const body = await req.json() as {
      rawText?: string;
      pagesText?: string[];
      fileName?: string;
      fileHash?: string;
      usedOcr?: boolean;
      action?: "preview" | "confirm";
      rows?: ParsedDosimeterRow[];
      provider?: string;
      uploadedBy?: string;
    };

    if (body.action === "confirm") {
      return handleConfirm({
        rows: body.rows ?? [],
        uploadedBy: body.uploadedBy ?? "Usuario RPMS",
        fileHash: body.fileHash ?? "",
        fileName: body.fileName ?? "",
        provider: body.provider ?? "",
      });
    }

    // Preview from JSON (PDF text extraction happened client-side)
    await ensureDosimeterTables();

    const fullText = body.pagesText ? body.pagesText.join("\n") : (body.rawText ?? "");
    const parsed = parsePdfLines(fullText);

    if (parsed.length === 0) {
      return NextResponse.json({
        ok: true,
        fileName: body.fileName,
        fileHash: body.fileHash,
        usedOcr: body.usedOcr,
        rows: [],
        warnings: ["No se detectaron códigos XA en el PDF. Verifica que el formato sea compatible."],
        errors: [],
        duplicateFile: false,
      });
    }

    let duplicateFile = false;
    if (body.fileHash) {
      const { rows: existingDoc } = await sql`
        SELECT id FROM dosimetry_documents WHERE file_hash = ${body.fileHash} LIMIT 1
      `.catch(() => ({ rows: [] }));
      duplicateFile = existingDoc.length > 0;
    }

    const enrichedRows = await enrichRows(parsed);
    return buildPreviewResponse(enrichedRows, body.fileName ?? "", body.fileHash ?? "", !!body.usedOcr, duplicateFile);

  } catch (err) {
    console.error("[dosimeters/import POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Build preview response ───────────────────────────────────────────────────

function buildPreviewResponse(
  rows: ParsedDosimeterRow[],
  fileName: string,
  fileHash: string,
  usedOcr: boolean,
  duplicateFile: boolean
) {
  const warnings: string[] = [];
  const noWorker = rows.filter((r) => !r.worker_matched).length;
  const conflicts = rows.filter((r) => r.conflict).length;
  if (noWorker > 0) warnings.push(`${noWorker} registro(s) sin trabajador coincidente — edita el RUT/nombre para relacionarlos.`);
  if (conflicts > 0) warnings.push(`${conflicts} dosímetro(s) actualmente asignado(s) a otro trabajador — serán reasignados.`);

  return NextResponse.json({
    ok: true,
    fileName,
    fileHash,
    usedOcr,
    duplicateFile,
    totalDetected: rows.length,
    newDosimeters: rows.filter((r) => !r.dosimeter_exists).length,
    existingDosimeters: rows.filter((r) => r.dosimeter_exists).length,
    rows,
    warnings,
    errors: [],
  });
}

// ─── Confirm handler ─────────────────────────────────────────────────────────

async function handleConfirm(params: {
  rows: ParsedDosimeterRow[];
  uploadedBy: string;
  fileHash: string;
  fileName: string;
  provider?: string;
}) {
  const { rows, uploadedBy, fileHash, fileName } = params;
  if (!rows.length) return NextResponse.json({ ok: false, error: "No rows to process" }, { status: 400 });

  await ensureDosimeterTables();

  let created = 0, assigned = 0, skipped = 0, errors = 0;
  const alerts: string[] = [];

  for (const row of rows) {
    if (row.resolution === "ya_asignado" || row.resolution === "sin_trabajador") {
      skipped++;
      continue;
    }

    // Use edited values: code_normalized may have been patched by client
    const codeToUse = normalizeCode(row.raw_code || row.code_normalized);
    const rutToUse = row.rut_normalized || (row.raw_rut ? formatRut(row.raw_rut) : null);
    const nameToUse = (row.worker_name_system || row.worker_name_report) || null;
    const serviceToUse = (row.service_system || row.raw_service) || null;
    const typeToUse = row.raw_type || "cuerpo_entero";
    const deliveryDate = row.raw_delivery_date || null;

    try {
      if (row.resolution === "crear_y_asignar") {
        await sql`
          INSERT INTO dosimeters (code, type, status, worker_rut, worker_name, service, delivery_date, estimated_return_date, updated_at)
          VALUES (
            ${codeToUse},
            ${typeToUse},
            'asignado',
            ${rutToUse},
            ${nameToUse},
            ${serviceToUse},
            ${deliveryDate ? sql`${deliveryDate}::date` : sql`CURRENT_DATE`},
            ${deliveryDate ? sql`(${deliveryDate}::date + INTERVAL '3 months')` : sql`(CURRENT_DATE + INTERVAL '3 months')::date`},
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
        `;
        created++;
      } else if (row.resolution === "asignar" || row.resolution === "reasignar") {
        await sql`
          UPDATE dosimeters SET
            status = 'asignado',
            worker_rut = ${rutToUse},
            worker_name = ${nameToUse},
            service = ${serviceToUse},
            delivery_date = ${deliveryDate ? sql`${deliveryDate}::date` : sql`COALESCE(delivery_date, CURRENT_DATE)`},
            estimated_return_date = COALESCE(estimated_return_date, (CURRENT_DATE + INTERVAL '3 months')::date),
            updated_at = now()
          WHERE id = ${row.dosimeter_id}
        `;
        assigned++;
      }
    } catch (e) {
      errors++;
      alerts.push(`Error en ${codeToUse}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (fileHash) {
    await sql`
      INSERT INTO dosimetry_documents (file_name, file_hash, source_type, uploaded_by, record_count, created_at)
      VALUES (${fileName || "import-dosimeters"}, ${fileHash}, 'dosimeters_import', ${uploadedBy}, ${rows.length}, now())
      ON CONFLICT DO NOTHING
    `.catch(() => { /* table may not exist */ });
  }

  return NextResponse.json({ ok: true, created, assigned, skipped, errors, alerts });
}
