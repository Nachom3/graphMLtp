from collection.adapters.datasets.synthetic_complaints import (
    complaint_count_for_segment,
    draw_container_complaints,
    label_priority,
)


def test_generator_draws_per_container_aggregates_and_returns_zero_for_empty():
    first = complaint_count_for_segment(4, seed=19, segment_id="A")
    assert first == complaint_count_for_segment(4, seed=19, segment_id="A")
    draws = draw_container_complaints(4, seed=19, segment_id="A")
    assert len(draws) == 4 and all(0 <= draw <= 3 for draw in draws)
    assert first == sum(draws)
    assert draw_container_complaints(0, seed=19, segment_id="empty") == ()
    assert complaint_count_for_segment(0, seed=19, segment_id="empty") == 0


def test_complaints_monotonically_increase_priority_at_fixed_other_features():
    priorities = [
        label_priority(days=0, containers=1, zone="residencial", complaints=n)
        for n in range(4)
    ]
    rank = {"baja": 0, "media": 1, "alta": 2}
    assert [rank[value] for value in priorities] == sorted(
        rank[value] for value in priorities
    )
    assert priorities[0] == "media"
    assert priorities[-1] == "alta"
