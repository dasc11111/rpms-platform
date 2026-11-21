/**
 * ARCHIVO CONSOLIDADO / DEPRECADO (14/09/2026)
 *
 * Este archivo ("ncrp151-radioterapia-tvl-references.ts") fue creado en una
 * parte anterior de esta misma sesion de trabajo (antes de una compactacion
 * de contexto), sin que se detectara en ese momento que ya existia un
 * archivo hermano con superposicion casi total de contenido:
 * "ncrp151-acelerador-barreras-references.ts" (mismo directorio).
 *
 * Al detectar la duplicacion se le pregunto explicitamente al usuario como
 * proceder. El usuario elegio consolidar: las Tablas B.2 a B.7 y las
 * Ecuaciones 2.1/2.7/2.8 que este archivo repetia se descartaron (ya
 * existian, con contenido identico, en ncrp151-acelerador-barreras-references.ts).
 * Las tres tablas que SI eran unicas de este archivo (Tabla B.1 - factores
 * de ocupacion, uso original radioterapia; Tabla B.8a-f - albedo de
 * reflexion; Tabla B.9 - fuerza de fuente de neutrones, con advertencia de
 * OCR corrupto en un nombre de modelo) se migraron integramente a
 * ncrp151-acelerador-barreras-references.ts, para no perder datos
 * citados/verificados (regla anti-fabricacion del Prompt Maestro).
 *
 * Este archivo no exporta nada y no debe usarse. Todo el contenido de
 * blindaje de aceleradores NCRP151 vive ahora unicamente en:
 *   ./ncrp151-acelerador-barreras-references.ts
 *
 * Se conserva este archivo (en vez de eliminarlo) porque la eliminacion
 * permanente de archivos requiere accion explicita del usuario, no de
 * Claude, por politica de seguridad de la sesion. Si se desea, el usuario
 * puede eliminarlo manualmente desde GitHub.
 */

export const ARCHIVO_CONSOLIDADO_VER = "./ncrp151-acelerador-barreras-references.ts";
