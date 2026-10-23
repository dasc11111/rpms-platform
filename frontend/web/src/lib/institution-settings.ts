/**
 * Helper para cargar datos del establecimiento desde institution_settings.
 * Usada por los exportadores PDF para incluir nombre, OPR y códigos regulatorios.
 */
import { sql } from "@/lib/db";

export interface InstitutionInfo {
  name: string;
  opr_name: string;
  cchen_code: string;
  seremi_code: string;
}

const DEFAULTS: InstitutionInfo = {
  name: "Establecimiento de Salud",
  opr_name: "",
  cchen_code: "",
  seremi_code: "",
};

export async function getInstitutionInfo(): Promise<InstitutionInfo> {
  try {
    const { rows } = await sql`
      SELECT name, opr_name, cchen_code, seremi_code
      FROM institution_settings WHERE id = 1 LIMIT 1
    `;
    if (rows.length === 0) return DEFAULTS;
    const r = rows[0] as Record<string, unknown>;
    return {
      name: String(r.name || DEFAULTS.name),
      opr_name: String(r.opr_name ?? ""),
      cchen_code: String(r.cchen_code ?? ""),
      seremi_code: String(r.seremi_code ?? ""),
    };
  } catch {
    return DEFAULTS;
  }
}
