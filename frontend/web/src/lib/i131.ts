export const I131_SUGGESTION_FIELDS = [
  "radiofarmaco",
  "medico_solicitante",
  "procedencia",
  "diagnostico",
  "protocolo",
  "equipo",
  "motivo",
  "tipo_examen",
  "prevision",
  "paciente_nombre",
] as const;

export type I131SuggestionField = (typeof I131_SUGGESTION_FIELDS)[number];

export const I131_SUGGESTION_FIELD_LABELS: Record<string, string> = {
  radiofarmaco: "Radiofármaco",
  medico_solicitante: "Médico Nuclear",
  procedencia: "Procedencia",
  diagnostico: "Diagnóstico",
  protocolo: "Protocolo",
  equipo: "Equipo",
  motivo: "Motivo",
  tipo_examen: "Tipo de examen",
  prevision: "Previsión",
  paciente_nombre: "Paciente",
};

export const MESES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

export function mesNombre(mes: number): string {
  return MESES[mes - 1] ?? "";
}

export function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function buildAdminDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normText(s: string | null | undefined): string {
  return (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
}

export function buildDedupeKey(parts: {
  admin_date: string;
  ficha_clinica?: string | null;
  paciente_nombre: string;
  dosis_administrada?: number | null;
  partida?: string | null;
}): string {
  return [
    parts.admin_date,
    normText(parts.ficha_clinica),
    normText(parts.paciente_nombre),
    parts.dosis_administrada ?? "",
    normText(parts.partida),
  ].join("|");
}

export const RESPONSABLE_FIJO = "Médico Nuclear";

export type I131Record = {
  id: number;
  admin_year: number;
  admin_month: number;
  admin_day: number;
  admin_date: string;
  partida: string | null;
  pedido_numero: string | null;
  radiofarmaco: string;
  cantidad_solicitada: number | null;
  paciente_nombre: string;
  paciente_run: string | null;
  ficha_clinica: string | null;
  prevision: string | null;
  diagnostico: string | null;
  medico_solicitante: string | null;
  procedencia: string | null;
  tipo_examen: string | null;
  equipo: string | null;
  motivo: string | null;
  protocolo: string | null;
  tasa_dosis: string | null;
  dosis_administrada: number | null;
  responsable: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export const I131_SORT_FIELDS = [
  "admin_date",
  "paciente_nombre",
  "radiofarmaco",
  "dosis_administrada",
  "cantidad_solicitada",
  "diagnostico",
  "ficha_clinica",
  "created_at",
] as const;
export type I131SortField = (typeof I131_SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";

export const PREVISION_OPTIONS = ["FONASA", "ISAPRE", "PARTICULAR", "OTRA"];

export function formatMci(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(0).padStart(3, "0")} mCi`;
}

export function runValido(run: string): boolean {
  const clean = run.replace(/[.\-\s]/g, "").toUpperCase();
  if (!/^[0-9]{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    const digitChar = body[i] ?? "0";
    sum += parseInt(digitChar, 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const dvCalc = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return dvCalc === dv;
}
