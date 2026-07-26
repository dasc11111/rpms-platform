// Motor de normalizacion y validacion del RUN/RUT chileno.
// Se utiliza en todo el modulo Trabajadores para: validar el digito
// verificador, almacenar siempre en el formato oficial XX.XXX.XXX-X y
// detectar duplicados aunque el RUT se haya ingresado con distinto formato.

/** Elimina puntos, espacios y guiones; deja solo digitos y la letra K. */
export function cleanRut(input: string): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

/** Calcula el digito verificador (modulo 11) para el cuerpo numerico de un RUT. */
export function computeDv(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

/** Separa un RUT ya limpio (sin puntos/guion) en cuerpo numerico + digito verificador. */
export function splitRut(clean: string): { body: string; dv: string } | null {
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^[0-9]+$/.test(body)) return null;
  if (!/^[0-9K]$/.test(dv)) return null;
  return { body, dv };
}

/** Indica si un RUT (en cualquier formato de entrada) tiene un digito verificador valido. */
export function isValidRut(input: string): boolean {
  const parts = splitRut(cleanRut(input));
  if (!parts) return false;
  return computeDv(parts.body) === parts.dv;
}

/** Formatea un RUT al formato oficial chileno XX.XXX.XXX-X. Si no es valido, devuelve el texto original recortado. */
export function formatRut(input: string): string {
  const parts = splitRut(cleanRut(input));
  if (!parts) return String(input ?? "").trim();
  const withDots = parts.body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${parts.dv}`;
}

export type RutNormalizationResult =
  | { ok: true; rut: string; body: string; dv: string }
  | { ok: false; error: string };

/**
 * Normaliza y valida un RUT ingresado por el usuario.
 * Devuelve el RUT formateado (XX.XXX.XXX-X) o un mensaje de error claro.
 */
export function normalizeRut(input: string): RutNormalizationResult {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, error: "El RUT es obligatorio." };

  const parts = splitRut(cleanRut(raw));
  if (!parts) {
    return { ok: false, error: "El RUT ingresado no tiene un formato valido." };
  }

  const expectedDv = computeDv(parts.body);
  if (expectedDv !== parts.dv) {
    return {
      ok: false,
      error: `El digito verificador del RUT no es valido (se esperaba ${expectedDv}).`,
    };
  }

  const withDots = parts.body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return { ok: true, rut: `${withDots}-${parts.dv}`, body: parts.body, dv: parts.dv };
}

/**
 * Clave de comparacion tolerante entre modulos: solo el cuerpo numerico,
 * sin puntos, guion ni digito verificador. Se usa para hacer *match* de un
 * mismo trabajador aunque el RUN se haya escrito con distinto formato.
 */
export function rutMatchKey(input: string): string {
  const parts = splitRut(cleanRut(input));
  return parts ? parts.body : cleanRut(input).replace(/K$/, "");
}
