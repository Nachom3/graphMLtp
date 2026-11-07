"""Invalid dataset error (template)."""
from __future__ import annotations
from .domain_error import DomainError

class InvalidDataset(DomainError):
    code = "INVALID_DATASET"
