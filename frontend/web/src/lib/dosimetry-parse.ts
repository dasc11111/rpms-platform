// Dosimetry PDF/text report parser.
// Given raw text (either extracted directly from a digital PDF or produced by
// OCR from a scanned PDF), this module extracts the relevant fields described
// in the "Importacion de reportes PDF" specification: institution, department,
// period/year/quarter, worker name/RUN, dosimeter number/type, radiation type,
// process, Hp(10)/Hp(3)/Hp(0.07) doses and accumulated doses (annual/12m/60m).
//
// The parser is heuristic and label-based (it looks for the field labels used
// by typical Chilean personal-dosimetry reports). It is designed to be easy to
// extend/tune once real sample reports are available, without needing to
// change the surrounding import flow (preview/confirm routes, UI).

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

function norm(s: string): string {
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
    found.push({ quarter: Number(m[1]), year: Number(m[2]), label: `T${m[1]}-${m[2]}` });
  }

  const re2 = /(\d{4})\s*[-\/]\s*T\s*([1-4])/gi;
  while ((m = re2.exec(block))) {
    found.push({ quarter: Number(m[2]), year: Number(m[1]), label: `T${m[2]}-${m[1]}` });
  }

  const normed = norm(block);
  const re3 = /(PRIMER|SEGUNDO|TERCER)O?\s+TRIMESTRE[^\d]{0,20}(\d{4})/g;
  while ((m = re3.exec(normed))) {
    const key = m[1] ?? "";
    const q = QUARTER_WORDS[key];
    if (q) found.push({ quarter: q, year: Number(m[2]), label: `T${q}-${m[2]}` });
  }
  const re4 = /CUARTO\s+TRIMESTRE[^\d]{0,20}(\d{4})/g;
  while ((m = re4.exec(normed))) {
    found.push({ quarter: 4, year: Number(m[1]), label: `T4-${m[1]}` });
  }

  const seen = new Set<string>();
  return found.filter((f) => {
    if (!f.year || !f.quarter) return false;
    const key = `${f.year}-${f.quarter}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Chilean RUT/RUN pattern, e.g. 12.345.678-9 or 12345678-9.
const RUN_PATTERN = /\b(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])\b/g;

export function parseDosimetryText(rawText: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = (rawText || "").replace(/\r/g, "");

  if (!text || text.trim().length < 20) {
    errors.push("No se pudo extraer texto del documento (posiblemente escaneado sin OCR, o vacio).");
    return { rows: [], workersDetected: 0, periodsIdentified: [], quartersIdentified: [], errors, warnings };
  }

  const runMatches: { run: string; index: number }[] = [];
  const runRe = new RegExp(RUN_PATTERN.source, "g");
  let rm: RegExpExecArray | null;
  while ((rm = runRe.exec(text))) {
    runMatches.push({ run: rm[1] ?? "", index: rm.index });
  }

  if (runMatches.length === 0) {
    errors.push("No se identifico ningun RUN en el documento.");
  }

  const segments: { run: string; block: string }[] = [];
  if (runMatches.length > 0) {
    for (let i = 0; i < runMatches.length; i++) {
      const start = runMatches[i].index;
      const end = i + 1 < runMatches.length ? runMatches[i + 1].index : text.length;
      segments.push({ run: runMatches[i].run, block: text.slice(start, end) });
    }
  } else {
    segments.push({ run: "", block: text });
  }

  const rows: ParsedDoseRow[] = [];
  const periodsSet = new Set<string>();
  const quartersSet = new Set<number>();
  const workerRuns = new Set<string>();

  for (const seg of segments) {
    if (seg.run) workerRuns.add(seg.run);
    const periods = detectPeriods(seg.block);

    const nombre = findValueNear(seg.block, /NOMBRE(?:\s+DEL?\s+TRABAJADOR)?/i);
    const institucion = findValueNear(seg.block, /INSTITUCI[OÓ]N/i);
    const departamento = findValueNear(seg.block, /DEPARTAMENTO/i);
    const dosimeterNumber = findValueNear(seg.block, /N[UÚ]MERO\s+DE\s+DOS[IÍ]METRO|N[°º]\s*DOS[IÍ]METRO/i);
    const dosimeterType = findValueNear(seg.block, /TIPO\s+DE\s+DOS[IÍ]METRO/i);
    const radiationType = findValueNear(seg.block, /TIPO\s+DE\s+RADIACI[OÓ]N/i);
    const proceso = findValueNear(seg.block, /PROCESO/i);

    const hp10 = findNumberNear(seg.block, /HP\s*\(?\s*10\s*\)?/i);
    const hp3 = findNumberNear(seg.block, /HP\s*\(?\s*3\s*\)?/i);
    const hp007 = findNumberNear(seg.block, /HP\s*\(?\s*0[.,]?\s*07\s*\)?/i);
    const accumYear = findNumberNear(seg.block, /ACUMULAD[OA]S?\s+ANUAL(?:ES)?/i);
    const accum12 = findNumberNear(seg.block, /ACUMULAD[OA]S?\s+(?:[UÚ]LTIMOS?\s+)?12\s+MESES/i);
    const accum60 = findNumberNear(seg.block, /ACUMULAD[OA]S?\s+(?:[UÚ]LTIMOS?\s+)?60\s+MESES/i);

    if (periods.length === 0) {
      warnings.push(`No se identifico el periodo/trimestre para RUN ${seg.run || "(no identificado)"}.`);
    }

    const periodList = periods.length > 0 ? periods : [{ year: 0, quarter: 0, label: "" }];
    for (const p of periodList) {
      if (p.label) {
        periodsSet.add(p.label);
        quartersSet.add(p.quarter);
      }
      rows.push({
        worker_run: seg.run,
        worker_name: nombre,
        institucion,
        departamento,
        year: p.year || null,
        quarter: p.quarter || null,
        period_label: p.label,
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
        raw_block: seg.block.slice(0, 800),
      });
    }
  }

  if (rows.length === 0) {
    errors.push("No se pudo construir ningun registro a partir del documento.");
  }

  return {
    rows,
    workersDetected: workerRuns.size || (rows.length > 0 ? 1 : 0),
    periodsIdentified: Array.from(periodsSet),
    quartersIdentified: Array.from(quartersSet).sort((a, b) => a - b),
    errors,
    warnings,
  };
}
