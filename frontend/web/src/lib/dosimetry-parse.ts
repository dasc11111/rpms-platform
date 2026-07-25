// Dosimetry PDF/text report parser.
// Given raw text (either extracted directly from a digital PDF or produced by
// OCR from a scanned PDF), this module extracts the relevant fields described
// in the "Importacion de reportes PDF" specification: institution, department,
// period/year/quarter, worker name/RUN, dosimeter number/type, radiation type,
// process, Hp(10)/Hp(3)/Hp(0.07) doses and accumulated doses (annual/12m/60m).
//
// The parser works on a per-page basis (each page of the source PDF is
// expected to hold one or more complete worker records) so that values never
// bleed across unrelated pages. It also reconciles the quarter/period across
// the whole document when a given page/record does not restate it explicitly
// next to the worker (many providers print the period once per page and the
// worker's own block does not repeat it), and it discards RUNs that repeat far
// more often than any real worker could (institutional RUT or a responsible
// officer's signature block printed on every page).

export type ParsedDoseRow = {
  worker_run: string;
  worker_name: string;
  institucion: string;
  departamento: string;
  year: number | null;
  quarter: number | null;
  period_label: string;
  dosimeter_number: string;
  dosimeter_type: string;
  radiation_type: string;
  proceso: string;
  hp10: number | null;
  hp3: number | null;
  hp007: number | null;
  accum_year_body: number | null;
  accum_12m_body: number | null;
  accum_60m_body: number | null;
  raw_block: string;
};

export type ParseResult = {
  rows: ParsedDoseRow[];
  workersDetected: number;
  periodsIdentified: string[];
  quartersIdentified: number[];
  errors: string[];
  warnings: string[];
};

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const QUARTER_WORDS: Record<string, number> = {
  PRIMER: 1,
  PRIMERO: 1,
  SEGUNDO: 2,
  TERCER: 3,
  TERCERO: 3,
  CUARTO: 4,
};

