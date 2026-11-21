"""Adaptadores de infraestructura: repositorios SQLite.

En producción se sustituye por adaptadores SQLAlchemy + PostgreSQL.
La interfaz (ports) no cambia.
"""

from __future__ import annotations

import sqlite3
from datetime import date, datetime
from typing import Optional, Sequence

from ..application.ports import (
    AuthorizationRepository,
    UnitOfWork,
    WorkerRepository,
)
from ..domain import (
    Authorization,
    AuthorizationStatus,
    AuthorizationType,
    ICRPCategory,
    NationalId,
    Worker,
    WorkerStatus,
)


def _parse_date(s: Optional[str]) -> Optional[date]:
    if s is None or s == "":
        return None
    if isinstance(s, date):
        return s
    # SQLite guarda TEXT ISO
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _worker_from_row(row: sqlite3.Row) -> Worker:
    return Worker(
        id=row["id"],
        tenant_id=row["tenant_id"],
        national_id=NationalId(
            value=row["national_id"], country=row["national_id_country"]
        ),
        full_name=row["full_name"],
        icrp_category=ICRPCategory(row["icrp_category"])
        if row["icrp_category"]
        else ICRPCategory.B,
        primary_facility_id=row["primary_facility_id"],
        primary_service_id=row["primary_service_id"],
        profession=row["profession"],
        job_title=row["job_title"],
        hire_date=_parse_date(row["hire_date"]),
        birth_date=_parse_date(row["birth_date"]),
        sex=row["sex"],
        status=WorkerStatus(row["status"]),
        qr_token=row["qr_token"],
        photo_url=row["photo_url"],
        signature_url=row["signature_url"],
    )


def _authorization_from_row(row: sqlite3.Row) -> Authorization:
    import json

    scope_raw = row["scope"] or "[]"
    try:
        scope = json.loads(scope_raw)
    except (json.JSONDecodeError, TypeError):
        scope = []
    return Authorization(
        id=row["id"],
        tenant_id=row["tenant_id"],
        worker_id=row["worker_id"],
        authorization_type=AuthorizationType(row["authorization_type"]),
        issued_by=row["issued_by"],
        issued_at=_parse_date(row["issued_at"]),
        scope=scope,
        expires_at=_parse_date(row["expires_at"]),
        document_id=row["document_id"],
        number=row["number"],
        status=AuthorizationStatus(row["status"]),
    )


