from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Cloud Face Attendance API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api"

    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    jwt_secret_key: str = "change-me-in-production"
    jwt_expire_minutes: int = 1440

    database_url: str = "sqlite:///./cloud_proj.db"

    storage_backend: str = "local"
    local_upload_dir: str = "./uploads"
    public_api_base_url: str = "http://127.0.0.1:8000"

    obs_bucket: str = ""
    obs_server: str = ""
    obs_access_key_id: str = ""
    obs_secret_access_key: str = ""
    obs_cdn_base_url: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    @property
    def local_upload_path(self) -> Path:
        return Path(self.local_upload_dir)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
