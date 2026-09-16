# BLINDAJE Y DISEÑO — Documentación Maestra

Módulo nuevo del sistema RPMS. Gobernado por "PROMPT MAESTRO V2 — Sistema Experto de Protección Radiológica — Módulo: Blindaje y Diseño" (67 secciones). Este documento contiene los entregables de las Fases 1-4 (§63) y se actualiza de forma incremental conforme se verifica cada fuente.

## Estado del Gap Normativo Nivel 1 (Chile)

No se encontró normativa chilena (CCHEN/MINSAL/ISP) en la carpeta fuente de Google Drive ("bunker y disñeo"). Se encontraron normas de la ARN (Argentina): AR 8.2.1, AR 8.2.2, AR 8.2.3, AR 10.1.1 — tratadas como Nivel 2 comparado, NO como sustituto del marco legal chileno.

Decisión registrada por el usuario (explícita, no asumida): usar como fuente oficial de criterios de diseño:
- NCRP Report No. 147 — "Structural Shielding Design for Medical X-Ray Imaging Facilities", NCRP, emitido 19-nov-2004, revisado 18-mar-2005 → diagnóstico por imágenes (§8).
- NCRP Report No. 151 — "Structural Shielding Design and Evaluation for Megavoltage X- and Gamma-Ray Radiotherapy Facilities", NCRP, emitido dic-2005 → aceleradores (§9).
- IAEA Safety Reports Series No. 47 — "Radiation Protection in the Design of Radiotherapy Facilities", IAEA, 2006 → braquiterapia (§10). **CORRECCIÓN (16/09/2026):** se verificó que NCRP 151 NO contiene metodología ni datos propios de braquiterapia (solo 2 menciones en pág. 227, ambas remitiendo a OTRAS publicaciones NCRP No. 40 y No. 41, no a contenido interno de NCRP 151). La fuente oficial real para braquiterapia es IAEA SRS-47, Sección 8 ("Worked Example of a Brachytherapy Facility", pág. 99-109), ya extraída e implementada en `frontend/web/src/lib/srs47-braquiterapia-references.ts`.

Estado: GAP-NORM-001 abierto. Nivel de confianza (§60): MEDIA para criterios de diseño de aceleradores/diagnóstico hasta que se incorpore normativa CCHEN vigente; ALTA para braquiterapia (SRS-47, Tablas 19-23, con verificación cruzada interna documentada en el archivo de referencias).

## Fase 1 — Inventario de Fuentes (resumen, en progreso)

Fuente: Google Drive, carpeta "bunker y disñeo" (74 archivos, con duplicados y 7 archivos vacíos detectados).

Documentos verificados por apertura directa (portada/ficha catalográfica):
- NCRP 147 (2004/2005) — VERIFICADO.
- NCRP 151 (2005/2006) — VERIFICADO.
- IAEA Safety Reports Series No. 47 (2006, STI/PUB/1223) — VERIFICADO (16/09/2026, tras corregirse un enlace que apuntaba a 6 copias mal etiquetadas que en realidad contenían otra publicación del OIEA, "Setting Up a Radiotherapy Programme", STI/PUB/1296).

Documentos identificados por nombre de archivo, pendientes de verificación interna de portada/versión exacta: ICRP Publication 103 (2007), ICRP Publication 149 (2021, braquiterapia), IAEA GSR Part 3 (BSS), TRS 492 (IAEA), IAEA Human Health Series No. 14, IPEM Report 75, AAPM TG-108, SEFM Vol. 5 (braquiterapia), Attix, Knoll, Podgorsak (ed., IAEA), material de guías de fabricante (Site Planning ZAP/CKS7/Radixact/Halcyon — Nivel 4, solo referencia), material docente (14 presentaciones de clase) y ejercicios (10 archivos) — estos últimos catalogados como Nivel 3/4, apoyo pedagógico, no fuente normativa primaria.

Archivos vacíos (0 bytes de contenido real, excluidos): "Shielding Techniques for Radiation Oncology Facilities" (3 copias), "Nota ARN-Evaluación de memoria de cálculo" (2 copias), "INSTRUCTIVO ARN - Licencia de operación..." (1 copia), "tabla de equivalencia para diferentes materiales" (1 copia).

## Fase 3/4 — Matriz Normativa y Motor Regulatorio (semilla inicial)

