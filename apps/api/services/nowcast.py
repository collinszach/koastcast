"""
Nowcast blending utilities.

Pure functions (no I/O) placed here so they can be imported and tested
independently from the full forecast router.
"""
from __future__ import annotations

from models.schemas import BuoyObservation

# Spectral frequency bins in the exact order used by LightGBM bias correction models.
# Must match ml/train_bias_correction.py SPEC_FREQS list.
SPEC_FREQS_ORDERED = [
    "0.0330", "0.0380", "0.0430", "0.0480", "0.0530", "0.0580",
    "0.0630", "0.0680", "0.0730", "0.0780", "0.0830", "0.0880",
]


def nowcast_blend(
    model_val: float | None,
    buoy_val: float | None,
    lead_hours: float,
) -> tuple[float | None, bool]:
    """
    Blend a live buoy reading into an NWP model forecast for short lead times.

    Uses linear interpolation:
        weight = max(0, 1 - lead_hours / 6)
        result = weight * buoy_val + (1 - weight) * model_val

    At lead=0: pure buoy. At lead=6: pure model. Linearly blended between.
    Returns (blended_value, is_nowcast_influenced).
    """
    if buoy_val is None or model_val is None or lead_hours >= 6.0:
        return model_val, False
    weight = min(1.0, max(0.0, 1.0 - lead_hours / 6.0))
    blended = weight * buoy_val + (1.0 - weight) * model_val
    return round(blended, 3), True


def extract_spectral_bands(buoy_obs: BuoyObservation | None) -> list[float]:
    """
    Extract ordered spectral energy band values from a BuoyObservation.

    Returns a list of 12 floats in canonical frequency order for SpotBiasCorrector.
    Missing frequencies default to 0.0. Returns [] if no spectral data.
    """
    if buoy_obs is None or not buoy_obs.spectral_energy:
        return []
    return [
        float(buoy_obs.spectral_energy.get(freq, 0.0))
        for freq in SPEC_FREQS_ORDERED
    ]
