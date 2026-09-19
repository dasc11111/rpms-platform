# BLINDAJE Y DISEÑO — Documentación Maestra

Módulo nuevo del sistema RPMS. Gobernado por "PROMPT MAESTRO V2 — Sistema Experto de Protección Radiológica — Módulo: Blindaje y Diseño" (67 secciones). Este documento contiene los entregables de las Fases 1-4 (§63) y se actualiza de forma incremental conforme se verifica cada fuente.

## Estado del Gap Normativo Nivel 1 (Chile)

No se encontró normativa chilena (CCHEN/MINSAL/ISP) en la carpeta fuente de Google Drive ("bunker y disñeo"). Se encontraron normas de la ARN (Argentina): AR 8.2.1, AR 8.2.2, AR 8.2.3, AR 10.1.1 — tratadas como Nivel 2 comparado, NO como sustituto del marco legal chileno.

Decisión registrada por el usuario (explícita, no asumida): usar como fuente oficial de criterios de diseño:
- NCRP Report No. 147 — "Structural Shielding Design for Medical X-Ray Imaging Facilities", NCRP, emitido 19-nov-2004, revisado 18-mar-2005 → diagnóstico por imágenes (§8).
- NCRP Report No. 151 — "Structural Shielding Design and Evaluation for Megavoltage X- and Gamma-Ray Radiotherapy Facilities", NCRP, emitido dic-2005 → aceleradores (§9).
- IAEA Safety Reports Series No. 47 — "Radiation Protection in the Design of Radiotherapy Facilities", IAEA, 2006 → braquiterapia (§10). **CORRECCIÓN (16/09/2026):** se verificó que NCRP 151 NO contiene metodología ni datos propios de braquiterapia (solo 2 menciones en pág. 227, ambas remitiendo a OTRAS publicaciones NCRP No. 40 y No. 41, no a contenido interno de NCRP 151). La fuente oficial real para braquiterapia es IAEA SRS-47, Sección 8 ("Worked Example of a Brachytherapy Facility", pág. 99-109), ya extraída e implementada en `frontend/web/src/lib/srs47-braquiterapia-references.ts`.
- **AAPM Task Group 108** — "PET and PET/CT Shielding Requirements", Madsen et al., Med. Phys. 33 (1), enero 2006 (recibido 21-jul-2005, publicado 19-dic-2005), DOI: 10.1118/1.2135911 → **medicina nuclear PET/PET-CT**. Verificado por apertura directa del archivo "TG108 AAPM REQUIRIMIENTOS DE BLINDAJE.txt" en Drive. Documento primario especifico para blindaje de PET/PET-CT (fotones de aniquilacion de 0,511 MeV), directamente relevante para la rama actual `feature/fase23-petct-fase-a-arquitectura`. **Implementado (16/09/2026)** en `frontend/web/src/lib/aapm-tg108-petct-references.ts` (Tablas I-VIII, ecuaciones 1-12, 7 ejemplos resueltos, limites regulatorios 10 CFR 20 — marco DISTINTO de NCRP147/151, no combinar).

Estado: GAP-NORM-001 abierto. Nivel de confianza (§60): MEDIA para criterios de diseño de aceleradores/diagnóstico hasta que se incorpore normativa CCHEN vigente; ALTA para braquiterapia (SRS-47, Tablas 19-23, con verificación cruzada interna documentada en el archivo de referencias); ALTA para AAPM TG-108 (documento en ingles, sin ambiguedad de traduccion automatica, con verificacion cruzada interna del artefacto de unidad µSv documentada en el archivo de referencias).

## Fase 1 — Inventario de Fuentes (resumen, en progreso)

Fuente: Google Drive, carpeta "bunker y disñeo" (74 archivos, con duplicados y 7 archivos vacíos detectados).