class SqliteWorkerRepository(WorkerRepository):
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def get(self, tenant_id: str, worker_id: str) -> Optional[Worker]:
        cur = self.conn.execute(
            "SELECT * FROM worker WHERE tenant_id=? AND id=?",
            (tenant_id, worker_id),
        )
        row = cur.fetchone()
        return _worker_from_row(row) if row else None

    def get_by_national_id(
        self, tenant_id: str, national_id_value: str, country: str
    ) -> Optional[Worker]:
        cur = self.conn.execute(
            """SELECT * FROM worker
               WHERE tenant_id=? AND national_id=? AND national_id_country=?""",
            (tenant_id, national_id_value, country),
        )
        row = cur.fetchone()
        return _worker_from_row(row) if row else None

    def save(self, worker: Worker) -> None:
        existing = self.conn.execute(
            "SELECT id FROM worker WHERE id=?", (worker.id,)
        ).fetchone()
        if existing is None:
            self.conn.execute(
                """INSERT INTO worker (
                    id, tenant_id, national_id, national_id_country, full_name,
                    birth_date, sex, photo_url, signature_url, profession, job_title,
                    icrp_category, primary_facility_id, primary_service_id,
                    hire_date, status, qr_token, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    worker.id,
                    worker.tenant_id,
                    worker.national_id.normalized,
                    worker.national_id.country,
                    worker.full_name,
                    worker.birth_date.isoformat() if worker.birth_date else None,
                    worker.sex,
                    worker.photo_url,
                    worker.signature_url,
                    worker.profession,
                    worker.job_title,
                    worker.icrp_category.value,
                    worker.primary_facility_id,
                    worker.primary_service_id,
                    worker.hire_date.isoformat() if worker.hire_date else None,
                    worker.status.value,
                    worker.qr_token,
                    datetime.utcnow().isoformat(),
                    datetime.utcnow().isoformat(),
                ),
            )
        else:
            self.conn.execute(
                """UPDATE worker SET
                    full_name=?, profession=?, job_title=?, icrp_category=?,
                    primary_facility_id=?, primary_service_id=?, hire_date=?,
                    status=?, qr_token=?, photo_url=?, signature_url=?,
                    updated_at=?
                    WHERE id=?""",
                (
                    worker.full_name,
                    worker.profession,
                    worker.job_title,
                    worker.icrp_category.value,
                    worker.primary_facility_id,
                    worker.primary_service_id,
                    worker.hire_date.isoformat() if worker.hire_date else None,
                    worker.status.value,
                    worker.qr_token,
                    worker.photo_url,
                    worker.signature_url,
                    datetime.utcnow().isoformat(),
                    worker.id,
                ),
            )

    def list_active(
        self,
        tenant_id: str,
        service_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Worker]:
        sql = "SELECT * FROM worker WHERE tenant_id=? AND status='active'"
        params: list = [tenant_id]
        if service_id:
            sql += " AND primary_service_id=?"
            params.append(service_id)
        sql += " ORDER BY full_name LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = self.conn.execute(sql, params).fetchall()
        return [_worker_from_row(r) for r in rows]

    def count_active(self, tenant_id: str) -> int:
        cur = self.conn.execute(
            "SELECT COUNT(*) FROM worker WHERE tenant_id=? AND status='active'",
            (tenant_id,),
        )
        return cur.fetchone()[0]


class SqliteAuthorizationRepository(AuthorizationRepository):
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def save(self, authorization: Authorization) -> None:
        import json

        existing = self.conn.execute(
            "SELECT id FROM authorization WHERE id=?", (authorization.id,)
        ).fetchone()
        if existing is None:
            self.conn.execute(
                """INSERT INTO authorization (
                    id, tenant_id, worker_id, authorization_type, scope,
                    issued_by, issued_at, expires_at, document_id, number, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    authorization.id,
                    authorization.tenant_id,
                    authorization.worker_id,
                    authorization.authorization_type.value,
                    json.dumps(authorization.scope),
                    authorization.issued_by,
                    authorization.issued_at.isoformat(),
                    authorization.expires_at.isoformat()
                    if authorization.expires_at
                    else None,
                    authorization.document_id,
                    authorization.number,
                    authorization.status.value,
                ),
            )
        else:
            self.conn.execute(
                """UPDATE authorization SET
                    authorization_type=?, scope=?, issued_by=?, issued_at=?,
                    expires_at=?, document_id=?, number=?, status=?
                    WHERE id=?""",
                (
                    authorization.authorization_type.value,
                    json.dumps(authorization.scope),
                    authorization.issued_by,
                    authorization.issued_at.isoformat(),
                    authorization.expires_at.isoformat()
                    if authorization.expires_at
                    else None,
                    authorization.document_id,
                    authorization.number,
                    authorization.status.value,
                    authorization.id,
                ),
            )

    def get(self, tenant_id: str, authorization_id: str) -> Optional[Authorization]:
        cur = self.conn.execute(
            "SELECT * FROM authorization WHERE tenant_id=? AND id=?",
            (tenant_id, authorization_id),
        )
        row = cur.fetchone()
        return _authorization_from_row(row) if row else None

    def list_for_worker(
        self, tenant_id: str, worker_id: str
    ) -> Sequence[Authorization]:
        rows = self.conn.execute(
            "SELECT * FROM authorization WHERE tenant_id=? AND worker_id=? ORDER BY issued_at DESC",
            (tenant_id, worker_id),
        ).fetchall()
        return [_authorization_from_row(r) for r in rows]

    def list_expiring(
        self, tenant_id: str, on_date: date, threshold_days: int
    ) -> Sequence[Authorization]:
        rows = self.conn.execute(
            """SELECT * FROM authorization
               WHERE tenant_id=? AND status='active'
                 AND expires_at IS NOT NULL
                 AND julianday(expires_at) - julianday(?) BETWEEN 0 AND ?
               ORDER BY expires_at ASC""",
            (tenant_id, on_date.isoformat(), threshold_days),
        ).fetchall()
        return [_authorization_from_row(r) for r in rows]


class SqliteUnitOfWork(UnitOfWork):
    """Unit of Work respaldado por una conexión SQLite única.

    En producción se reemplaza por un UoW SQLAlchemy con transacción
    real y aislamiento SERIALIZABLE cuando corresponda.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None

    def __enter__(self) -> "SqliteUnitOfWork":
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.execute("BEGIN")
        self.workers = SqliteWorkerRepository(self.conn)
        self.authorizations = SqliteAuthorizationRepository(self.conn)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.conn is None:
            return
        if exc_type is not None:
            self.conn.rollback()
        self.conn.close()
        self.conn = None

    def commit(self) -> None:
        if self.conn:
            self.conn.commit()

    def rollback(self) -> None:
        if self.conn:
            self.conn.rollback()
