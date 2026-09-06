# BLINDAJE Y DISEÑO — Documentación Maestra

Módulo nuevo del sistema RPMS. Gobernado por "PROMPT MAESTRO V2 — Sistema Experto de Protección Radiológica — Módulo: Blindaje y Diseño" (67 secciones). Este documento contiene los entregables de las Fases 1-4 (§63) y se actualiza de forma incremental conforme se verifica cada fuente.

## Estado del Gap Normativo Nivel 1 (Chile)

No se encontró normativa chilena (CCHEN/MINSAL/ISP) en la carpeta fuente de Google Drive ("bunker y disñeo"). Se encontraron normas de la ARN (Argentina): AR 8.2.1, AR 8.2.2, AR 8.2.3, AR 10.1.1 — tratadas como Nivel 2 comparado, NO como sustituto del marco legal chileno.

Decisión registrada por el usuario (explícita, no asumida): usar como fuente oficial de criterios de diseño:
- NCRP Report No. 147 — "Structural Shielding Design for Medical X-Ray Imaging Facilities", NCRP, emitido 19-nov-2004, revisado 18-mar-2005 → diagnóstico por imágenes (§8).
- - NCRP Report No. 151 — "Structural Shielding Design and Evaluation for Megavoltage X- and Gamma-Ray Radiotherapy Facilities", NCRP, emitido dic-2005 → aceleradores (§9) y braquiterapia (§10, según indicación del usuario).
 
  - Estado: GAP-NORM-001 abierto. Nivel de confianza (§60): MEDIA para criterios de diseño de aceleradores/diagnóstico/braquiterapia hasta que se incorpore normativa CCHEN vigente.
 
  - ## Fase 1 — Inventario de Fuentes (resumen, en progreso)
 
  - Fuente: Google Drive, carpeta "bunker y disñeo" (74 archivos, con duplicados y 7 archivos vacíos detectados).
 
  - Documentos verificados por apertura directa (portada/ficha catalográfica):
  - - NCRP 147 (2004/2005) — VERIFICADO.
    - - NCRP 151 (2005/2006) — VERIFICADO.
     
      - Documentos identificados por nombre de archivo, pendientes de verificación interna de portada/versión exacta: ICRP Publication 103 (2007), ICRP Publication 149 (2021, braquiterapia), IAEA GSR Part 3 (BSS), IAEA Safety Reports Series No. 47, TRS 492 (IAEA), IAEA Human Health Series No. 14, IPEM Report 75, AAPM TG-108, SEFM Vol. 5 (braquiterapia), Attix, Knoll, Podgorsak (ed., IAEA), material de guías de fabricante (Site Planning ZAP/CKS7/Radixact/Halcyon — Nivel 4, solo referencia), material docente (14 presentaciones de clase) y ejercicios (10 archivos) — estos últimos catalogados como Nivel 3/4, apoyo pedagógico, no fuente normativa primaria.
     
      - Archivos vacíos (0 bytes de contenido real, excluidos): "Shielding Techniques for Radiation Oncology Facilities" (3 copias), "Nota ARN-Evaluación de memoria de cálculo" (2 copias), "INSTRUCTIVO ARN - Licencia de operación..." (1 copia), "tabla de equivalencia para diferentes materiales" (1 copia).
     
      - ## Fase 3/4 — Matriz Normativa y Motor Regulatorio (semilla inicial)
     
      - Los valores sembrados en `blindaje_regulatory_parameters` (ver `lib/blindaje.ts`) parten de los criterios de diseño ya definidos en el propio prompt maestro (§8, §9), marcados explícitamente como "pendiente de verificación de página exacta" mientras no se confirme el número de página dentro de NCRP 147/151. No se inventa ni se afirma un número de página sin haberlo verificado (§61).
     
      - | Parámetro | Valor | Unidad | Modalidad | Fuente | Página | Estado |
      - |---|---|---|---|---|---|---|
      - | Criterio de diseño, área controlada/POE | 25 | µSv/h | Diagnóstico por imágenes | NCRP 147 | PENDIENTE DE VERIFICAR | Criterio de diseño configurado (NO límite legal) |
      - | Criterio de diseño, área no controlada/público | 2.5 | µSv/h | Diagnóstico por imágenes | NCRP 147 | PENDIENTE DE VERIFICAR | Criterio de diseño configurado (NO límite legal) |
      - | Criterio de diseño, POE | 5 | mSv/año | Aceleradores (radioterapia externa) | NCRP 151 (según indicación de usuario, incluye braquiterapia) | PENDIENTE DE VERIFICAR | Criterio de diseño configurado (NO límite legal) |
      - | Criterio de diseño, público | 1 | mSv/año | Aceleradores (radioterapia externa) | NCRP 151 (según indicación de usuario, incluye braquiterapia) | PENDIENTE DE VERIFICAR | Criterio de diseño configurado (NO límite legal) |
     
      - ## Próximos pasos
     
      - 1. Verificar página exacta de cada valor sembrado abriendo NCRP 147/151 (Fase 3 completa).
        2. 2. Confirmar fuente oficial específica de braquiterapia dentro de NCRP 151 (sección/tabla).
           3. 3. Completar Fase 2 (Matriz Maestra de Fuentes) documento por documento.
              4. 4. Construir Fase 5-8 (clasificación de modalidades, motor matemático, base de materiales, motor de validación) sobre la base de datos ya creada en este branch (`feature/blindaje-diseno`).
                 5. 
