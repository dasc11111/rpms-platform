// Modulo: Sistema Experto de Gestion de Desechos Radiactivos - Fase B (Esquema)
//
// Nuevo modelo de datos para el "PROMPT MAESTRO DEFINITIVO - SISTEMA EXPERTO
// PARA GESTION, EVALUACION Y CLASIFICACION INDIVIDUAL DE DESECHOS RADIACTIVOS
// EN MEDICINA NUCLEAR". Convive con el modulo anterior (src/lib/waste.ts):
// ninguna tabla ni columna existente se modifica de forma destructiva ni se
// elimina. Todo lo nuevo vive en tablas separadas (prefijo waste_item_*) mas
// columnas aditivas y opcionales en "radionuclides". Idempotente: se puede
// ejecutar mas de una vez sin efectos adversos (CREATE/ADD COLUMN IF NOT EXISTS).
//
// Principios de diseno (Secciones 2, 4, 5, 44 del Prompt Maestro Definitivo):
// - Cada residuo es una entidad individual con ficha propia (waste_items) e
//   historial completo de trazabilidad.
// - Los criterios regulatorios (contaminacion y liberacion) viven en tablas
//   configurables con jurisdiccion/documento/version/vigencia, nunca fijos
//   en formulas.
// - La calibracion de instrumentos por radionuclido/geometria/distancia vive
//   en una matriz con vigencia explicita.

import { sql } from "@/lib/db";

