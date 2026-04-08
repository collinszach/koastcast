"""
SwellStack API Configuration
Reads from environment variables injected by Bitwarden Secrets Manager (bws).
"""
import json
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # No .env file — all config is injected by Bitwarden Secrets Manager.
        # Run with: bws run -- uvicorn main:app --reload
        case_sensitive=False,
        extra="ignore",
    )

    # App
    environment: str = "development"
    debug: bool = True
    secret_key: str = "dev-secret-change-in-production"
    # Stored as a plain string internally; the validator converts to list.
    # Accepts both JSON array ("[\"a\",\"b\"]") and comma-separated ("a,b").
    cors_origins: str = "http://localhost:3000"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""  # JWT signing secret — from Supabase dashboard → Project Settings → API → JWT Secret

    # Open-Meteo
    open_meteo_base_url: str = "https://marine-api.open-meteo.com"
    open_meteo_forecast_base_url: str = "https://api.open-meteo.com"

    # LLM
    llama_cpp_base_url: str = "http://localhost:8081/v1"
    model_path: str = "/models/phi-4-mini-q4_k_m.gguf"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        """Return cors_origins parsed as a list (comma-separated or JSON array)."""
        raw = self.cors_origins.strip()
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
