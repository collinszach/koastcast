"""
Spot Bias Correction Service

Translates offshore buoy readings to local face height estimates.
Phase 1: Physics-based fallback.
Phase 2: Per-spot LightGBM models trained on historical data.
"""
from __future__ import annotations

import math
import pickle
from pathlib import Path

import numpy as np
import structlog

logger = structlog.get_logger(__name__)

MODELS_DIR = Path(__file__).parent.parent / "models" / "ml"


# ---------------------------------------------------------------------------
# Wave physics helpers (used by the physics fallback path)
# ---------------------------------------------------------------------------

def shoaling_coefficient(period_s: float, depth_m: float = 15.0) -> float:
    """Linear wave theory shoaling coefficient Ks = sqrt(Cg_deep / Cg_shallow).

    Args:
        period_s: Peak wave period (s).
        depth_m: Representative nearshore depth in metres (default 15 m).

    Returns:
        Dimensionless shoaling coefficient (>= 1 for typical surf depths).
    """
    g = 9.81
    omega = 2 * math.pi / period_s
    # Deep-water group velocity
    Cg_deep = g * period_s / (4 * math.pi)
    # Iterative dispersion: omega^2 = g * k * tanh(k * d)
    k = omega ** 2 / g  # deep-water initial guess
    for _ in range(20):
        k = omega ** 2 / (g * math.tanh(k * depth_m))
    C = omega / k
    n = 0.5 * (1 + 2 * k * depth_m / math.sinh(2 * k * depth_m))
    Cg_shallow = n * C
    return math.sqrt(Cg_deep / Cg_shallow)


def refraction_coefficient(angle_diff_deg: float, period_s: float, depth_m: float = 15.0) -> float:
    """Snell's law refraction coefficient Kr.

    Args:
        angle_diff_deg: Angle between swell direction and spot's optimal direction (0 = direct).
        period_s: Peak wave period (s).
        depth_m: Representative nearshore depth in metres (default 15 m).

    Returns:
        Dimensionless refraction coefficient Kr (<= 1 for oblique swell).
    """
    g = 9.81
    omega = 2 * math.pi / period_s
    # Deep-water wave number
    k_deep = omega ** 2 / g
    # Shallow wave number via iterative dispersion
    k_shallow = omega ** 2 / g
    for _ in range(20):
        k_shallow = omega ** 2 / (g * math.tanh(k_shallow * depth_m))
    # Snell's law: sin(theta_shallow) / k_shallow = sin(theta_deep) / k_deep
    theta_deep = math.radians(min(abs(angle_diff_deg), 89.9))
    sin_shallow = math.sin(theta_deep) * k_shallow / k_deep
    sin_shallow = min(sin_shallow, 1.0)  # clamp for total internal reflection
    theta_shallow = math.asin(sin_shallow)
    Kr = math.sqrt(math.cos(theta_deep) / math.cos(theta_shallow))
    return Kr


def miche_breaking_limit(period_s: float, depth_m: float = 3.0) -> float:
    """Miche breaking criterion: H_max = 0.142 * L * tanh(2*pi*d/L).

    Args:
        period_s: Peak wave period (s).
        depth_m: Breaking-zone depth in metres (default 3 m for typical beach/reef).

    Returns:
        Maximum significant wave height (m) before breaking.
    """
    g = 9.81
    omega = 2 * math.pi / period_s
    k = omega ** 2 / g
    for _ in range(20):
        k = omega ** 2 / (g * math.tanh(k * depth_m))
    L = 2 * math.pi / k
    H_max = 0.142 * L * math.tanh(2 * math.pi * depth_m / L)
    return H_max