Documentos verificados por apertura directa (portada/ficha catalográfica):
- NCRP 147 (2004/2005) — VERIFICADO.
- NCRP 151 (2005/2006) — VERIFICADO.
- IAEA Safety Reports Series No. 47 (2006, STI/PUB/1223) — VERIFICADO (16/09/2026, tras corregirse un enlace que apuntaba a 6 copias mal etiquetadas que en realidad contenían otra publicación del OIEA, "Setting Up a Radiotherapy Programme", STI/PUB/1296, ISBN 92-0-101807-X, 2008 — confirmado nuevamente el 16/09/2026 abriendo el archivo "IAEA Safety Report sSeries No.47.txt").
- **AAPM Task Group 108, "PET and PET/CT Shielding Requirements"** (2005/2006) — VERIFICADO (16/09/2026). Archivo: "TG108 AAPM REQUIRIMIENTOS DE BLINDAJE.txt". Implementado en `aapm-tg108-petct-references.ts`.
- **ICRP Publication 149, "Occupational Radiological Protection in Brachytherapy"** (Annals of the ICRP, Vol. 50 No. 3, 2021, ISBN 9781529779370) — VERIFICADO (16/09/2026). Archivo: "2021-icrp-publication-149-occupational-radiological-protection-in-brachytherapy1.txt". Alcance: protección ocupacional/procedimientos, NO cálculo de barreras estructurales — complementario a SRS-47, no sustituto.
- **ICRP Publication 103, "The 2007 Recommendations of the ICRP"** (Annals of the ICRP, ed. J. Valentin) — VERIFICADO (16/09/2026). Archivo: "ICRP Publication 103 (2).txt" (y 3 copias adicionales).
- **IAEA GSR Part 3, "Radiation Protection and Safety of Radiation Sources: International Basic Safety Standards"** (ISBN 978-92-0-135310-8, 2014) — VERIFICADO (16/09/2026). Archivo: "IAEA International Basic Safety Standards GSR Part 3 (1).txt" (y 3 copias adicionales).
- **IAEA Human Health Series No. 14, "Planning National Radiotherapy Services: A Practical Tool"** (ISBN 978-92-0-105910-9, 2011) — VERIFICADO (16/09/2026). Archivo: "IAEA HUMAN HEALTH SERIES No.14.txt". Alcance: planificación de servicios, no cálculo de blindaje.
- **IAEA TRS 492, "Dosimetry in Brachytherapy – An International Code of Practice for Secondary Standards Dosimetry Laboratories and Hospitals"** — VERIFICADO (16/09/2026). Archivo: "TRS 492 - Braquiterapia.txt". Alcance: dosimetría, no blindaje estructural — complementario a SRS-47.
- **IPEM Report 75, "Design and Shielding of Radiotherapy Treatment Facilities", 2nd Edition** — VERIFICADO (16/09/2026). Archivo: "Design and Shielding of Radiotherapy treatment facilities IPEM Report 75.txt". Ya citado como referencia [3] dentro de SRS-47 (Tabla 19).
- **SEFM Vol. 5, "Fundamentos de Física Médica: Braquiterapia: bases físicas, equipos y control de calidad"** (ed. José Pérez-Calatayud, ISBN 978-84-940849-7-3) — VERIFICADO (16/09/2026). Archivo: "SEFM Vol5 - Braquiterapia.txt".
- Attix ("Introduction to Radiological Physics and Radiation Dosimetry"), Knoll ("Radiation Detection and Measurement", 4th ed.), Podgorsak (ed., "Radiation Oncology Physics", IAEA 2005) — identificados por nombre de archivo y tamaño consistente con las ediciones estándar conocidas; son libros de texto ampliamente publicados cuya autoría es inequívoca por el nombre de archivo. No se realizó apertura página por página de cada uno (verificación de portada pendiente, prioridad BAJA por ser textos de referencia general, no normativos).

Documentos aún no verificados individualmente (nombres de archivo reconocibles, contenido no releído): material de guías de fabricante (Site Planning ZAP/CKS7/Radixact/Halcyon — Nivel 4, solo referencia), material docente (14 presentaciones de clase) y ejercicios (10 archivos) — catalogados como Nivel 3/4, apoyo pedagógico, no fuente normativa primaria.

