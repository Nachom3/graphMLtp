"""Partitioning policy: split sizes for reproducible 60/20/20.

Single source of truth for split ratios so adapters and metadata agree.
Pure Python: no pandas, no sklearn here (SRP + DIP: policy lives apart
from the sklearn mechanics in ``stratified_split``).
"""

TRAIN_RATIO = 0.6
TEST_FRACTION_OF_ALL = 0.4
VALIDATION_FRACTION_OF_REMAINDER = 0.5
SPLIT_NAMES = ("train", "validation", "test")


def compute_split_sizes(n: int) -> tuple[int, int, int]:
    """Return (train, validation, test) sizes preserving sklearn rounding."""
    if n < 0:
        raise ValueError("n must be non-negative")
    train_size = int(n * TRAIN_RATIO)
    validation_size = int((n - train_size) * VALIDATION_FRACTION_OF_REMAINDER)
    test_size = n - train_size - validation_size
    return (train_size, validation_size, test_size)
