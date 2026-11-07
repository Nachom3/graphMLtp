"""Impossible route error (template)."""
from __future__ import annotations
from .domain_error import DomainError

class ImpossibleRoute(DomainError):
    code = "IMPOSSIBLE_ROUTE"
