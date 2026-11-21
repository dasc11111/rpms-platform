-- V0002: equipment, instruments, dosimeters y series temporales de dosis
-- Dialect: PostgreSQL 16 (con timescaledb para hypertable de dose_reading)

BEGIN;
SET search_path TO rpms, public;

-- =====================================================================
-- Tabla: equipment (equipos generadores de radiación o de imagen)
-- =====================================================================
CREATE TABLE equipment (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    room_id            UUID REFERENCES room(id),
    service_id         UUID REFERENCES service(id),
    equipment_type     TEXT NOT NULL
                       CHECK (equipment_type IN (
                           'linac','ct','pet','pet_ct','pet_mr','mri','mammography',
                           'fluoroscopy','interventional','xray_general','xray_dental',
                           'dexa','gamma_camera','spect','brachytherapy','cyclotron',
                           'industrial_radiography','well_logging','other')),
    manufacturer       TEXT,
    model              TEXT,
    serial_number      TEXT,
    installation_date  DATE,
    commissioning_date DATE,
    firmware_version   TEXT,
    provider_id        UUID,
    status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','maintenance','out_of_service','decommissioned')),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, manufacturer, model, serial_number)
);

CREATE INDEX ix_equipment_tenant ON equipment(tenant_id);
CREATE INDEX ix_equipment_room   ON equipment(room_id);
CREATE INDEX ix_equipment_status ON equipment(status);

-- =====================================================================
-- Tabla: instrument (dosímetros de lectura, contaminómetros, activímetros)
-- =====================================================================
CREATE TABLE instrument (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    owner_service_id         UUID REFERENCES service(id),
    instrument_type          TEXT NOT NULL
                             CHECK (instrument_type IN (
                                 'personal_dosimeter_reader','contamination_monitor',
                                 'area_monitor','ionization_chamber','activity_meter',
                                 'well_counter','survey_meter','pen_dosimeter','other')),
    manufacturer             TEXT,
    model                    TEXT,
    serial_number            TEXT,
    last_calibration_at      DATE,
    next_calibration_at      DATE,
    calibration_certificate_id UUID,
    qr_token                 TEXT UNIQUE,
    status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','out_of_service','retired')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_instrument_tenant     ON instrument(tenant_id);
CREATE INDEX ix_instrument_next_cal   ON instrument(next_calibration_at);

-- =====================================================================
-- Tabla: dosimeter (dosímetro personal asignado a un trabajador)
-- =====================================================================
CREATE TABLE dosimeter (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    worker_id      UUID NOT NULL REFERENCES worker(id) ON DELETE RESTRICT,
    dosimeter_type TEXT NOT NULL
                   CHECK (dosimeter_type IN ('tld','osl','film','epd','pen','other')),
    provider       TEXT,
    external_code  TEXT NOT NULL,
    body_location  TEXT NOT NULL
                   CHECK (body_location IN ('whole_body','lens','extremity','abdomen','other')),
    issued_at      DATE NOT NULL,
    returned_at    DATE,
    status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','returned','lost','damaged')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider, external_code, issued_at)
);

CREATE INDEX ix_dosimeter_worker ON dosimeter(worker_id);
CREATE INDEX ix_dosimeter_status ON dosimeter(status);

-- =====================================================================
-- Tabla: dose_reading (hypertable temporal - lectura dosimétrica)
-- =====================================================================
CREATE TABLE dose_reading (
    id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    time                TIMESTAMPTZ NOT NULL,
    tenant_id           UUID NOT NULL,
    worker_id           UUID NOT NULL,
    dosimeter_id        UUID NOT NULL,
    hp10_msv            NUMERIC(10,4),  -- profunda 10 mm
    hp007_msv           NUMERIC(10,4),  -- superficial 0.07 mm
    hp3_msv             NUMERIC(10,4),  -- cristalino 3 mm
    neutron_msv         NUMERIC(10,4),
    provider_report_id  TEXT,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    is_anomaly          BOOLEAN NOT NULL DEFAULT FALSE,
    anomaly_reason      TEXT,
    imported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_from       TEXT,
    PRIMARY KEY (id, time)
);

-- Producción: SELECT create_hypertable('dose_reading', 'time');
CREATE INDEX ix_dose_worker_time  ON dose_reading (worker_id, time DESC);
CREATE INDEX ix_dose_tenant_time  ON dose_reading (tenant_id, time DESC);
CREATE INDEX ix_dose_anomaly      ON dose_reading (tenant_id, is_anomaly) WHERE is_anomaly = TRUE;

-- =====================================================================
-- Vista materializada: worker_dose_summary (mensual)
-- =====================================================================
-- En producción se usa continuous aggregate de timescaledb.
-- Aquí se crea como vista para MVP.
CREATE VIEW worker_dose_summary_monthly AS
SELECT
    tenant_id,
    worker_id,
    date_trunc('month', time) AS month,
    SUM(COALESCE(hp10_msv, 0))    AS hp10_msv_sum,
    SUM(COALESCE(hp007_msv, 0))   AS hp007_msv_sum,
    SUM(COALESCE(hp3_msv, 0))     AS hp3_msv_sum,
    SUM(COALESCE(neutron_msv, 0)) AS neutron_msv_sum,
    COUNT(*)                       AS reading_count,
    BOOL_OR(is_anomaly)            AS has_anomaly
FROM dose_reading
GROUP BY tenant_id, worker_id, date_trunc('month', time);

COMMIT;