Archivos vacíos (0 bytes de contenido real, excluidos): "Shielding Techniques for Radiation Oncology Facilities" (3 copias), "Nota ARN-Evaluación de memoria de cálculo" (2 copias), "INSTRUCTIVO ARN - Licencia de operación..." (2 copias).

## Fase 2 — Matriz Maestra de Fuentes: estado (actualización 16/09/2026)

De los documentos "pendientes de verificación interna de portada/versión exacta" listados en la revisión anterior, se verificaron por apertura directa: ICRP 103, ICRP 149, IAEA GSR Part 3, IAEA Human Health Series No. 14, IPEM Report 75, SEFM Vol. 5, TRS 492, y se descubrió un documento adicional no listado previamente (AAPM TG-108, ya implementado en código). Quedan sin apertura página-por-página: Attix, Knoll, Podgorsak (ver nota arriba, prioridad BAJA). Fase 2 se considera SUSTANCIALMENTE COMPLETA para los documentos de mayor relevancia normativa; pendiente solo la verificación de portada de los 3 libros de texto de física general.

## Fase 3/4 — Matriz Normativa y Motor Regulatorio (semilla inicial)

Los valores sembrados en `blindaje_regulatory_parameters` (ver `lib/blindaje.ts`) parten de los criterios de diseño ya definidos en el propio prompt maestro (§8, §9), marcados explícitamente como "pendiente de verificación de página exacta" mientras no se confirme el número de página dentro de NCRP 147/151. No se inventa ni se afirma un número de página sin haberlo verificado (§61).

| Parámetro | Valor | Unidad | Modalidad | Fuente | Página | Estado |
|---|---|---|---|---|---|---|
| Criterio de diseño, área controlada/POE (opción A, verificada) | 0.1 | mGy/semana (kerma en aire) | Diagnóstico por imágenes | NCRP 147, Sección 1.4.1 | 3-4 | VERIFICADO, confianza ALTA |
| Criterio de diseño, área no controlada/público (opción A, verificada) | 0.02 | mGy/semana (kerma en aire) | Diagnóstico por imágenes | NCRP 147, Sección 1.4.2 | 4-5 | VERIFICADO, confianza ALTA |
| Criterio de diseño, área controlada/POE (opción B, legado, seleccionable) | 25 | µSv/h | Diagnóstico por imágenes | Origen no verificado — ver nota | — | NO VERIFICADO, confianza BAJA, disponible como opción a elección del usuario |
| Criterio de diseño, área no controlada/público (opción B, legado, seleccionable) | 2.5 | µSv/h | Diagnóstico por imágenes | Origen no verificado — ver nota | — | NO VERIFICADO, confianza BAJA, disponible como opción a elección del usuario |
| Criterio de diseño, POE | 5 | mSv/año | Aceleradores (radioterapia externa) | NCRP 151, pág. 6 | 6 | VERIFICADO, confianza ALTA |
| Criterio de diseño, público | 1 | mSv/año | Aceleradores (radioterapia externa) | NCRP 151, pág. 6 | 6 | VERIFICADO, confianza ALTA |
| Criterio de diseño, área controlada | 7.5 | µSv/h | Braquiterapia | IAEA SRS-47, Sección 8.1 (coincide con Tabla 2 y Tabla 19) | 99-101 | VERIFICADO, confianza ALTA (ver corrección de artefacto OCR µ→m en `srs47-braquiterapia-references.ts`) |
| Criterio de diseño, área no controlada/público | 2.5 | µSv/h | Braquiterapia | IAEA SRS-47, Sección 8.1 (coincide con Tabla 2 y Tabla 19) | 99-101 | VERIFICADO, confianza ALTA (ver corrección de artefacto OCR µ→m en `srs47-braquiterapia-references.ts`) |
| Criterio de diseño, público (semanal, uptake/imagen) | 20 | µSv/semana (1 mSv/año) | Medicina nuclear PET/PET-CT | AAPM TG-108, Sección "Regulatory limits" (10 CFR 20) | 8 | VERIFICADO, confianza ALTA — marco regulatorio DISTINTO de NCRP147/151, no combinar |
| Criterio de diseño ALARA, área controlada (semanal) | 100 | µSv/semana (5 mSv/año) | Medicina nuclear PET/PET-CT | AAPM TG-108, Sección "Regulatory limits" (10 CFR 20) | 8 | VERIFICADO, confianza ALTA |

