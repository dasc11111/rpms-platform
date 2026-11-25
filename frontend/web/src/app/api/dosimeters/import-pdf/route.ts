import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";
import { formatRut, rutMatchKey } from "@/lib/rut";
import * as XLSX from "xlsx";

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
  // XA followed by alphanumeric (Sievert format: XA04400483L, XA04400400Z, etc.)
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  // Strip optional dash/space between XA and the alphanumeric code
  return upper.replace(/^XA[-\s]?/, "XA");
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
//
// STRATEGY: Positional index matching (definitive approach)
//
// PDF.js does NOT guarantee row-by-row extraction for multi-column tables.
// It may extract column-by-column, meaning all XA codes appear together,
// all names appear together, all RUTs appear together — in document order.
//
// Solution: collect each data type into its own ordered array, then zip by index.
//   xaCodes[0]  → ruts[0]  → names[0]  → dates[0]
//   xaCodes[1]  → ruts[1]  → names[1]  → dates[1]
//   ...
//
// This works regardless of whether PDF.js extracts row-by-row or column-by-column.

function parsePdfLines(text: string): { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] {

  // ── Patterns ────────────────────────────────────────────────────────────────
  const rutPattern = /\b(\d{7,9}-[\dKk])\b/;
  const codePattern = /\b(XA[A-Z0-9]{4,15})\b/i;
  const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
  // Single ALL-CAPS word (2+ letters). We group consecutive ones into full names.
  const capsWordPattern = /^[A-ZÁÉÍÓÚÜÑ]{2,}$/;

  // Known header/label/column words to skip
  // This covers: column headers, Sievert-specific labels, medical service names,
  // period labels, type values, and other non-name vocabulary.
  const headerWords = new Set([
    // Column headers (Sievert Lista de Envío)
    "codigo", "participante", "nombre", "documento", "tipo",
    "dosimetro", "firma", "fecha", "entrega", "rut", "run",
    "servicio", "unidad", "departamento", "area", "seccion",
    "envio", "lista", "hospital", "clinica", "centro", "laboratorio",
    // Sievert-specific labels found in TIPO / CLIENTE columns
    "cliente", "uso", "personal", "profesional", "externo", "interno",
    // Period/time labels (AÑO MES column)
    "ano", "mes", "trimestre", "semestre", "periodo", "año",
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    // Dosimeter type labels
    "entero", "cuerpo", "extremidades", "extremidad", "cristalino",
    "tld", "osl", "film",
    // Chilean hospital services / specialties (common in service column)
    "cardiologia", "radiologia", "oncologia", "urologia", "ginecologia",
    "obstetricia", "pediatria", "neurologia", "traumatologia", "cirugia",
    "medicina", "nuclear", "interna", "general", "urgencias", "urgencia",
    "uci", "ucc", "upc", "pabellones", "pabellon", "pabellon",
    "laboratorio", "anatomia", "patologica", "imagenologia", "ecografia",
    "scanner", "resonancia", "magnetica", "rayos", "tomografia",
    "hemato", "hematologia", "nefrologia", "endocrinologia", "reumatologia",
    "infectologia", "psiquiatria", "dermatologia", "oftalmologia",
    "otorrinolaringologia", "orl", "gastroenterologia", "broncopulmonar",
    "neonatologia", "maternidad", "neonato", "fisioterapia", "kinesiologia",
    "dental", "odontologia", "farmacia", "nutricion", "fonoaudiologia",
    "dental", "odontologia", "dental", "servicio", "unidad", "seccion",
    "departamento",
    // Generic document labels
    "firma", "receptor", "entregado", "recibido", "observaciones",
    "observacion", "total", "subtotal", "pagina", "folio",
    // Sievert company / address words that may appear
    "sievert", "ltda", "spa", "contrato", "control", "dosimetria",
    "dosimetrico", "monitoreo", "radiacion", "radiaciones", "ionizante",
  ]);

  function normalizeWord(w: string): string {
    return w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  }

  // ── Tokenise ─────────────────────────────────────────────────────────────────
  // PDF.js joins text items with "\n". Each line is one token.
  const tokens = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // ── Pass 1: collect all XA codes, RUTs, dates in document order ─────────────
  const xaCodes: string[] = [];
  const ruts: string[] = [];
  const dates: string[] = [];

  for (const tok of tokens) {
    const cm = tok.match(codePattern);
    if (cm) { xaCodes.push(cm[1]!); continue; }

    const rm = tok.match(rutPattern);
    if (rm) { ruts.push(rm[1]!); continue; }

    const dm = tok.match(datePattern);
    if (dm) { dates.push(dm[1]!); }
  }

  if (xaCodes.length === 0) return [];

  // ── Pass 2: build frequency map to detect repeated labels ───────────────────
  // Any ALL-CAPS word appearing more than once per XA code on average is a label.
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    if (capsWordPattern.test(tok)) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
  }
  const repeatThreshold = Math.max(3, xaCodes.length); // at least 3, or once per row
  const repeatedLabels = new Set<string>(
    [...freq.entries()].filter(([, c]) => c > repeatThreshold).map(([w]) => w)
  );

  function isNameToken(tok: string): boolean {
    if (!capsWordPattern.test(tok)) return false;
    if (repeatedLabels.has(tok)) return false;
    if (headerWords.has(normalizeWord(tok))) return false;
    return true;
  }

  // ── Pass 3: collect name groups in document order ───────────────────────────
  // A "name group" is a maximal run of consecutive ALL-CAPS words that look like
  // name tokens. We walk the token list and whenever we hit a run of ≥1 name
  // tokens bounded by non-name tokens, we emit the joined group.
  const nameGroups: string[] = [];
  let currentGroup: string[] = [];

  function flushGroup() {
    // Require at least 2 words: Chilean names always have paternal + maternal surname
    // (or first name + surname). Single ALL-CAPS words are almost never real names
    // but instead service labels (CARDIOLOGIA), type labels (CLIENTE), etc.
    if (currentGroup.length >= 2) {
      nameGroups.push(currentGroup.slice(0, 5).join(" "));
    }
    currentGroup = [];
  }

  for (const tok of tokens) {
    // Skip tokens that are XA codes, RUTs, or dates — they break name runs
    if (codePattern.test(tok) || rutPattern.test(tok) || datePattern.test(tok)) {
      flushGroup();
      continue;
    }
    if (isNameToken(tok)) {
      currentGroup.push(tok);
    } else {
      flushGroup();
    }
  }
  flushGroup();

  // ── Pass 4: zip by index ────────────────────────────────────────────────────
  // Each XA code corresponds to the name and RUT at the same position in their
  // respective arrays (since all three are extracted in document/column order).
  const results: { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] = [];

  for (let i = 0; i < xaCodes.length; i++) {
    const code = xaCodes[i] ?? "";
    const rut = ruts[i] ?? "";
    const name = nameGroups[i] ?? "";
    const deliveryDate = dates[i] ?? "";

    // Diagnostic log — visible in Vercel runtime logs
    console.error(`[PDF-PARSE] row ${i}: code=${code} rut=${rut} name="${name}" date=${deliveryDate}`);

    results.push({ code, rut, name, service: "", type: "cuerpo_entero", deliveryDate });
  }

  // ── Fallback: if index-matching yielded all empty names, try window approach ─
  // (Handles row-by-row PDFs where the index approach would mis-align)
  const anyName = results.some((r) => r.name.length > 0);
  if (!anyName && results.length > 0) {
    console.error("[PDF-PARSE] Index matching yielded no names — falling back to window approach");
    return parsePdfLinesWindow(text);
  }

  return results;
}

