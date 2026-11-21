-- V0001: base schema — tenants, workers, facilities, services, rooms
-- Dialect: PostgreSQL 16

BEGIN;

CREATE SCHEMA IF NOT EXISTS rpms;
SET search_path TO rpms, public;

-- Extensiones requeridas (a activar en producción, se listan por documentación)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================================
-- Tabla: tenant
-- =====================================================================
CREATE TABLE tenant (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    slug                    TEXT NOT NULL UNIQUE,
    country_code            CHAR(2) NOT NULL,
    jurisdiction_profile_id UUID,
    plan                    TEXT NOT NULL DEFAULT 'starter',
    data_region             TEXT NOT NULL DEFAULT 'scl',
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended','archived')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_tenant_country ON tenant(country_code);
CREATE INDEX ix_tenant_status  ON tenant(status);

-- =====================================================================
-- Tabla: app_user (identidad de plataforma)
-- =====================================================================
CREATE TABLE app_user (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    email                   TEXT NOT NULL,
    phone                   TEXT,
    full_name               TEXT NOT NULL,
    identity_provider_sub   TEXT,
    mfa_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended','deactivated')),
    last_login_at           TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX ix_user_tenant ON app_user(tenant_id);

-- =====================================================================
-- Tabla: facility (instalación radiactiva)
-- =====================================================================
CREATE TABLE facility (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    facility_type TEXT NOT NULL
                  CHECK (facility_type IN ('hospital','clinic','pet_center','industrial',
                                           'academic','veterinary','dental','laboratory',
                                           'regulator')),
    address       TEXT,
    city          TEXT,
    country_code  CHAR(2) NOT NULL,
    latitude      NUMERIC(9,6),
    longitude     NUMERIC(9,6),
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_facility_tenant ON facility(tenant_id);

-- =====================================================================
-- Tabla: service (unidad clínica / servicio radiológico)
-- =====================================================================
CREATE TABLE service (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    facility_id    UUID NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    service_type   TEXT NOT NULL
                   CHECK (service_type IN ('radiotherapy','nuclear_medicine','imaging',
                                           'interventional','dental','industrial',
                                           'research','other')),
    head_user_id   UUID REFERENCES app_user(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_service_facility ON service(facility_id);

-- =====================================================================
-- Tabla: room (sala física)
-- =====================================================================
CREATE TABLE room (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    service_id   UUID NOT NULL REFERENCES service(id) ON DELETE CASCADE,
    code         TEXT NOT NULL,
    name         TEXT NOT NULL,
    room_type    TEXT NOT NULL
                 CHECK (room_type IN ('bunker','ct','pet','mri','xray','fluoro',
                                      'mammo','angio','brachy','source_storage',
                                      'waste','control','other')),
    floor        TEXT,
    area_m2      NUMERIC(8,2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (service_id, code)
);

-- =====================================================================
-- Tabla: worker (persona ocupacionalmente expuesta - POE)
-- =====================================================================
CREATE TABLE worker (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    national_id           TEXT NOT NULL,
    national_id_country   CHAR(2) NOT NULL DEFAULT 'CL',
    full_name             TEXT NOT NULL,
    birth_date            DATE,
    sex                   CHAR(1) CHECK (sex IN ('F','M','X')),
    photo_url             TEXT,
    signature_url         TEXT,
    profession            TEXT,
    job_title             TEXT,
    icrp_category         CHAR(1) CHECK (icrp_category IN ('A','B')),
    primary_facility_id   UUID REFERENCES facility(id),
    primary_service_id    UUID REFERENCES service(id),
    hire_date             DATE,
    status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','onboarding','terminated')),
    qr_token              TEXT UNIQUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, national_id, national_id_country)
);

CREATE INDEX ix_worker_tenant       ON worker(tenant_id);
CREATE INDEX ix_worker_service      ON worker(primary_service_id);
CREATE INDEX ix_worker_status       ON worker(status) WHERE status = 'active';
CREATE INDEX ix_worker_name_trgm    ON worker USING GIN (full_name gin_trgm_ops);

-- =====================================================================
-- Auditoría (append-only)
-- =====================================================================
CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id    UUID,
    actor_user_id UUID,
    actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('user','service','ai','system')),
    action       TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    entity_id    UUID,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address   INET,
    user_agent   TEXT,
    session_id   TEXT
);

CREATE INDEX ix_audit_at        ON audit_log(at DESC);
CREATE INDEX ix_audit_entity    ON audit_log(entity_type, entity_id);
CREATE INDEX ix_audit_tenant    ON audit_log(tenant_id, at DESC);

COMMIT;
