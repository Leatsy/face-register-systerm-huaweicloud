from datetime import datetime
from pathlib import Path
from urllib.request import urlopen
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings

settings = get_settings()


def save_upload_file(upload_file: UploadFile, folder: str) -> str:
    extension = Path(upload_file.filename or "upload.jpg").suffix or ".jpg"
    date_prefix = datetime.now().strftime("%Y/%m/%d")
    object_name = f"{folder}/{date_prefix}/{uuid4().hex}{extension}"
    content = upload_file.file.read()
    upload_file.file.seek(0)

    if settings.storage_backend == "obs":
        return _save_to_obs(content=content, object_name=object_name, content_type=upload_file.content_type)
    return _save_to_local(content=content, object_name=object_name)


def _save_to_local(content: bytes, object_name: str) -> str:
    target_path = settings.local_upload_path / object_name
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)
    return f"/uploads/{object_name}"


def _save_to_obs(content: bytes, object_name: str, content_type: str | None) -> str:
    try:
        from obs import ObsClient, PutObjectHeader
    except ImportError as exc:
        raise RuntimeError("未安装 OBS SDK，请先执行 uv sync") from exc

    if not settings.obs_bucket or not settings.obs_server:
        raise RuntimeError("OBS 环境变量不完整，请检查 .env 配置")

    client = ObsClient(
        access_key_id=settings.obs_access_key_id,
        secret_access_key=settings.obs_secret_access_key,
        server=settings.obs_server,
    )
    headers = PutObjectHeader(contentType=content_type or "application/octet-stream")
    result = client.putContent(settings.obs_bucket, object_name, content, headers=headers)
    if result.status >= 300:
        raise RuntimeError(f"OBS 上传失败，status={result.status}")

    if settings.obs_cdn_base_url:
        return f"{settings.obs_cdn_base_url.rstrip('/')}/{object_name}"
    return f"https://{settings.obs_bucket}.{settings.obs_server}/{object_name}"


def load_file_bytes(file_url: str) -> bytes:
    if file_url.startswith("/uploads/"):
        relative_path = file_url.removeprefix("/uploads/")
        return (settings.local_upload_path / relative_path).read_bytes()

    if file_url.startswith("http://") or file_url.startswith("https://"):
        with urlopen(file_url) as response:
            return response.read()

    raise RuntimeError(f"暂不支持读取该存储路径: {file_url}")
