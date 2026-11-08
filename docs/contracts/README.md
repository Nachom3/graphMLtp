# API contracts

The backend FastAPI transport is the authoritative HTTP contract and uses
English field names, values, and error codes. See
[`api-v1.md`](api-v1.md) for the v1 routes, request/response examples, planning
semantics, and errors.

| Operation | Endpoint | Notes |
|---|---|---|
| Health/version | `GET /health` | Requires version `v1` |
| Pilot scenario | `GET /scenario` | Bundled fixture; no client filesystem path |
| Prediction | `POST /predictions:predict` | Fitted model only; no training rows |
| Route plan | `POST /routes:plan` | Priorities and optional starting node; ordered segment IDs |

FastAPI serves generated OpenAPI at `/openapi.json` and interactive docs at
`/docs`. The frontend should derive DTOs and error handling from that live
contract. Display copy may remain Spanish, but transport fields and values are
English (`segment_id`, `low`/`medium`/`high`, `IMPOSSIBLE_ROUTE`, etc.).

Model comparison is an offline operation, not a visualization endpoint. HTTP
requests do not train models. For route planning, zero-container segments may
connect mandatory destinations as transit, but are never destinations
 themselves; a disconnected complete graph returns `IMPOSSIBLE_ROUTE`.