**NOTA — Resolución NCRP 147, decisión del usuario (16/09/2026):** se releyó NCRP 147 páginas 4-5 directamente. El documento NO establece los valores 25 µSv/h y 2.5 µSv/h como criterios de diseño para diagnóstico por imágenes; los valores que sí aparecen explícitamente son P = 0.1 mGy/semana (área controlada) y P = 0.02 mGy/semana (área no controlada), en **kerma en aire**, no en tasa de dosis por hora. No se pudo localizar el origen del valor "25/2.5 µSv/h" dentro de NCRP 147. En vez de descartarlo o sobrescribirlo unilateralmente, el usuario decidió **mantener ambos criterios como opciones seleccionables** en el sistema, dejando explícito el nivel de confianza real de cada uno. Implementado en `frontend/web/src/lib/ncrp147-shielding-references.ts` (`OPCIONES_CRITERIO_DISENO_DIAGNOSTICO`, con los códigos `NCRP147_KERMA_AIRE` y `LEGADO_25_2_5_USVH`). Si en el futuro se identifica la fuente real del valor legado (otra norma, guía de fabricante, o simplificación práctica), debe actualizarse ese registro con la cita correspondiente en vez de dejarlo como "origen no verificado".

## Próximos pasos

1. Verificar página exacta de cada valor sembrado abriendo NCRP 147/151 — COMPLETADO para NCRP 151 (pág. 6, confianza ALTA), para braquiterapia/SRS-47 (pág. 99-109, confianza ALTA), para NCRP 147 (pág. 3-5, confianza ALTA; el criterio alternativo de 25/2.5 µSv/h queda disponible como opción seleccionable de origen no verificado, ver nota arriba) y para PET/PET-CT (AAPM TG-108, pág. 8, confianza ALTA).
2. Confirmar fuente oficial específica de braquiterapia — COMPLETADO (16/09/2026): la fuente real es IAEA SRS-47, Sección 8, NO NCRP 151 (que no contiene braquiterapia). Implementado en `srs47-braquiterapia-references.ts`.
3. Completar Fase 2 (Matriz Maestra de Fuentes) documento por documento — SUSTANCIALMENTE COMPLETADO (16/09/2026): ver sección "Fase 2" arriba. Pendiente solo verificación de portada de Attix/Knoll/Podgorsak (prioridad BAJA).
4. Construir Fase 5-8 (clasificación de modalidades, motor matemático, base de materiales, motor de validación) sobre la base de datos ya creada en este branch (`feature/blindaje-diseno`) — EN PROGRESO. Hito completado (16/09/2026): `aapm-tg108-petct-references.ts` (metodología y datos de AAPM TG-108 para blindaje de PET/PET-CT). Próximo hito concreto: (a) integrar las funciones de cálculo de TG-108 (Ecs. 1-12) como funciones ejecutables en `blindaje-calc-engine.ts` (paralelo a `validarModeloArcher()` ya existente para NCRP151); (b) extender el selector de modalidad de la UI/wizard para incluir "Medicina Nuclear PET/PET-CT" como modalidad propia, distinta de "Medicina Nuclear (gammacámara/SPECT)" ya existente, dado que TG-108 usa una metodología de fuente-paciente-movil que no aplica a otras modalidades de medicina nuclear.

