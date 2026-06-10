"""Tests for the Trust Score service and nearest-tide-station selection."""
from __future__ import annotations

from services.tide_stations import nearest_tide_station
from services.trust import compute_trust, summarize_trust


class TestComputeTrust:
    def test_fresh_agreeing_nowcast_scores_high(self):
        t = compute_trust(
            lead_hours=0,
            model_agreement=0.95,
            confidence=0.85,
            buoy_age_hours=1.0,
            is_nowcast=True,
            ensemble=True,
        )
        assert t.score >= 85
        assert t.label == "High"

    def test_trust_decays_with_lead_time(self):
        near = compute_trust(lead_hours=0, model_agreement=0.8, confidence=0.7, ensemble=True)
        far = compute_trust(lead_hours=240, model_agreement=0.8, confidence=0.7, ensemble=True)
        assert far.score < near.score

    def test_disagreement_lowers_trust_and_is_limiting(self):
        t = compute_trust(
            lead_hours=24,
            model_agreement=0.2,
            confidence=0.9,
            buoy_age_hours=1.0,
            is_nowcast=True,
            ensemble=True,
        )
        assert t.limiting_factor == "agreement"
        assert t.score < 80

    def test_single_model_uses_neutral_agreement(self):
        # Non-ensemble: agreement can't be measured, so it's a neutral constant.
        t = compute_trust(lead_hours=0, confidence=0.8, ensemble=False)
        assert "agreement" in t.factors
        assert t.factors["agreement"] == 0.60

    def test_missing_buoy_omits_freshness(self):
        t = compute_trust(lead_hours=0, model_agreement=0.8, confidence=0.8, buoy_age_hours=None, ensemble=True)
        assert "freshness" not in t.factors

    def test_stale_buoy_reduces_freshness(self):
        fresh = compute_trust(lead_hours=12, model_agreement=0.8, confidence=0.8, buoy_age_hours=1.0, ensemble=True)
        stale = compute_trust(lead_hours=12, model_agreement=0.8, confidence=0.8, buoy_age_hours=11.0, ensemble=True)
        assert stale.factors["freshness"] < fresh.factors["freshness"]

    def test_score_bounded(self):
        for lead in (0, 50, 200, 400):
            t = compute_trust(lead_hours=lead, model_agreement=0.5, confidence=0.5, ensemble=True)
            assert 0 <= t.score <= 100


class TestSummarizeTrust:
    def test_summary_means_and_picks_dominant_limiter(self):
        s = summarize_trust([90.0, 80.0, 70.0, None], ["lead", "agreement", "agreement", "agreement"])
        assert s["score"] == 80.0
        assert s["limiting_factor"] == "agreement"
        assert s["label"] == "High"

    def test_summary_handles_empty(self):
        s = summarize_trust([None, None], ["x", "y"])
        assert s["score"] is None
        assert s["label"] == "unknown"


class TestNearestTideStation:
    def test_east_coast_resolves_east_not_west(self):
        # Kennebunk, ME — must NOT pick a Pacific station (the old bug).
        sid, dist = nearest_tide_station(43.3, -70.5)
        assert sid == "8418150"  # Portland, ME
        assert dist < 100

    def test_montauk_self(self):
        sid, _ = nearest_tide_station(41.05, -71.96)
        assert sid == "8510560"

    def test_norcal(self):
        sid, _ = nearest_tide_station(37.6, -122.5)
        assert sid == "9414290"  # San Francisco

    def test_hawaii_resolves_to_hawaii(self):
        sid, _ = nearest_tide_station(21.28, -157.84)  # Oahu south shore
        assert sid.startswith("16")  # Hawaii region prefix
