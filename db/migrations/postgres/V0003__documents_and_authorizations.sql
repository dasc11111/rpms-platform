-- V0003: documents (con chunks vectorizados), autorizaciones, licencias, capacitaciones
-- Dialect: PostgreSQL 16 (con pgvector)

BEGIN;
SET search_path TO rpms, public;

-- =====================================================================
-- Tabla: document (gestión documental)
-- =====================================================================
CREATE TABLE document (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    original_filename   TEXT NOT NULL,
    sha256              CHAR(64) NOT NULL,
    size_bytes          BIGINT NOT NULL,
    mime_type           TEXT NOT NULL,
    storage_uri         TEXT NOT NULL,
    document_type       TEXT,  -- ver diccionario DT001..DTNNN
    document_type_confidence NUMERIC(5,4),
    version             INT NOT NULL DEFAULT 1,
    parent_document_id  UUID REFERENCES document(id),
    worm_locked         BOOLEAN NOT NULL DEFAULT FALSE,
    ocr_status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (ocr_status IN ('pending','processing','done','failed','skipped')),
    ocr_engine          TEXT,
    ocr_completed_at    TIMESTAMPTZ,
    extracted_metadata  JSONB NOT NULL DEFAULT '{}'::jsonb,
    related_entities    JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- related_entities: [{"type":"worker","id":"...","score":0.94}, ...]
    uploaded_by         UUID REFERENCES app_user(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sha256, version)
);

CREATE INDEX ix_document_tenant       ON document(tenant_id);
CREATE INDEX ix_document_type         ON document(document_type);
CREATE INDEX ix_document_meta_gin     ON document USING GIN (extracted_metadata);
CREATE INDEX ix_document_related_gin  ON document USING GIN (related_entities);

-- =====================================================================
-- Tabla: document_chunk (para RAG - texto + embedding)
-- =====================================================================
CREATE TABLE document_chunk (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    document_id   UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    chunk_index   INT NOT NULL,
    page          INT,
    bbox          JSONB,
    text          TEXT NOT NULL,
    -- Producción: embedding VECTOR(1024) con extensión pgvector
    embedding     TEXT,  -- placeholder; en Postgres real es VECTOR
    token_count   INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX ix_chunk_document ON document_chunk(document_id);
CREATE INDEX ix_chunk_text_trgm ON document_chunk USING GIN (text gin_trgm_ops);
-- Producción: CREATE INDEX ix_chunk_embedding ON document_chunk USING hnsw (embedding vector_cosine_ops);

-- =====================================================================
-- Tabla: authorization (autorización individual del trabajador)
-- =====================================================================
CREATE TABLE authorization (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    worker_id         UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    authorization_type TEXT NOT NULL
                      CHECK (authorization_type IN ('operator','opr','opr_alternate',
                                                    'medical_physicist','radiopharmacist',
                                                    'source_carrier','other')),
    scope             JSONB NOT NULL DEFAULT '[]'::jsonb,
    issued_by         TEXT NOT NULL,
    issued_at         DATE NOT NULL,
    expires_at        DATE,
    document_id       UUID REFERENCES document(id),
    number            TEXT,
    status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','expired','revoked','pending')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_auth_worker      ON authorization(worker_id);
CREATE INDEX ix_auth_expires     ON authorization(expires_at) WHERE status = 'active';
CREATE INDEX ix_auth_type        ON authorization(authorization_type);

-- =====================================================================
-- Tabla: license (licencia de instalación o de equipo)
-- =====================================================================
CREATE TABLE license (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('facility','equipment','worker')),
    subject_id    UUID NOT NULL,
    license_type  TEXT NOT NULL,
    number        TEXT NOT NULL,
    issued_by     TEXT NOT NULL,
    issued_at     DATE NOT NULL,
    expires_at    DATE,
    document_id   UUID REFERENCES document(id),
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','expired','revoked','pending')),
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_license_subject ON license(subject_type, subject_id);
CREATE INDEX ix_license_expires ON license(expires_at) WHERE status = 'active';

-- =====================================================================
-- Tabla: training (capacitación)
-- =====================================================================
CREATE TABLE training (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    worker_id          UUID NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    course_name        TEXT NOT NULL,
    course_provider    TEXT,
    hours              NUMERIC(6,1),
    date_completed     DATE NOT NULL,
    certificate_document_id UUID REFERENCES document(id),
    next_renewal_at    DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_training_worker  ON training(worker_id);
CREATE INDEX ix_training_renewal ON training(next_renewal_at);

-- =====================================================================
-- Tabla: knowledge_edge (motor de relaciones - grafo)
-- =====================================================================
CREATE TABLE knowledge_edge (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       UUID NOT NULL,
    target_type     TEXT NOT NULL,
    target_id       UUID NOT NULL,
    relation        TEXT NOT NULL,
    weight          NUMERIC(5,3) NOT NULL DEFAULT 1.0,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    discovered_by   TEXT NOT NULL CHECK (discovered_by IN ('rule','ai','user','import')),
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, source_type, source_id, target_type, target_id, relation)
);

CREATE INDEX ix_edge_src ON knowledge_edge(tenant_id, source_type, source_id);
CREATE INDEX ix_edge_tgt ON knowledge_edge(tenant_id, target_type, target_id);
CREATE INDEX ix_edge_rel ON knowledge_edge(tenant_id, relation);

COMMIT;
