"""Generate synthetic complaint counts and construct a synthetic priority.

Each represented container receives a reproducible integer from 0 to 3; the
segment total is their sum. The priority score weights complaints by 2 alongside
days, container count and zone. These are not observed claims or priorities.
"""

COMPLAINT_SEED = 0
COMPLAINT_MIN = 0
COMPLAINT_MAX = 3
COMPLAINT_WEIGHT = 2
ZONE_WEIGHTS = {"residencial": 0, "industrial": 1, "comercial": 2}
SCORE_LOW_MAX = 0
SCORE_MEDIUM_MAX = 2


def draw_container_complaints(
    container_count: int, *, seed: int = COMPLAINT_SEED, segment_id: str = ""
) -> tuple[int, ...]:
    """Draw one integer in [0, 3] for each represented container.

    Container identities are not present in the CSV. The tuple positions are
    anonymous draws for the represented count, not identifiable containers.
    A stable per-segment RNG keeps results reproducible independent of row order.
    """
    if isinstance(container_count, bool) or not isinstance(container_count, int):
        raise ValueError("container_count must be an integer")
    if container_count < 0:
        raise ValueError("container_count must be non-negative")
    import hashlib
    import random

    key = hashlib.sha256(f"{seed}:{segment_id}".encode()).digest()
    rng = random.Random(int.from_bytes(key[:8], "big"))
    return tuple(rng.randint(COMPLAINT_MIN, COMPLAINT_MAX) for _ in range(container_count))


def complaint_count_for_segment(
    container_count: int, *, seed: int = COMPLAINT_SEED, segment_id: str = ""
) -> int:
    """Return the sum of anonymous per-container synthetic draws."""
    return sum(draw_container_complaints(container_count, seed=seed, segment_id=segment_id))


def label_priority(*, days: int, containers: int, zone: str, complaints: int) -> str:
    """Construct the synthetic class from the documented weighted score."""
    if zone not in ZONE_WEIGHTS:
        raise ValueError(f"invalid tipo_zona: {zone!r}")
    score = 2 * days + containers + ZONE_WEIGHTS[zone] + COMPLAINT_WEIGHT * complaints
    if score <= SCORE_LOW_MAX:
        return "baja"
    if score <= SCORE_MEDIUM_MAX:
        return "media"
    return "alta"