Los valores sembrados en `blindaje_regulatory_parameters` (ver `lib/blindaje.ts`) parten de los criterios de diseño ya definidos en el propio prompt maestro (§8, §9), marcados explícitamente como "pendiente de verificación de página exacta" mientras no se confirme el número de página dentro de NCRP 147/151. No se inventa ni se afirma un número de página sin haberlo verificado (§61).

| Parámetro | Valor | Unidad | Modalidad | Fuente | Página | Estado |
|---|---|---|---|---|---|---|
| Criterio de diseño, área controlada/POE | 25 | µSv/h | Diagnóstico por imágenes | NCRP 147 | DISCREPANTE — ver nota | No verificable en el texto de NCRP 147 (ver nota abajo) |
| Criterio de diseño, área no controlada/público | 2.5 | µSv/h | Diagnóstico por imágenes | NCRP 147 | DISCREPANTE — ver nota | No verificable en el texto de NCRP 147 (ver nota abajo) |
| Criterio de diseño, POE | 5 | mSv/año | Aceleradores (radioterapia externa) | NCRP 151, pág. 6 | VERIFICADO | Confianza ALTA |
| Criterio de diseño, público | 1 | mSv/año | Aceleradores (radioterapia externa) | NCRP 151, pág. 6 | VERIFICADO | Confianza ALTA |
| Criterio de diseño, área controlada | 7.5 | µSv/h | Braquiterapia | IAEA SRS-47, pág. 99-101, Sección 8.1 (coincide con Tabla 2 y Tabla 19) | VERIFICADO | Confianza ALTA (ver corrección de artefacto OCR µ→m en `srs47-braquiterapia-references.ts`) |
| Criterio de diseño, área no controlada/público | 2.5 | µSv/h | Braquiterapia | IAEA SRS-47, pág. 99-101, Sección 8.1 (coincide con Tabla 2 y Tabla 19) | VERIFICADO | Confianza ALTA (ver corrección de artefacto OCR µ→m en `srs47-braquiterapia-references.ts`) |

**NOTA — Discrepancia NCRP 147 (25/2.5 µSv/h), sin resolver (16/09/2026):** se releyó NCRP 147 páginas 4-5 directamente. El documento NO establece los valores 25 µSv/h y 2.5 µSv/h como criterios de diseño para diagnóstico por imágenes. Los valores que sí aparecen explícitamente son P = 0.1 mGy/semana (equivalente a 5 mGy/año) para área controlada y P = 0.02 mGy/semana (equivalente a 1 mGy/año) para área no controlada — ambos expresados en **kerma en aire** (mGy), no en tasa de dosis por hora (µSv/h), y con una base temporal distinta (semanal/anual) a la de los valores originalmente sembrados. No se pudo localizar el origen de "25/2.5 µSv/h" dentro de NCRP 147. Se marca como discrepancia ABIERTA en vez de corregir unilateralmente, porque el cambio de unidad (kerma en mGy vs. tasa en µSv/h) y de base temporal no es una simple corrección tipográfica: requiere que el usuario confirme el criterio de diseño real que desea usar en el sistema antes de sobrescribir el valor sembrado en `blindaje_regulatory_parameters`.

## Próximos pasos

1. Verificar página exacta de cada valor sembrado abriendo NCRP 147/151 — COMPLETADO para NCRP 151 (pág. 6, confianza ALTA) y para braquiterapia/SRS-47 (pág. 99-109, confianza ALTA). PENDIENTE para NCRP 147: ver nota de discrepancia arriba, requiere decisión del usuario.
2. Confirmar fuente oficial específica de braquiterapia — COMPLETADO (16/09/2026): la fuente real es IAEA SRS-47, Sección 8, NO NCRP 151 (que no contiene braquiterapia). Implementado en `srs47-braquiterapia-references.ts`.
3. Completar Fase 2 (Matriz Maestra de Fuentes) documento por documento.
4. Construir Fase 5-8 (clasificación de modalidades, motor matemático, base de materiales, motor de validación) sobre la base de datos ya creada en este branch (`feature/blindaje-diseno`).
5. Decidir con el usuario cómo resolver la discrepancia de NCRP 147 (25/2.5 µSv/h vs. los valores reales encontrados en kerma en aire, mGy/semana) antes de actualizar `blindaje_regulatory_parameters` para diagnóstico por imágenes.