Actualizacion (17/09/2026): hito (b) del "Proximo hito concreto" arriba, COMPLETADO. Se extendio el selector de modalidad de la UI (frontend/web/src/components/blindaje/blindaje-app.tsx, commit aab2e3c) para que "Medicina Nuclear - PET / PET-CT (AAPM TG-108)" (facility_type = "medicina_nuclear_pet_ct") sea un tipo de instalacion propio, separado de "Medicina Nuclear (Gammacamara / SPECT)" (facility_type = "medicina_nuclear"). Cambios especificos: (1) FACILITY_TYPES agrega la nueva opcion; (2) EQUIPMENT_TYPES mueve "pet" y "pet_ct" desde la clave medicina_nuclear a la nueva clave medicina_nuclear_pet_ct (medicina_nuclear queda solo con gamma_camara y spect); (3) SOURCE_TYPE_BY_FACILITY agrega "radionucleido_pet_movil" para la nueva modalidad; (4) SOURCE_FIELDS_BY_FACILITY y SOURCE_FIELD_LABELS agregan entradas propias; (5) el campo Radionuclido del formulario de fuente de radiacion pasa a ser un selector (no texto libre) poblado desde RADIONUCLIDOS_PET (blindaje-calc-engine.ts, Tabla II AAPM TG-108: C-11, N-13, O-15, F-18, Cu-64, Ga-68, Rb-82, I-124) cuando la instalacion es PET/PET-CT, evitando que el usuario escriba un radionuclido no soportado por el motor de calculo. No se modifico el esquema de base de datos (facility_type ya era TEXT sin restriccion CHECK en blindaje_projects, ver ensureBlindajeTables() en lib/blindaje.ts) ni las rutas API (no validan un enum cerrado de facility_type). Verificado build exitoso en Vercel tras el commit. El hito (a) del mismo parrafo (integrar las funciones de calculo de TG-108 como funciones ejecutables) ya estaba completado previamente en blindaje-calc-engine.ts (Secciones 1-11 del archivo). Pendiente (Fase 5-8, continuacion): motor matematico ejecutable y wiring UI-motor para radioterapia/aceleradores (NCRP 151, TVL y barreras, laberintos) y braquiterapia (IAEA SRS-47); diagnostico por imagenes (NCRP 147) aun no tiene motor de calculo ejecutable propio, solo el catalogo de referencias.

## Actualizacion (17/09/2026, continuacion Fase 5 - braquiterapia)

Al continuar la Fase 5 tras la extension del selector PET/PET-CT, se realizo un
inventario del estado real de los motores de calculo ejecutables por modalidad
(no asumido, verificado leyendo directamente cada archivo fuente en GitHub):

- NCRP151 aceleradores/radioterapia: `ncrp151-acelerador-barreras-references.ts`
  y `ncrp151-laberintos-puertas-references.ts` YA contenian funciones ejecutables
  completas (barrera primaria/secundaria, laberintos, puertas, neutrones, gammas
  de captura) de una sesion anterior. No requirieron trabajo nuevo en esta sesion.
- Braquiterapia (IAEA SRS-47): `srs47-braquiterapia-references.ts` solo tenia
  tablas de datos (Tablas 19-23) sin funciones de calculo ejecutables (asi lo
  indicaba explicitamente un comentario en el propio archivo). Se completo esto:
  se agregaron `calcularCargaTrabajoBraquiterapiaViaRAKR`/`ViaKerma` (Ec. 33/34),
  `calcularTasaDosisSinBlindajeBraquiterapiaViaRAKR`/`ViaKerma` (Ec. 35/36),
  `calcularFactorTransmisionBarreraBraquiterapiaSemanal` (Ec. 37/38, U=1 fijo),
  `calcularFactorTransmisionInstantaneaBraquiterapia` (verificacion IDR) y
  `calcularEspesorBarreraBraquiterapia` (TVL unico de Tabla 22).

Estas funciones se validaron con `ejecutarCasosDeRegresionBraquiterapia()` contra
el ejemplo numerico COMPLETO de la Seccion 8.5 del SRS-47 (sala HDR de Co-60 con
15/20 fuentes de 18,5 GBq c/u, y sub-ejemplo con 1 fuente de Ir-192 de 370 GBq),
releido directamente de "SRS 47.txt" en Drive para extraer los valores de entrada
reales (P, d, T, RAKR, actividad, tiempo, numero de tratamientos). Los resultados
calculados reproducen los espesores publicados por el documento (554 mm y 676 mm)
dentro de menos del 1% de tolerancia, sin fabricar ningun valor de entrada.

