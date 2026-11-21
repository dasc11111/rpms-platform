// Normalizacion del nombre del trabajador.
// El estandar de la plataforma es: Apellido Paterno, Apellido Materno, Nombres.
// Los campos separados son opcionales (para no romper registros historicos que
// solo tienen el campo "name" libre); cuando existen, tienen prioridad para
// construir el nombre de despliegue.

export type WorkerNameParts = {
  last_name_1?: string | null;
  last_name_2?: string | null;
  first_names?: string | null;
  name?: string | null;
};

/** Compone "APELLIDO PATERNO APELLIDO MATERNO Nombres" a partir de las partes. */
export function composeWorkerName(w: WorkerNameParts): string {
  const lastName1 = String(w.last_name_1 ?? "").trim();
  const lastName2 = String(w.last_name_2 ?? "").trim();
  const firstNames = String(w.first_names ?? "").trim();

  if (lastName1 || lastName2 || firstNames) {
    return [lastName1.toUpperCase(), lastName2.toUpperCase(), firstNames]
      .filter((part) => part.length > 0)
      .join(" ");
  }

  return String(w.name ?? "").trim();
}

/** Clave de ordenamiento alfabetico (por apellido paterno cuando existe). */
export function workerSortKey(w: WorkerNameParts): string {
  const lastName1 = String(w.last_name_1 ?? "").trim();
  if (lastName1) return lastName1.toUpperCase();
  return String(w.name ?? "").trim().toUpperCase();
}
