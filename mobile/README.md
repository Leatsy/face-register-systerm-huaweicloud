# Mobile

## 说明

- 当前使用 React + TypeScript + Vite 构建移动端 H5 联调页面。
- 目标是完成任务 2 所需的注册、登录、注销、标准照片上传、拍照上传等演示流程。
- 本地开发运行在 WSL 中，前端通过 `VITE_API_BASE_URL` 访问后端接口。

## 启动

```bash
cp .env.example .env
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## 环境变量

- `VITE_API_BASE_URL`：后端 API 根地址，本地默认 `http://127.0.0.1:8000/api`

## 当前功能

- 注册
- 登录
- 注销
- 查看个人信息
- 标准照片上传
- 拍照签到上传