// ── Fallback window-based parser (for row-by-row PDFs) ──────────────────────
function parsePdfLinesWindow(text: string): { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] {
  const results: { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] = [];
  const rutPattern = /\b(\d{7,9}-[\dKk])\b/;
  const codePattern = /\b(XA[A-Z0-9]{4,15})\b/i;
  const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
  const nameTokenPattern = /^[A-ZÁÉÍÓÚÜÑ]{2,}(?:[\s\-][A-ZÁÉÍÓÚÜÑ]{2,})*$/;
  const headerWords = new Set([
    "codigo", "participante", "nombre", "documento", "tipo",
    "dosimetro", "dosimetro", "firma", "fecha", "entrega", "rut", "run",
    "servicio", "unidad", "departamento", "area", "seccion", "seccion",
  ]);

  const tokens = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const codePositions: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (codePattern.test(tokens[i] ?? "")) codePositions.push(i);
  }
  if (codePositions.length === 0) return results;

  const tokenFrequency = new Map<string, number>();
  for (const tok of tokens) {
    if (nameTokenPattern.test(tok)) tokenFrequency.set(tok, (tokenFrequency.get(tok) ?? 0) + 1);
  }
  const repeatedLabels = new Set<string>(
    [...tokenFrequency.entries()].filter(([, c]) => c > 3).map(([t]) => t)
  );

  function normalizeWord(w: string): string {
    return w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  }

  const usedRutPositions = new Set<number>();
  for (let ci = 0; ci < codePositions.length; ci++) {
    const codeIdx = codePositions[ci]!;
    const codeMatch = (tokens[codeIdx] ?? "").match(codePattern);
    if (!codeMatch) continue;
    const code = codeMatch[1] ?? "";

    const prevCodeIdx = ci > 0 ? (codePositions[ci - 1]! + 1) : Math.max(0, codeIdx - 20);
    const nextCodeIdx = ci < codePositions.length - 1 ? (codePositions[ci + 1]! - 1) : Math.min(tokens.length - 1, codeIdx + 20);

    let rut = "", rutIdx = -1, bestDist = Infinity;
    for (let j = prevCodeIdx; j <= nextCodeIdx; j++) {
      if (usedRutPositions.has(j)) continue;
      const m = (tokens[j] ?? "").match(rutPattern);
      if (m && Math.abs(j - codeIdx) < bestDist) {
        bestDist = Math.abs(j - codeIdx); rut = m[1] ?? ""; rutIdx = j;
      }
    }
    if (rutIdx >= 0) usedRutPositions.add(rutIdx);

    let deliveryDate = "";
    for (let j = prevCodeIdx; j <= nextCodeIdx; j++) {
      const m = (tokens[j] ?? "").match(datePattern);
      if (m) { deliveryDate = m[1] ?? ""; break; }
    }

    const nameParts: string[] = [];
    for (let j = prevCodeIdx; j <= nextCodeIdx; j++) {
      if (j === codeIdx || j === rutIdx) continue;
      const tok = (tokens[j] ?? "").trim();
      if (!tok || tok.length < 2) continue;
      if (codePattern.test(tok) || rutPattern.test(tok) || datePattern.test(tok)) continue;
      const norm = normalizeWord(tok);
      if (headerWords.has(norm)) continue;
      if (repeatedLabels.has(tok)) continue;
      if (!nameTokenPattern.test(tok)) continue;
      nameParts.push(tok);
    }
    const name = nameParts.slice(0, 5).join(" ").trim();
    results.push({ code, rut, name, service: "", type: "cuerpo_entero", deliveryDate });
  }
  return results;
}