let wasteItemsTableEnsured = false;
export async function ensureWasteItemsTable(): Promise<void> {
    if (wasteItemsTableEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_items (
              id SERIAL PRIMARY KEY,
                    item_code TEXT UNIQUE NOT NULL,
                          radionuclide_code TEXT NOT NULL REFERENCES radionuclides(code),
                                tipo_residuo TEXT NOT NULL,
                                      tipo_residuo_otro TEXT,
                                            descripcion TEXT,
                                                  fecha_hora_generacion TIMESTAMPTZ NOT NULL,
                                                        zona_horaria TEXT NOT NULL DEFAULT 'America/Santiago',
                                                              actividad_inicial NUMERIC,
                                                                    unidad_actividad TEXT NOT NULL DEFAULT 'mCi',
                                                                          masa_g NUMERIC,
                                                                                volumen_ml NUMERIC,
                                                                                      superficie_estimada_cm2 NUMERIC,
                                                                                            ubicacion TEXT,
                                                                                                  contenedor TEXT,
                                                                                                        area_almacenamiento TEXT,
                                                                                                              responsable TEXT,
                                                                                                                    estado TEXT NOT NULL DEFAULT 'registrado',
                                                                                                                          fecha_teorica_cumplimiento DATE,
                                                                                                                                fecha_recomendada_nueva_medicion DATE,
                                                                                                                                      fecha_verificacion DATE,
                                                                                                                                            fecha_liberacion_autorizada DATE,
                                                                                                                                                  origen_room_release_id INTEGER REFERENCES room_release_records(id),
                                                                                                                                                        origen_waste_label_id INTEGER REFERENCES radioactive_waste_labels(id),
                                                                                                                                                              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                                                                                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                                                                        );
                                                                                                                                                                          `;
    await sql`CREATE INDEX IF NOT EXISTS waste_items_radionuclide_idx ON waste_items(radionuclide_code)`;
    await sql`CREATE INDEX IF NOT EXISTS waste_items_estado_idx ON waste_items(estado)`;
    wasteItemsTableEnsured = true;
}

let wasteCalibrationMatrixEnsured = false;
export async function ensureWasteCalibrationMatrix(): Promise<void> {
    if (wasteCalibrationMatrixEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_calibration_matrix (
              id SERIAL PRIMARY KEY,
                    instrumento TEXT NOT NULL,
                          radionuclide_code TEXT NOT NULL REFERENCES radionuclides(code),
                                geometria TEXT,
                                      distancia_cm NUMERIC,
                                            metodo TEXT NOT NULL,
                                                  eficiencia NUMERIC,
                                                        factor_calibracion NUMERIC,
                                                              area_efectiva_cm2 NUMERIC,
                                                                    fecha_calibracion DATE,
                                                                          fecha_vigencia_hasta DATE,
                                                                                vigente BOOLEAN NOT NULL DEFAULT true,
                                                                                      documento_fuente TEXT,
                                                                                            notes TEXT,
                                                                                                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                            );
                                                                                                              `;
    await sql`CREATE INDEX IF NOT EXISTS waste_calibration_matrix_rn_idx ON waste_calibration_matrix(radionuclide_code)`;
    wasteCalibrationMatrixEnsured = true;
}

let wasteContaminationCriteriaEnsured = false;
export async function ensureWasteContaminationCriteria(): Promise<void> {
    if (wasteContaminationCriteriaEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_contamination_criteria (
              id SERIAL PRIMARY KEY,
                    jurisdiccion TEXT NOT NULL DEFAULT 'Chile',
                          documento_fuente TEXT NOT NULL,
                                version TEXT,
                                      fecha_vigencia_desde DATE,
                                            fecha_vigencia_hasta DATE,
                                                  clase TEXT,
                                                        radionuclide_code TEXT REFERENCES radionuclides(code),
                                                              tipo_superficie TEXT NOT NULL,
                                                                    tipo_criterio TEXT NOT NULL DEFAULT 'contaminacion',
                                                                          parametro TEXT NOT NULL DEFAULT 'bq_cm2',
                                                                                valor NUMERIC NOT NULL,
                                                                                      unidad TEXT NOT NULL DEFAULT 'Bq/cm2',
                                                                                            condicion_aplicacion TEXT,
                                                                                                  active BOOLEAN NOT NULL DEFAULT true,
                                                                                                        notes TEXT,
                                                                                                              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                        );
                                                                                                                          `;
    const { rows } = await sql`SELECT COUNT(*)::int AS count FROM waste_contamination_criteria`;
    if ((rows[0]?.count ?? 0) === 0) {
          await sql`
                INSERT INTO waste_contamination_criteria
                        (documento_fuente, version, clase, tipo_superficie, tipo_criterio, parametro, valor, unidad, condicion_aplicacion, notes)
                              VALUES
                                      ('REX DISNR N.º 051/2021 (CCHEN) / Norma NS-06.0', 'PENDIENTE DE VERIFICACION', 'PENDIENTE DE VERIFICACION', 'superficie_equipo_area_controlada', 'contaminacion', 'bq_cm2', 30, 'Bq/cm2', 'Superficies y equipamiento en areas controladas', 'Valor heredado del modulo anterior (ACTA_LIMITE_AREA_CONTROLADA_BQ_CM2). Debe ser validado por el OPR contra el documento fuente oficial antes de usarse como definitivo.'),
                                              ('REX DISNR N.º 051/2021 (CCHEN) / Norma NS-06.0', 'PENDIENTE DE VERIFICACION', 'PENDIENTE DE VERIFICACION', 'area_supervisada_publico_vestimenta_ropa_cama', 'contaminacion', 'bq_cm2', 3, 'Bq/cm2', 'Areas supervisadas y de acceso publico, vestimenta y ropa de cama', 'Valor heredado del modulo anterior (ACTA_LIMITE_AREA_PUBLICA_BQ_CM2). Debe ser validado por el OPR contra el documento fuente oficial antes de usarse como definitivo.')
                                                  `;
    }
    wasteContaminationCriteriaEnsured = true;
}

let wasteReleaseCriteriaExpertEnsured = false;
export async function ensureWasteReleaseCriteriaExpert(): Promise<void> {
    if (wasteReleaseCriteriaExpertEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_release_criteria_expert (
              id SERIAL PRIMARY KEY,
                    jurisdiccion TEXT NOT NULL DEFAULT 'Chile',
                          documento_fuente TEXT NOT NULL,
                                version TEXT,
                                      fecha_vigencia_desde DATE,
                                            fecha_vigencia_hasta DATE,
                                                  radionuclide_code TEXT REFERENCES radionuclides(code),
                                                        tipo_residuo TEXT,
                                                              via_eliminacion TEXT,
                                                                    parametro TEXT NOT NULL,
                                                                          valor NUMERIC NOT NULL,
                                                                                unidad TEXT NOT NULL,
                                                                                      autoridad TEXT,
                                                                                            condicion_aplicacion TEXT,
                                                                                                  active BOOLEAN NOT NULL DEFAULT true,
                                                                                                        notes TEXT,
                                                                                                              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                                                                                                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                        );
                                                                                                                          `;
    wasteReleaseCriteriaExpertEnsured = true;
}

let wasteItemMeasurementsEnsured = false;
export async function ensureWasteItemMeasurements(): Promise<void> {
    if (wasteItemMeasurementsEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_item_measurements (
              id SERIAL PRIMARY KEY,
                    waste_item_id INTEGER NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,
                          tipo_medicion TEXT NOT NULL,
                                fecha DATE NOT NULL,
                                      hora TIME,
                                            instrumento TEXT,
                                                  calibration_id INTEGER REFERENCES waste_calibration_matrix(id),
                                                        cps_bruto NUMERIC,
                                                              cps_fondo NUMERIC,
                                                                    cps_neto NUMERIC,
                                                                          tiempo_medicion_s NUMERIC,
                                                                                metodo_conversion TEXT,
                                                                                      eficiencia_usada NUMERIC,
                                                                                            factor_calibracion_usado NUMERIC,
                                                                                                  area_medicion_cm2 NUMERIC,
                                                                                                        area_tipo TEXT,
                                                                                                              actividad_bq NUMERIC,
                                                                                                                    actividad_bq_cm2 NUMERIC,
                                                                                                                          contaminacion_removible BOOLEAN,
                                                                                                                                tasa_dosis_bruta_usv_h NUMERIC,
                                                                                                                                      tasa_dosis_fondo_usv_h NUMERIC,
                                                                                                                                            tasa_dosis_neta_usv_h NUMERIC,
                                                                                                                                                  distancia_cm NUMERIC,
                                                                                                                                                        posicion TEXT,
                                                                                                                                                              incertidumbre_absoluta NUMERIC,
                                                                                                                                                                    incertidumbre_relativa_pct NUMERIC,
                                                                                                                                                                          umbral_decision NUMERIC,
                                                                                                                                                                                limite_deteccion NUMERIC,
                                                                                                                                                                                      resultado_metrologico TEXT,
                                                                                                                                                                                            criterio_aplicado_id INTEGER REFERENCES waste_contamination_criteria(id),
                                                                                                                                                                                                  cumple_criterio BOOLEAN,
                                                                                                                                                                                                        usuario TEXT,
                                                                                                                                                                                                              observaciones TEXT,
                                                                                                                                                                                                                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                                                                                                                                                                        );
                                                                                                                                                                                                                          `;
    await sql`CREATE INDEX IF NOT EXISTS waste_item_measurements_item_idx ON waste_item_measurements(waste_item_id)`;
    wasteItemMeasurementsEnsured = true;
}

let wasteItemContaminationGridEnsured = false;
export async function ensureWasteItemContaminationGrid(): Promise<void> {
    if (wasteItemContaminationGridEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_item_contamination_grid (
              id SERIAL PRIMARY KEY,
                    measurement_id INTEGER NOT NULL REFERENCES waste_item_measurements(id) ON DELETE CASCADE,
                          punto TEXT NOT NULL,
                                cps_bruto NUMERIC,
                                      cps_fondo NUMERIC,
                                            cps_neto NUMERIC,
                                                  actividad_bq_cm2 NUMERIC,
                                                        incertidumbre NUMERIC,
                                                              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                  );
                                                                    `;
    await sql`CREATE INDEX IF NOT EXISTS waste_item_contamination_grid_measurement_idx ON waste_item_contamination_grid(measurement_id)`;
    wasteItemContaminationGridEnsured = true;
}

let wasteItemStatusHistoryEnsured = false;
export async function ensureWasteItemStatusHistory(): Promise<void> {
    if (wasteItemStatusHistoryEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_item_status_history (
              id SERIAL PRIMARY KEY,
                    waste_item_id INTEGER NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,
                          estado_anterior TEXT,
                                estado_nuevo TEXT NOT NULL,
                                      motivo TEXT,
                                            usuario TEXT,
                                                  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
                                                      );
                                                        `;
    await sql`CREATE INDEX IF NOT EXISTS waste_item_status_history_item_idx ON waste_item_status_history(waste_item_id)`;
    wasteItemStatusHistoryEnsured = true;
}

let wasteItemCorrectionsEnsured = false;
export async function ensureWasteItemCorrections(): Promise<void> {
    if (wasteItemCorrectionsEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_item_corrections (
              id SERIAL PRIMARY KEY,
                    waste_item_id INTEGER REFERENCES waste_items(id) ON DELETE CASCADE,
                          measurement_id INTEGER REFERENCES waste_item_measurements(id) ON DELETE CASCADE,
                                campo TEXT NOT NULL,
                                      valor_anterior TEXT,
                                            valor_nuevo TEXT,
                                                  usuario TEXT,
                                                        motivo TEXT NOT NULL,
                                                              impacto_recalculo TEXT,
                                                                    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                        );
                                                                          `;
    wasteItemCorrectionsEnsured = true;
}

let wasteItemAuthorizationsEnsured = false;
export async function ensureWasteItemAuthorizations(): Promise<void> {
    if (wasteItemAuthorizationsEnsured) return;
    await sql`
        CREATE TABLE IF NOT EXISTS waste_item_authorizations (
              id SERIAL PRIMARY KEY,
                    waste_item_id INTEGER NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,
                          tipo TEXT NOT NULL,
                                autorizado_por TEXT NOT NULL,
                                      fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
                                            criterios_verificados JSONB,
                                                  observaciones TEXT
                                                      );
                                                        `;
    wasteItemAuthorizationsEnsured = true;
}

// Columnas aditivas en "radionuclides" (Seccion 7 del Prompt Maestro
// Definitivo: simbolo, tipo de emision, energias, progenitor/descendientes,
// fuente tecnica). No se modifica ni elimina ninguna columna existente.
let radionuclidesExpertColumnsEnsured = false;
export async function ensureRadionuclidesExpertColumns(): Promise<void> {
    if (radionuclidesExpertColumnsEnsured) return;
    await sql`ALTER TABLE radionuclides ADD COLUMN IF NOT EXISTS symbol TEXT`;
    await sql`ALTER TABLE radionuclides ADD COLUMN IF NOT EXISTS tipo_emision TEXT`;
    await sql`ALTER TABLE radionuclides ADD COLUMN IF NOT EXISTS energias_kev TEXT`;
    await sql`ALTER TABLE radionuclides ADD COLUMN IF NOT EXISTS parent_code TEXT REFERENCES radionuclides(code)`;
    await sql`ALTER TABLE radionuclides ADD COLUMN IF NOT EXISTS fuente_tecnica TEXT`;
    radionuclidesExpertColumnsEnsured = true;
}

// Amplia el catalogo con F-18 e Y-90 (Seccion 7), sin sobrescribir
// radionuclidos ya existentes (Tc-99m, Mo-99, I-131). Registra ademas la
// relacion progenitor/descendiente Mo-99 -> Tc-99m (Seccion 13).
let wasteRadionuclidesExpertSeedEnsured = false;
export async function ensureWasteRadionuclidesExpertSeed(): Promise<void> {
    if (wasteRadionuclidesExpertSeedEnsured) return;
    await ensureRadionuclidesExpertColumns();
    await sql`
        INSERT INTO radionuclides (code, name, half_life_days, unit, active, sort_order, notes, symbol, tipo_emision, fuente_tecnica)
            VALUES
                  ('F-18', 'Fluor-18', 0.0761, 'mCi', true, 10, 'Vida media 109.77 min. Emisor beta+ (aniquilacion, fotones de 511 keV). PENDIENTE DE VERIFICACION por Fisico Nuclear/OPR antes de uso clinico en este modulo.', 'F-18', 'beta_plus', 'PENDIENTE DE VERIFICACION'),
                        ('Y-90', 'Itrio-90', 2.6684, 'mCi', true, 11, 'Vida media 64.05 h. Emisor beta puro. PENDIENTE DE VERIFICACION por Fisico Nuclear/OPR antes de uso clinico en este modulo.', 'Y-90', 'beta_menos', 'PENDIENTE DE VERIFICACION')
                            ON CONFLICT (code) DO NOTHING
                              `;
    await sql`UPDATE radionuclides SET symbol = 'Mo-99', tipo_emision = 'beta_menos_gamma' WHERE code = 'MO-99' AND symbol IS NULL`;
    await sql`UPDATE radionuclides SET symbol = 'Tc-99m', tipo_emision = 'gamma', parent_code = 'MO-99' WHERE code = 'TC-99M' AND symbol IS NULL`;
    await sql`UPDATE radionuclides SET symbol = 'I-131' WHERE code = 'I-131' AND symbol IS NULL`;
    wasteRadionuclidesExpertSeedEnsured = true;
}

// Punto de entrada unico: crea/actualiza todo el esquema nuevo de la Fase B
// sin tocar el modulo anterior (waste.ts). Debe llamarse desde una unica
// ruta de init (/api/init/waste-expert) para mantener el mismo patron ya
// usado en el resto del proyecto.
export async function ensureWasteExpertSchema(): Promise<void> {
    await ensureRadionuclidesExpertColumns();
    await ensureWasteRadionuclidesExpertSeed();
    await ensureWasteItemsTable();
    await ensureWasteCalibrationMatrix();
    await ensureWasteContaminationCriteria();
    await ensureWasteReleaseCriteriaExpert();
    await ensureWasteItemMeasurements();
    await ensureWasteItemContaminationGrid();
    await ensureWasteItemStatusHistory();
    await ensureWasteItemCorrections();
    await ensureWasteItemAuthorizations();
}
