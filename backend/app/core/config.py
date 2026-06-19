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

    face_model_name: str = "buffalo_l"
    face_model_root: str = "./.insightface"
    face_match_threshold: float = 0.48
    face_detect_threshold: float = 0.55
    face_detection_size: int = 640
    face_execution_providers: str = "CPUExecutionProvider"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    @property
    def local_upload_path(self) -> Path:
        return Path(self.local_upload_dir)

    @property
    def face_model_root_path(self) -> Path:
        return Path(self.face_model_root)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def face_provider_list(self) -> list[str]:
        return [provider.strip() for provider in self.face_execution_providers.split(",") if provider.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
