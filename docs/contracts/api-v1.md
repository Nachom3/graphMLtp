# API v1 contract

The FastAPI transport is the source of truth for the HTTP contract. It uses
English identifiers and values, matching the backend domain and DTOs. The
frontend visualizes backend results; requests never provide training rows and
visualization endpoints never train models.

## Versions and identifiers

- API version: `v1`; dataset schema: `v1`.
- `segment_id` and `node_id` are stable domain identifiers. Fixture IDs such as
  `T0001` and `N0001` are examples only.
- Priorities: `low`, `medium`, `high`.
- Zone types: `residential`, `commercial`, `industrial`.
- Node coordinates are WGS84 `lon`/`lat`; `length_m` and route costs are metres.

## Endpoints

### `GET /health`

Returns `{"status":"ok","version":"v1","schema":"v1"}`.

### `GET /scenario`

Returns the generated full-city dataset by default (`dataset/salida-montevideo/`).
With no query params it returns every segment (up to the configured default limit).
To load only a part, pass an optional WGS84 bbox and/or `limit`
(same validation as `GET /containers`):

```http
GET /scenario?sur=-34.92&norte=-34.90&oeste=-56.17&este=-56.14&limit=2000
```

A segment is included when its line intersects the bbox (crossings count,
endpoints are the fallback without geometry); `nodes` are trimmed to the
referenced ones. The response adds `total` (bbox matches before `limit`),
the effective `limit` and `truncated`. Without params the dataset is whole.
Each geometry is the clipped/split IDE street line, in WGS84 `[longitude, latitude]`
and oriented from `origin_node` to `destination_node`:

```json
{
  "scenario_id": "montevideo",
  "version": "v1",
  "total": 1,
  "limit": null,
  "truncated": false,
  "nodes": [{"node_id": "N0001", "lon": -56.155, "lat": -34.91}],
  "segments": [{
    "segment_id": "T0001", "origin_node": "N0001",
    "destination_node": "N0002", "length_m": 85.5,
    "zone_type": "residential", "container_count": 1,
    "days_since_last_collection": 2, "historic_neighbor_complaints": 0,
    "geometry": {"type":"LineString", "coordinates":[[-56.155,-34.91],[-56.1545,-34.9102],[-56.154,-34.91]]}
  }]
}
```

The server administrator may set `COLLECTION_SCENARIO_SOURCE` to an alternate
compatible dataset directory (centralized in `backend/src/collection/config.py`
along with `COLLECTION_SCENARIO_DEFAULT_LIMIT` and `COLLECTION_SCENARIO_MAX_LIMIT`).
Missing or inconsistent geometry returns
`SCENARIO_UNAVAILABLE`; there is no silent fallback to the test fixture.
Explicitly injected legacy fixtures can omit geometry (`null`). The client cannot
select an arbitrary filesystem path.

### `POST /predictions:predict`

Request:

```json
{
  "model_id": "arbol",
  "segments": [{
    "segment_id": "T0001", "origin_node": "N0001",
    "destination_node": "N0002", "length_m": 85.5,
    "zone_type": "residential", "container_count": 1,
    "days_since_last_collection": 2, "historic_neighbor_complaints": 0
  }]
}
```

Response (one result per input segment, in input order):

```json
{"model_id":"arbol","predictions":[{"segment_id":"T0001","priority":"low"}]}
```

The endpoint consumes the already-fitted `arbol` model. It does not accept
`training_rows` or train a model. Other model identifiers are unsupported.

### `POST /predictions:explain`

Explains one prediction: the synthetic #18 score breakdown plus the fitted
decision-tree path traversed for that segment. Only the `arbol` model is
explainable; other estimators return `EXPLAIN_UNSUPPORTED`.

Request: `{"model_id":"arbol","segment":{...}}` (same segment shape as
`predict`, single object).

Response:

```json
{"segment_id":"T0001","priority":"high",
 "score":{"days_weighted":0,"containers_weighted":3,"zone_w":0,"complaints_weighted":0,"total":3},
 "path":[{"node":0,"feature":"remainder__cantidad_contenedores","threshold":1.5,"value":3.0,"direction":"derecha (>)"},{"node":2,"leaf":true}]}
```

### `GET /containers?sur=&norte=&oeste=&este=&limit=`

Returns levante container coordinates inside the requested WGS84 bbox, capped
at `limit` (default 2000). Invalid bbox or negative limit is `INVALID_REQUEST`.

Response: `{"points":[{"lon":-56.16,"lat":-34.91,"days":2}],"total":1,"truncated":false}`.

### `POST /routes:plan`

Request:

```json
{
  "nodes": [{"node_id":"N0001","lon":-56.155,"lat":-34.91}],
  "segments": [{
    "segment_id":"T0001", "origin_node":"N0001",
    "destination_node":"N0002", "length_m":85.5,
    "zone_type":"residential", "container_count":1,
    "days_since_last_collection":2, "historic_neighbor_complaints":0
  }],
  "priorities": {"T0001":"high"},
  "include": ["medium", "high"],
  "start_node_id": "N0001"
}
```

`include` defaults to `medium` and `high`; `start_node_id` is optional.
`priorities` maps segment IDs to predicted priorities. Segments with containers
that meet the selected priorities are mandatory destinations. Segments with
zero containers can be used as transit edges, but are never destinations.

Response:

```json
{
  "order": ["T0001"], "repetitions": [], "total_cost_m": 85.5,
  "unit": "meters", "mandatory": ["T0001"], "transit": [],
  "repeated_distance_m": 0.0, "coverage": 1.0
}
```

`order` is an ordered list of segment IDs; repeated IDs represent repeated
traversal. `repetitions` lists IDs visited more than once. Costs include every
traversal. `mandatory`, `transit`, repeated distance, and coverage support the
route-planning UI. Disconnected components in the complete graph are an error;
components connected by zero-container transit segments can be planned.

## Errors

Error bodies use `{"detail":{"code":"...","detail":"..."}}`.

| HTTP | Code | Meaning |
|---|---|---|
| 422 | `INVALID_REQUEST` | Request DTO shape or field validation failed |
| 422 | `INVALID_DATASET` | Invalid scenario, segment data, or domain invariants |
| 422 | `IMPOSSIBLE_ROUTE` | Empty destination selection or disconnected complete graph |
| 422 | `PREDICTION_WITHOUT_SEGMENT` | Predictor output cannot be matched 1:1 to input |
| 422 | `MODEL_UNKNOWN` | Unsupported model identifier |
| 422 | `EXPLAIN_UNSUPPORTED` | Predictor cannot explain (only the decision tree is explainable) |
| 503 | `MODEL_UNAVAILABLE` | Fitted model artifact is unavailable |
| 503 | `SCENARIO_UNAVAILABLE` | Scenario data or its geometries are missing or inconsistent |

## OpenAPI

FastAPI generates the OpenAPI document at `/openapi.json` and interactive docs
at `/docs`. The generated paths and Pydantic request schemas are the executable
HTTP reference; this document describes their behavior and response contract.