class SpotBiasCorrector:
    """
    Per-spot bias corrector.

    Uses a trained LightGBM model when available;
    falls back to a physics-based formula when not.
    """

    def __init__(self, spot_id: str) -> None:
        self.spot_id = spot_id
        self.model = None
        self.feature_names: list[str] = []
        model_path = MODELS_DIR / f"bias_{spot_id}.pkl"
        if model_path.exists():
            try:
                with open(model_path, "rb") as f:
                    saved = pickle.load(f)
                # Support both raw model (Phase 1 format) and dict (Phase 2 format)
                if isinstance(saved, dict):
                    self.model = saved["model"]
                    self.feature_names = saved.get("feature_names", [])
                else:
                    self.model = saved
                logger.debug("Loaded bias model", spot_id=spot_id, features=len(self.feature_names))
            except Exception as exc:
                logger.warning("Failed to load bias model", spot_id=spot_id, error=str(exc))

    def predict(
        self,
        buoy_hs: float,
        buoy_tp: float,
        buoy_dir: float,
        swell_angle_diff: float,
        wind_speed: float = 0.0,
        wind_dir: float = 0.0,
        tide_height: float = 0.0,
        spectral_bands: list[float] | None = None,
        doy: int = 180,
    ) -> tuple[float, float]:
        """
        Predict local face height and confidence.

        Args:
            buoy_hs: Significant wave height at buoy (m)
            buoy_tp: Peak period (s)
            buoy_dir: Mean wave direction at buoy (degrees)
            swell_angle_diff: |buoy_dir - spot_optimal_dir| (degrees)
            wind_speed: Wind speed (m/s)
            wind_dir: Wind direction (degrees)
            tide_height: Tide height (m)
            spectral_bands: First N spectral energy values (m²/Hz)
            doy: Day of year (1-366)

        Returns:
            (face_height_m, confidence)
        """
        if spectral_bands is None:
            spectral_bands = []

        if self.model is not None:
            return self._predict_ml(
                buoy_hs, buoy_tp, buoy_dir, swell_angle_diff,
                wind_speed, wind_dir, tide_height, spectral_bands, doy,
            )
        return self._predict_physics(buoy_hs, buoy_tp, swell_angle_diff)

    def _predict_physics(
        self,
        buoy_hs: float,
        buoy_tp: float,
        swell_angle_diff: float,
    ) -> tuple[float, float]:
        """
        Physics-based fallback using linear wave theory.

        Applies shoaling (Ks) and Snell's-law refraction (Kr) to the offshore
        buoy significant wave height, caps the result with the Miche breaking
        criterion, then converts to face height using wave steepness.

        Args:
            buoy_hs: Significant wave height at the offshore buoy (m).
            buoy_tp: Peak period (s).
            swell_angle_diff: Minimum arc angle between swell direction and
                spot's optimal direction (degrees, 0-180).
        """
        # Ensure angle_diff is the minimum arc (0-180°)
        angle_diff = min(abs(swell_angle_diff), 360.0 - abs(swell_angle_diff))
        angle_diff = min(angle_diff, 180.0)

        # Guard against degenerate inputs
        period_s = max(buoy_tp, 1.0)
        hs = max(buoy_hs, 0.0)

        # --- Shoaling (15 m representative nearshore depth) ---
        Ks = shoaling_coefficient(period_s, depth_m=15.0)

        # --- Snell's-law refraction (15 m) ---
        Kr = refraction_coefficient(angle_diff, period_s, depth_m=15.0)

        # Nearshore significant wave height
        H_nearshore = hs * Ks * Kr

        # --- Miche breaking cap (3 m breaking-zone depth) ---
        H_break_limit = miche_breaking_limit(period_s, depth_m=3.0)
        H_nearshore = min(H_nearshore, H_break_limit)

        # --- Face height: steeper waves have a higher face-to-Hs ratio ---
        g = 9.81
        L_deep = g * period_s ** 2 / (2 * math.pi)  # deep-water wavelength
        steepness = hs / L_deep if L_deep > 0 else 0.0  # Hs / L_deep
        face_factor = 1.1 + 0.5 * min(steepness / 0.04, 1.0)  # 1.1 to 1.6
        face_height = max(0.0, H_nearshore * face_factor)

        # --- Confidence: degrades with oblique angle (max 45% for physics) ---
        angle_penalty = max(0.0, 1.0 - angle_diff / 90.0)
        confidence = 0.45 * angle_penalty

        return round(face_height, 2), round(confidence, 2)

    def _predict_ml(
        self,
        buoy_hs: float,
        buoy_tp: float,
        buoy_dir: float,
        swell_angle_diff: float,
        wind_speed: float,
        wind_dir: float,
        tide_height: float,
        spectral_bands: list[float],
        doy: int,
    ) -> tuple[float, float]:
        """Use trained LightGBM model for prediction."""
        import pandas as pd

        # Build feature dict matching training feature names
        bands = (spectral_bands + [0.0] * 12)[:12]
        SPEC_FREQS = [
            "0.0330", "0.0380", "0.0430", "0.0480", "0.0530", "0.0580",
            "0.0630", "0.0680", "0.0730", "0.0780", "0.0830", "0.0880",
        ]
        feat_dict: dict = {
            "wvht": buoy_hs,
            "dpd": buoy_tp,
            "apd": buoy_tp * 0.85,
            "mwd": buoy_dir,
            "swell_angle_diff": swell_angle_diff,
            "wspd": wind_speed,
            "wdir": wind_dir,
            "doy": doy,
            "hour": 12,  # default midday
        }
        for freq_key, val in zip(SPEC_FREQS, bands):
            feat_dict[f"spec_{freq_key}"] = val

        # If we have explicit feature names, use them to ensure correct column order
        if self.feature_names:
            row = {k: feat_dict.get(k, 0.0) for k in self.feature_names}
            features = pd.DataFrame([row])
        else:
            features = np.array([
                buoy_hs, buoy_tp, buoy_tp * 0.85, buoy_dir, swell_angle_diff,
                wind_speed, wind_dir, doy, 12, *bands,
            ]).reshape(1, -1)

        try:
            pred = self.model.predict(features)[0]
            physics_est = buoy_hs * 0.85
            deviation = abs(pred - physics_est) / max(physics_est, 0.1)
            confidence = max(0.3, min(0.95, 1.0 - deviation * 0.5))
            return round(float(pred), 2), round(confidence, 2)
        except Exception as exc:
            logger.warning("ML prediction failed, falling back to physics", error=str(exc))
            return self._predict_physics(buoy_hs, buoy_tp, swell_angle_diff)


def compute_angle_diff(buoy_dir: float, optimal_dir: float) -> float:
    """Compute the smallest angular difference between two directions (0-180°)."""
    diff = abs(buoy_dir - optimal_dir) % 360.0
    return min(diff, 360.0 - diff)
