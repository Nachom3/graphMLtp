"""HTTP transport (template)."""
from __future__ import annotations
from typing import Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field

VERSION = "v1"

class SegmentIn(BaseModel):
    segment_id: str
    origin_node: str
    destination_node: str
    length_m: float = Field(gt=0)
    zone_type: Literal["residential", "commercial", "industrial"]
    container_count: int = Field(ge=0)
    days_since_last_collection: int = Field(ge=0)
    historic_neighbor_complaints: int = Field(ge=0)

class NodeIn(BaseModel):
    node_id: str
    lon: float
    lat: float

def create_app() -> FastAPI:
    """Template. TODO: implement routes."""
    app = FastAPI(title="Waste collection (graphs + ML)", version=VERSION)
    @app.get("/health")
    def health() -> dict:
        raise NotImplementedError
    return app

app = create_app()
