"""Prediction without segment error (template)."""
from __future__ import annotations
from .domain_error import DomainError

class PredictionWithoutSegment(DomainError):
    code = "PREDICTION_WITHOUT_SEGMENT"