// ── XLS/XLSX parser ───────────────────────────────────────────────────────────

function parseXlsxBuffer(buf: Uint8Array): { code: string; rut: string; name: string; service: string; type: string; deliveryDate: string }[] {
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

      const codeRe = /^XA[A-Z0-9]{4,15}$/i;
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
      const buf = new Uint8Array(arrayBuffer);

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
      quarter?: "T1" | "T2" | "T3" | "T4";
      year?: number;
    };

    if (body.action === "confirm") {
      return handleConfirm({
        rows: body.rows ?? [],
        uploadedBy: body.uploadedBy ?? "Usuario RPMS",
        fileHash: body.fileHash ?? "",
        fileName: body.fileName ?? "",
        provider: body.provider ?? "",
        quarter: body.quarter,
        year: body.year,
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
  quarter?: "T1" | "T2" | "T3" | "T4";
  year?: number;
}) {
  const { rows, uploadedBy, fileHash, fileName, quarter, year } = params;
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
    // Parse delivery date to ISO string for safe passing to Postgres
    const deliveryDateStr: string | null = row.raw_delivery_date
      ? (() => {
          // Accept DD/MM/YYYY, DD-MM-YYYY or ISO YYYY-MM-DD
          const d = row.raw_delivery_date.trim();
          const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (isoMatch) return d;
          const dmyMatch = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
          if (dmyMatch) {
            const [, day, month, year] = dmyMatch;
            const y = year!.length === 2 ? `20${year}` : year;
            return `${y}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
          }
          return null;
        })()
      : null;

    try {
      const quarterVal = quarter ?? null;
      const yearVal = year ?? null;

      if (row.resolution === "crear_y_asignar") {
        if (deliveryDateStr) {
          await sql`
            INSERT INTO dosimeters (code, type, status, worker_rut, worker_name, service, delivery_date, estimated_return_date, quarter, period_year, updated_at)
            VALUES (
              ${codeToUse}, ${typeToUse}, 'asignado',
              ${rutToUse}, ${nameToUse}, ${serviceToUse},
              ${deliveryDateStr}::date,
              (${deliveryDateStr}::date + INTERVAL '3 months')::date,
              ${quarterVal}, ${yearVal},
              now()
            )
            ON CONFLICT (code) DO UPDATE SET
              status = 'asignado', worker_rut = EXCLUDED.worker_rut,
              worker_name = EXCLUDED.worker_name, service = EXCLUDED.service,
              delivery_date = EXCLUDED.delivery_date,
              estimated_return_date = EXCLUDED.estimated_return_date,
              quarter = EXCLUDED.quarter, period_year = EXCLUDED.period_year,
              updated_at = now()
          `;
        } else {
          await sql`
            INSERT INTO dosimeters (code, type, status, worker_rut, worker_name, service, delivery_date, estimated_return_date, quarter, period_year, updated_at)
            VALUES (
              ${codeToUse}, ${typeToUse}, 'asignado',
              ${rutToUse}, ${nameToUse}, ${serviceToUse},
              CURRENT_DATE,
              (CURRENT_DATE + INTERVAL '3 months')::date,
              ${quarterVal}, ${yearVal},
              now()
            )
            ON CONFLICT (code) DO UPDATE SET
              status = 'asignado', worker_rut = EXCLUDED.worker_rut,
              worker_name = EXCLUDED.worker_name, service = EXCLUDED.service,
              delivery_date = EXCLUDED.delivery_date,
              estimated_return_date = EXCLUDED.estimated_return_date,
              quarter = EXCLUDED.quarter, period_year = EXCLUDED.period_year,
              updated_at = now()
          `;
        }
        created++;
      } else if (row.resolution === "asignar" || row.resolution === "reasignar") {
        if (deliveryDateStr) {
          await sql`
            UPDATE dosimeters SET
              status = 'asignado',
              worker_rut = ${rutToUse},
              worker_name = ${nameToUse},
              service = ${serviceToUse},
              delivery_date = ${deliveryDateStr}::date,
              estimated_return_date = COALESCE(estimated_return_date, (CURRENT_DATE + INTERVAL '3 months')::date),
              quarter = ${quarterVal}, period_year = ${yearVal},
              updated_at = now()
            WHERE id = ${row.dosimeter_id}
          `;
        } else {
          await sql`
            UPDATE dosimeters SET
              status = 'asignado',
              worker_rut = ${rutToUse},
              worker_name = ${nameToUse},
              service = ${serviceToUse},
              delivery_date = COALESCE(delivery_date, CURRENT_DATE),
              estimated_return_date = COALESCE(estimated_return_date, (CURRENT_DATE + INTERVAL '3 months')::date),
              quarter = ${quarterVal}, period_year = ${yearVal},
              updated_at = now()
            WHERE id = ${row.dosimeter_id}
          `;
        }
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
