"""Base structure test: English templates import with abstract contracts (no behavior)."""
import sys
from abc import ABC
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


def test_collection_templates_import_with_abstract_contracts():
    import collection
    from collection.adapters.datasets.csv_dataset_reader import CsvDatasetReader
    from collection.adapters.graphs.networkx_route_planner import NetworkxRoutePlanner
    from collection.application.use_cases.compare_models.contract import (
        CompareModelsContract,
    )
    from collection.application.use_cases.plan_route.contract import PlanRouteContract
    from collection.application.use_cases.predict_priorities.contract import (
        PredictPrioritiesContract,
    )
    from collection.application.use_cases.validate_load_dataset.contract import (
        ValidateLoadDatasetContract,
    )

    assert collection.SCHEMA_VERSION == "v1"
    for contract in (
        ValidateLoadDatasetContract,
        CompareModelsContract,
        PredictPrioritiesContract,
        PlanRouteContract,
    ):
        assert issubclass(contract, ABC)
        assert "execute" in contract.__abstractmethods__

    assert CsvDatasetReader is not None
    assert NetworkxRoutePlanner is not None
