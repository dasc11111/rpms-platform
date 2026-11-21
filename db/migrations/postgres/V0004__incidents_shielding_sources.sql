-- V0004: incidentes, auditorías, blindajes, fuentes radiactivas, radiofármacos, residuos
-- Dialect: PostgreSQL 16

BEGIN;
SET search_path TO rpms, public;

-- =====================================================================
-- Tabla: incident
-- =====================================================================
CREATE TABLE incident (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    reference_code        TEXT NOT NULL,
    reported_by           UUID REFERENCES app_user(id),
    reported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    occurred_at           TIMESTAMPTZ NOT NULL,
    incident_type         TEXT NOT NULL,
    severity              TEXT NOT NULL
                          CHECK (severity IN ('L1','L2','L3','L4','L5')),
    ines_level            SMALLINT CHECK (ines_level BETWEEN 0 AND 7),
    location_room_id      UUID REFERENCES room(id),
    equipment_id          UUID REFERENCES equipment(id),
    narrative             TEXT NOT NULL,
    root_cause_analysis   JSONB NOT NULL DEFAULT '{}'::jsonb,
    workers_involved      JSONB NOT NULL DEFAULT '[]'::jsonb,
    status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','investigating','in_action','closed','regulatory_notified')),
    notified_authority_at TIMESTAMPTZ,
    closed_at             TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, reference_code)
);

CREATE INDEX ix_incident_tenant  ON incident(tenant_id);
CREATE INDEX ix_incident_status  ON incident(status) WHERE status != 'closed';
CREATE INDEX ix_incident_severity ON incident(severity);

-- =====================================================================
-- Tabla: incident_action (planes de acción)
-- =====================================================================
CREATE TABLE incident_action (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    description   TEXT NOT NULL,
    assignee_id   UUID REFERENCES app_user(id),
    due_at        DATE,
    completed_at  TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','done','cancelled')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Tabla: audit
-- =====================================================================
CREATE TABLE audit (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    scope          TEXT NOT NULL,
    audit_type     TEXT NOT NULL CHECK (audit_type IN ('internal','external','regulatory','vendor')),
    planned_date   DATE NOT NULL,
    executed_date  DATE,
    auditor_name   TEXT,
    auditor_org    TEXT,
    findings       JSONB NOT NULL DEFAULT '[]'::jsonb,
    status         TEXT NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned','in_progress','completed','followup')),
    report_document_id UUID REFERENCES document(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_regaudit_tenant ON audit(tenant_id);
CREATE INDEX ix_regaudit_status ON audit(status);

-- =====================================================================
-- Tabla: shielding (blindajes por sala)
-- =====================================================================
CREATE TABLE shielding (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    room_id                UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
    wall                   TEXT NOT NULL
                           CHECK (wall IN ('N','S','E','W','ceiling','floor','door','window')),
    material               TEXT NOT NULL,
    thickness_mm           NUMERIC(8,2) NOT NULL,
    design_document_id     UUID REFERENCES document(id),
    calculation_document_id UUID REFERENCES document(id),
    last_inspection_at     DATE,
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_shielding_room ON shielding(room_id);

-- =====================================================================
-- Tabla: radioactive_source (fuentes selladas)
-- =====================================================================
CREATE TABLE radioactive_source (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    isotope               TEXT NOT NULL,   -- Ir-192, Co-60, Cs-137, ...
    source_type           TEXT NOT NULL CHECK (source_type IN ('sealed','unsealed')),
    activity_bq_initial   NUMERIC(20,4) NOT NULL,
    activity_date         DATE NOT NULL,
    half_life_days        NUMERIC(12,4) NOT NULL,
    serial_number         TEXT,
    manufacturer          TEXT,
    location_room_id      UUID REFERENCES room(id),
    category_iaea         SMALLINT CHECK (category_iaea BETWEEN 1 AND 5),
    status                TEXT NOT NULL DEFAULT 'in_use'
                          CHECK (status IN ('in_use','in_storage','decay_storage','disposed','lost')),
    disposed_at           DATE,
    disposal_route        TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, manufacturer, serial_number, isotope)
);

CREATE INDEX ix_source_tenant ON radioactive_source(tenant_id);
CREATE INDEX ix_source_status ON radioactive_source(status);

-- =====================================================================
-- Tabla: radiopharmaceutical
-- =====================================================================
CREATE TABLE radiopharmaceutical (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    isotope               TEXT NOT NULL,
    batch                 TEXT NOT NULL,
    activity_bq           NUMERIC(20,4) NOT NULL,
    calibration_datetime  TIMESTAMPTZ NOT NULL,
    received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supplier              TEXT,
    expiration_at         TIMESTAMPTZ,
    used                  BOOLEAN NOT NULL DEFAULT FALSE,
    used_at               TIMESTAMPTZ,
    used_for_study        TEXT,
    remaining_activity_bq NUMERIC(20,4),
    disposed_as_waste_id  UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_rp_tenant ON radiopharmaceutical(tenant_id);
CREATE INDEX ix_rp_isotope ON radiopharmaceutical(isotope);

-- =====================================================================
-- Tabla: radioactive_waste
-- =====================================================================
CREATE TABLE radioactive_waste (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    waste_code         TEXT NOT NULL,
    isotope            TEXT NOT NULL,
    initial_activity_bq NUMERIC(20,4) NOT NULL,
    stored_at          TIMESTAMPTZ NOT NULL,
    storage_room_id    UUID REFERENCES room(id),
    half_life_days     NUMERIC(12,4) NOT NULL,
    ready_for_disposal_at DATE,
    disposed_at        TIMESTAMPTZ,
    disposal_route     TEXT,
    status             TEXT NOT NULL DEFAULT 'in_decay'
                       CHECK (status IN ('in_decay','ready_for_disposal','disposed')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, waste_code)
);

CREATE INDEX ix_waste_tenant ON radioactive_waste(tenant_id);
CREATE INDEX ix_waste_status ON radioactive_waste(status);

COMMIT;
