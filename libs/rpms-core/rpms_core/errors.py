"""Excepciones de dominio compartidas.

Todas heredan de RPMSError. Los adaptadores HTTP mapean cada tipo a
un status code y un cuerpo RFC 7807 (Problem Details).
"""

from __future__ import annotations


class RPMSError(Exception):
    """Base para todos los errores de dominio y aplicación."""

    status_code: int = 500
    error_code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_problem(self) -> dict:
        """Serialización RFC 7807."""
        return {
            "type": f"about:blank#{self.error_code}",
            "title": self.__class__.__name__,
            "status": self.status_code,
            "detail": self.message,
            "code": self.error_code,
            **({"errors": self.details} if self.details else {}),
        }


class NotFoundError(RPMSError):
    status_code = 404
    error_code = "not_found"


class ValidationError(RPMSError):
    status_code = 422
    error_code = "validation_error"


class ConflictError(RPMSError):
    status_code = 409
    error_code = "conflict"


class UnauthorizedError(RPMSError):
    status_code = 401
    error_code = "unauthorized"


class ForbiddenError(RPMSError):
    status_code = 403
    error_code = "forbidden"


class RegulatoryError(RPMSError):
    """Violación de una regla regulatoria."""

    status_code = 409
    error_code = "regulatory_violation"

    def __init__(self, message: str, *, rule_id: str, details: dict | None = None):
        super().__init__(message, details=details)
        self.rule_id = rule_id
        self.details["rule_id"] = rule_id
