"""Small pure functions: payment rhythm, yield consistency and version comparison."""
from datetime import date

from dividendcase.services.derived import payment_frequency, yield_consistency
from dividendcase.services.updates import is_newer, newest_release


def test_payment_frequency_from_gaps():
    assert payment_frequency([date(2025, m, 15) for m in range(1, 13)]) == "monthly"
    assert payment_frequency([date(2025, 1, 1), date(2025, 4, 1), date(2025, 7, 1)]) == "quarterly"
    assert payment_frequency([date(2024, 1, 1), date(2024, 7, 1), date(2025, 1, 1)]) == "semi-annual"
    assert payment_frequency([date(2023, 5, 1), date(2024, 5, 1)]) == "annual"
    assert payment_frequency([date(2025, 1, 1)]) is None
    # Order doesn't matter
    assert payment_frequency([date(2025, 7, 1), date(2025, 1, 1), date(2025, 4, 1)]) == "quarterly"


def test_yield_consistency():
    assert yield_consistency([2.0, 2.0, 2.0]) == 100.0
    assert yield_consistency([1.0, 3.0]) < 60
    assert yield_consistency([None, 2.0]) is None
    assert yield_consistency([]) is None
    assert 0.0 <= yield_consistency([0.1, 5.0, 0.2, 9.0]) <= 100.0


def test_newest_release_skips_prereleases_for_stable_builds():
    versions = ["0.1.0", "0.2.0", "0.3.0a1", "not-a-version"]
    assert newest_release(versions, current="0.1.0") == "0.2.0"
    assert newest_release(versions, current="0.2.0rc1") == "0.3.0a1"
    assert newest_release([], current="0.1.0") is None


def test_is_newer():
    assert is_newer("0.2.0", "0.1.0")
    assert not is_newer("0.1.0", "0.1.0")
    assert not is_newer("0.1.0", "0.2.0.dev0")
    assert is_newer("0.2.0", "0.2.0.dev0")
    assert not is_newer(None, "0.1.0")
    assert not is_newer("garbage", "0.1.0")
