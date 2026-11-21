// Utilidades de busqueda en tiempo real (insensible a mayusculas, tildes y espacios).
import { rutMatchKey } from "@/lib/rut";

/** Quita tildes/diacriticos y pasa a minusculas, para comparaciones tolerantes. */
export function normalizeSearchText(input: string | null | undefined): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Heuristica simple: si el termino tiene 4 o mas digitos, se trata como busqueda de RUN. */
export function looksLikeRut(term: string): boolean {
  const digits = term.replace(/[^0-9kK]/g, "");
  return digits.length >= 4;
}

/**
 * Indica si un trabajador coincide con el termino de busqueda, evaluando
 * automaticamente si el termino es un RUN (comparacion tolerante por cuerpo
 * numerico) o texto libre (nombre, apellidos, correo, servicio, unidad, cargo).
 */
export function matchesWorkerSearch(
  term: string,
  fields: {
    rut: string;
    displayName: string;
    email?: string | null;
    service?: string | null;
    unit?: string | null;
    role?: string | null;
  }
): boolean {
  const raw = term.trim();
  if (!raw) return true;

  if (looksLikeRut(raw)) {
    const key = rutMatchKey(raw);
    if (key && rutMatchKey(fields.rut).includes(key)) return true;
  }

  const needle = normalizeSearchText(raw);
  const haystacks = [
    fields.displayName,
    fields.rut,
    fields.email,
    fields.service,
    fields.unit,
    fields.role,
  ]
    .map((v) => normalizeSearchText(v))
    .join(" | ");

  return haystacks.includes(needle);
}