function findNumberNear(text: string, label: RegExp, window = 60): number | null {
  const re = new RegExp(label.source, label.flags.includes("i") ? "i" : "");
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const slice = text.slice(start, start + window);
  const numMatch = slice.match(/-?\d+[.,]?\d*/);
  if (!numMatch) return null;
  const n = Number(numMatch[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function findValueNear(text: string, label: RegExp, window = 80): string {
  const re = new RegExp(label.source, label.flags.includes("i") ? "i" : "");
  const m = re.exec(text);
  if (!m) return "";
  const start = m.index + m[0].length;
  const slice = text.slice(start, start + window);
  const valMatch = slice.match(/[:\-]?\s*([^\n\r]{1,60})/);
  return valMatch ? (valMatch[1] ?? "").trim() : "";
}

function detectPeriods(block: string): { year: number; quarter: number; label: string }[] {
  const found: { year: number; quarter: number; label: string }[] = [];
  let m: RegExpExecArray | null;

  const re1 = /T\s*([1-4])\s*[-\/]\s*(\d{4})/gi;
  while ((m = re1.exec(block))) {
    found.push({ quarter: Number(m[1]), year: Number(m[2]), label: "T" + m[1] + "-" + m[2] });
  }

  const re2 = /(\d{4})\s*[-\/]\s*T\s*([1-4])/gi;
  while ((m = re2.exec(block))) {
    found.push({ quarter: Number(m[2]), year: Number(m[1]), label: "T" + m[2] + "-" + m[1] });
  }

  const normed = norm(block);
  const re3 = /(PRIMER|SEGUNDO|TERCER)O?\s+TRIMESTRE[^\d]{0,20}(\d{4})/g;
  while ((m = re3.exec(normed))) {
    const key = m[1] ?? "";
    const q = QUARTER_WORDS[key];
    if (q) found.push({ quarter: q, year: Number(m[2]), label: "T" + q + "-" + m[2] });
  }
  const re4 = /CUARTO\s+TRIMESTRE[^\d]{0,20}(\d{4})/g;
  while ((m = re4.exec(normed))) {
    found.push({ quarter: 4, year: Number(m[1]), label: "T4-" + m[1] });
  }

  const seen = new Set<string>();
  return found.filter((f) => {
    if (!f.year || !f.quarter) return false;
    const key = f.year + "-" + f.quarter;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Chilean RUT/RUN pattern, e.g. 12.345.678-9 or 12345678-9.
const RUN_PATTERN = /\b(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])\b/g;

function parsePageSegments(pageText: string): { run: string; block: string }[] {
  const text = pageText;
  const runMatches: { run: string; index: number }[] = [];
  const runRe = new RegExp(RUN_PATTERN.source, "g");
  let rm: RegExpExecArray | null;
  while ((rm = runRe.exec(text))) {
    runMatches.push({ run: rm[1] ?? "", index: rm.index });
  }

  const segments: { run: string; block: string }[] = [];
  if (runMatches.length > 0) {
    for (let i = 0; i < runMatches.length; i++) {
      const current = runMatches[i];
      if (!current) continue;
      const next = runMatches[i + 1];
      const end = next ? next.index : text.length;
      segments.push({ run: current.run, block: text.slice(current.index, end) });
    }
  }
  return segments;
}

function extractRowFromBlock(run: string, block: string): ParsedDoseRow & { hasPeriod: boolean } {
  const periods = detectPeriods(block);

  const nombre = findValueNear(block, /NOMBRE(?:\s+DEL?\s+TRABAJADOR)?/i);
  const institucion = findValueNear(block, /INSTITUCI[OÓ]N/i);
  const departamento = findValueNear(block, /DEPARTAMENTO/i);
  const dosimeterNumber = findValueNear(block, /N[UÚ]MERO\s+DE\s+DOS[IÍ]METRO|N[°º]\s*DOS[IÍ]METRO/i);
  const dosimeterType = findValueNear(block, /TIPO\s+DE\s+DOS[IÍ]METRO/i);
  const radiationType = findValueNear(block, /TIPO\s+DE\s+RADIACI[OÓ]N/i);
  const proceso = findValueNear(block, /PROCESO/i);

  const hp10 = findNumberNear(block, /HP\s*\(?\s*10\s*\)?/i);
  const hp3 = findNumberNear(block, /HP\s*\(?\s*3\s*\)?/i);
  const hp007 = findNumberNear(block, /HP\s*\(?\s*0[.,]?\s*07\s*\)?/i);
  const accumYear = findNumberNear(block, /ACUMULAD[OA]S?\s+ANUAL(?:ES)?/i);
  const accum12 = findNumberNear(block, /ACUMULAD[OA]S?\s+(?:[UÚ]LTIMOS?\s+)?12\s+MESES/i);
  const accum60 = findNumberNear(block, /ACUMULAD[OA]S?\s+(?:[UÚ]LTIMOS?\s+)?60\s+MESES/i);

  const p = periods[0] || null;

  return {
    worker_run: run,
    worker_name: nombre,
    institucion,
    departamento,
    year: p ? p.year : null,
    quarter: p ? p.quarter : null,
    period_label: p ? p.label : "",
    dosimeter_number: dosimeterNumber,
    dosimeter_type: dosimeterType,
    radiation_type: radiationType,
    proceso,
    hp10,
    hp3,
    hp007,
    accum_year_body: accumYear,
    accum_12m_body: accum12,
    accum_60m_body: accum60,
    raw_block: block.slice(0, 800),
    hasPeriod: periods.length > 0,
  };
}

export function parseDosimetryReport(pagesTextInput: string[] | string): ParseResult {
  const pagesText = Array.isArray(pagesTextInput) ? pagesTextInput : [pagesTextInput];
  const errors: string[] = [];
  const warnings: string[] = [];

  const fullText = pagesText.join("\n").replace(/\r/g, "");
  if (!fullText || fullText.trim().length < 20) {
    errors.push("No se pudo extraer texto del documento (posiblemente escaneado sin OCR, o vacio).");
    return { rows: [], workersDetected: 0, periodsIdentified: [], quartersIdentified: [], errors, warnings };
  }

  // Document-wide period detection, used as a fallback for records/pages that
  // do not explicitly restate the period next to the worker's data.
  const docPeriods = detectPeriods(fullText);
  const docPeriodCount = new Map<string, { count: number; year: number; quarter: number }>();
  for (const p of docPeriods) {
    const key = p.label;
    const cur = docPeriodCount.get(key);
    if (cur) cur.count++;
    else docPeriodCount.set(key, { count: 1, year: p.year, quarter: p.quarter });
  }
  let dominantPeriod: { year: number; quarter: number; label: string } | null = null;
  let bestCount = 0;
  for (const [label, v] of docPeriodCount.entries()) {
    if (v.count > bestCount) {
      bestCount = v.count;
      dominantPeriod = { year: v.year, quarter: v.quarter, label };
    }
  }
  const distinctPeriods = docPeriodCount.size;

  const rawRows: (ParsedDoseRow & { hasPeriod: boolean })[] = [];

  for (const pageText of pagesText) {
    const text = (pageText || "").replace(/\r/g, "");
    if (!text || text.trim().length < 10) continue;
    const segments = parsePageSegments(text);
    for (const seg of segments) {
      if (!seg.run) continue;
      rawRows.push(extractRowFromBlock(seg.run, seg.block));
    }
  }

  if (rawRows.length === 0) {
    errors.push("No se identifico ningun RUN en el documento.");
    return { rows: [], workersDetected: 0, periodsIdentified: [], quartersIdentified: [], errors, warnings };
  }

  // Filter out RUNs that repeat far more often than any legitimate worker
  // could (typically an institutional RUT, or the responsible officer's
  // signature block, printed on every page) - these are not worker records.
  const runFreq = new Map<string, number>();
  for (const r of rawRows) runFreq.set(r.worker_run, (runFreq.get(r.worker_run) || 0) + 1);
  const noiseThreshold = Math.max(6, distinctPeriods * 4, Math.ceil(pagesText.length * 0.3));
  const noisyRuns = new Set<string>();
  for (const [run, count] of runFreq.entries()) {
    if (count > noiseThreshold) noisyRuns.add(run);
  }

  let excludedNoise = 0;
  let filledFromDocPeriod = 0;
  let stillMissingPeriod = 0;

  const rows: ParsedDoseRow[] = [];
  const periodsSet = new Set<string>();
  const quartersSet = new Set<number>();
  const workerRuns = new Set<string>();

  for (const r of rawRows) {
    if (noisyRuns.has(r.worker_run)) {
      excludedNoise++;
      continue;
    }
    workerRuns.add(r.worker_run);

    let year = r.year;
    let quarter = r.quarter;
    let period_label = r.period_label;

    if (!r.hasPeriod && dominantPeriod) {
      year = dominantPeriod.year;
      quarter = dominantPeriod.quarter;
      period_label = dominantPeriod.label;
      filledFromDocPeriod++;
    } else if (!r.hasPeriod) {
      stillMissingPeriod++;
    }

    if (period_label) {
      periodsSet.add(period_label);
      if (quarter) quartersSet.add(quarter);
    }

    rows.push({
      worker_run: r.worker_run,
      worker_name: r.worker_name,
      institucion: r.institucion,
      departamento: r.departamento,
      year,
      quarter,
      period_label,
      dosimeter_number: r.dosimeter_number,
      dosimeter_type: r.dosimeter_type,
      radiation_type: r.radiation_type,
      proceso: r.proceso,
      hp10: r.hp10,
      hp3: r.hp3,
      hp007: r.hp007,
      accum_year_body: r.accum_year_body,
      accum_12m_body: r.accum_12m_body,
      accum_60m_body: r.accum_60m_body,
      raw_block: r.raw_block,
    });
  }

  if (excludedNoise > 0) {
    warnings.push(
      "Se excluyeron " + excludedNoise + " registro(s) repetidos que no corresponden a trabajadores (texto institucional o firma repetida en cada pagina)."
    );
  }
  if (filledFromDocPeriod > 0) {
    warnings.push(
      filledFromDocPeriod + " registro(s) no indicaban el periodo junto al trabajador; se completo automaticamente con el periodo detectado en el documento (" + (dominantPeriod ? dominantPeriod.label : "") + ")."
    );
  }
  if (stillMissingPeriod > 0) {
    warnings.push(stillMissingPeriod + " registro(s) quedaron sin periodo identificado.");
  }

  if (rows.length === 0) {
    errors.push("No se pudo construir ningun registro a partir del documento.");
  }

  return {
    rows,
    workersDetected: workerRuns.size,
    periodsIdentified: Array.from(periodsSet),
    quartersIdentified: Array.from(quartersSet).sort((a, b) => a - b),
    errors,
    warnings,
  };
}

// Backward-compatible single-string entry point.
export function parseDosimetryText(rawText: string): ParseResult {
  return parseDosimetryReport([rawText]);
}
