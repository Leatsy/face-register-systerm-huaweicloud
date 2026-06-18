# Backend

## 技术约束

- 本地开发环境：WSL
- 生产部署环境：华为云单台 Linux 服务器
- 数据库：华为云 RDS MySQL
- 文件存储：华为云 OBS
- Python 依赖管理：`uv`
- 服务启动方式：Docker 或 Docker Compose

## 本地启动

1. 复制环境变量模板并按需修改：

```bash
cp .env.example .env
```

2. 安装依赖并创建虚拟环境：

```bash
uv sync
```

3. 启动开发服务器：

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Docker 启动

1. 准备 `.env`：

```bash
cp .env.example .env
```

2. 构建并启动：

```bash
docker compose up -d --build
```

说明：
- 容器内依赖安装使用 `pip install -r requirements.txt`，不依赖 `uv`。
- 默认使用华为云 PyPI 源，并提高超时和重试次数，减少华为云服务器上的构建失败。
- 如需切换镜像源，可在构建前设置 `PIP_INDEX_URL`、`PIP_TRUSTED_HOST` 和 `PIP_EXTRA_ARGS`。

例如改为阿里云镜像：

```bash
export PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
export PIP_TRUSTED_HOST=mirrors.aliyun.com
export PIP_EXTRA_ARGS=--prefer-binary
docker compose up -d --build
```

3. 停止服务：

```bash
docker compose down
```

## 环境变量说明

- 开发阶段默认使用 `sqlite`，方便在 WSL 中快速联调。
- 部署到华为云时，将 `DATABASE_URL` 改为华为云 RDS MySQL 连接串。
- 切换到华为云 OBS 时，将 `STORAGE_BACKEND` 改为 `obs`，并补全 OBS 相关环境变量。
- `ALLOWED_ORIGINS` 使用逗号分隔，填写前端访问域名。
- `PUBLIC_API_BASE_URL` 填后端公网访问地址，例如 `https://api.example.com`。

## 推荐部署方式

- 本地 WSL：直接使用 `uv sync` + `uv run uvicorn ...`
- 华为云服务器：使用 `docker compose up -d --build`
- 当前没有在 Compose 中内置 MySQL，因为生产数据库使用远端华为云 RDS
