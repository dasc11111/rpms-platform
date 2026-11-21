"""Abstracción de reloj para hacer tests deterministas."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime, timezone


class Clock(ABC):
    @abstractmethod
    def now(self) -> datetime: ...

    @abstractmethod
    def today(self) -> date: ...


class SystemClock(Clock):
    """Reloj real, UTC."""

    def now(self) -> datetime:
        return datetime.now(timezone.utc)

    def today(self) -> date:
        return self.now().date()


class FrozenClock(Clock):
    """Reloj congelado para tests."""

    def __init__(self, moment: datetime):
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        self._moment = moment

    def now(self) -> datetime:
        return self._moment

    def today(self) -> date:
        return self._moment.date()

    def advance(self, *, days: int = 0, hours: int = 0, minutes: int = 0) -> None:
        from datetime import timedelta

        self._moment += timedelta(days=days, hours=hours, minutes=minutes)