Commit: `231f921` (rama `feature/fase23-petct-fase-a-arquitectura`), archivo
`frontend/web/src/lib/srs47-braquiterapia-references.ts`. No se modificaron DB/API.

Pendiente para continuar la Fase 5-8: (1) wiring de las funciones de braquiterapia
y de aceleradores en `blindaje-app.tsx` (UI/wizard), similar al patron ya usado
para el selector de radionuclidos PET/PET-CT; (2) diagnostico por imagenes
(NCRP147) aun solo tiene catalogo de referencia, sin motor de calculo ejecutable
propio mas alla del modelo de Archer generico ya presente en `blindaje-calc-engine.ts`.


## Actualizacion (19/09/2026, continuacion Fase 5-8 - barrera primaria aceleradores)

Se completo el punto (1) pendiente para radioterapia/aceleradores mencionado arriba: se agrego wiring de UI/wizard para el calculo de barrera PRIMARIA (NCRP151, Ecuaciones 2.1-2.3) en `blindaje-app.tsx`, siguiendo el mismo patron ya usado para braquiterapia (boton "Calcular"). Cambios: (1) el campo "Energia nominal" de la fuente de radiacion pasa a ser un selector (no texto libre) poblado desde los valores reales de energiaMV de `TVL_BARRERA_PRIMARIA_NCRP151` (Tabla B.2) cuando la instalacion es radioterapia, evitando errores de coincidencia de texto contra la tabla; (2) nueva funcion `calcularBarreraPrimariaAceleradorClick()` que usa `calcularFactorTransmisionBarreraPrimaria` (Ec. 2.1), `calcularNumeroTVL` (Ec. 2.2) y `calcularEspesorBarrera` (Ec. 2.3), todas ya existentes y verificadas en `ncrp151-acelerador-barreras-references.ts` de una sesion anterior; (3) el boton "Calcular barrera primaria (NCRP151, Ec. 2.1-2.3)" aparece en el Paso 7 cuando facility_type es radioterapia, junto al boton de braquiterapia ya existente (mutuamente excluyentes segun modalidad).

Alcance explicito: esta calculadora cubre UNICAMENTE barrera PRIMARIA. Barrera secundaria (radiacion dispersada por el paciente, Ec. 2.7, y fuga del cabezal, Ec. 2.8) y la "regla de las dos fuentes" para combinarlas quedan pendientes para una fase posterior; las funciones correspondientes (`calcularFactorTransmisionDispersionPaciente`, `calcularFactorTransmisionFuga`, `combinarBarreraSecundariaDosFuentes`) ya existen en `ncrp151-acelerador-barreras-references.ts` pero aun no estan conectadas a la UI.

Verificado en vivo (rama `feature/fase23-petct-fase-a-arquitectura`, proyecto de prueba "Test Paso 13 Medicina Nuclear", facility_type=radioterapia): fuente con energia "6" MV, carga de trabajo 500 Gy/sem, PIR con T=0.5 (NCRP151 Tabla B.1, codigo T2_SALA_ADYACENTE) y P=0.0001 Sv/semana (NCRP151, criterio POE) a 3 m, barrera primaria en hormigon con U=0.5. Resultado calculado: B=7.200e-6, n=5.14 TVL, espesor requerido=173.7 cm, consistente con TVL1=37 cm y TVLe=33 cm de la Tabla B.2 para hormigon a 6 MV. Commits: `db8c70a` (funcion y boton) y `15c0022` (fix de build: guardia de `source`/`workload` posiblemente `undefined`, mismo patron que la funcion de braquiterapia).

Pendiente para continuar Fase 5-8: (1) barrera secundaria para aceleradores (Ecs. 2.7, 2.8 y regla de las dos fuentes); (2) diagnostico por imagenes (NCRP147) sigue sin motor de calculo ejecutable propio.
