# Docker 部署指南

本文档介绍如何使用 Docker 部署 AI 聊天应用。

## 📋 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [使用方法](#使用方法)
- [环境变量配置](#环境变量配置)
- [常见问题](#常见问题)

---

## 🔧 前置要求

在开始之前，请确保您的系统已安装：

- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0 (可选，但推荐)

### 安装 Docker

#### Windows / macOS
下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

---

## 🚀 快速开始

### 方法一：使用 Docker Compose（推荐）

1. **进入项目根目录**
```bash
cd AI
```

2. **启动应用（生产环境）**
```bash
docker-compose -f docker文件/docker-compose.yml up -d
```

3. **访问应用**
打开浏览器访问：http://localhost:8000

### 方法二：使用 Docker 命令

1. **构建镜像**
```bash
docker build -f docker文件/Dockerfile -t ai-chat-app:latest .
```

2. **运行容器**
```bash
docker run -d \
  --name ai-chat-app \
  -p 8000:8000 \
  -v ai-data:/app/data \
  --restart unless-stopped \
  ai-chat-app:latest
```

3. **访问应用**
打开浏览器访问：http://localhost:8000

---

## 📖 使用方法

### 生产环境部署

```bash
# 启动服务
docker-compose -f docker文件/docker-compose.yml up -d

# 查看日志
docker-compose -f docker文件/docker-compose.yml logs -f

# 停止服务
docker-compose -f docker文件/docker-compose.yml down

# 停止并删除数据卷
docker-compose -f docker文件/docker-compose.yml down -v
```

### 开发环境部署（支持热重载）

```bash
# 启动开发环境
docker-compose -f docker文件/docker-compose.dev.yml up -d

# 查看实时日志
docker-compose -f docker文件/docker-compose.dev.yml logs -f ai-app

# 停止开发环境
docker-compose -f docker文件/docker-compose.dev.yml down
```

### 常用命令

```bash
# 重启服务
docker-compose -f docker文件/docker-compose.yml restart

# 查看运行状态
docker-compose -f docker文件/docker-compose.yml ps

# 进入容器终端
docker-compose -f docker文件/docker-compose.yml exec ai-app /bin/bash

# 查看容器资源使用情况
docker stats ai-chat-app

# 更新应用（重新构建并启动）
docker-compose -f docker文件/docker-compose.yml up -d --build
```

---

## ⚙️ 环境变量配置

### 使用 .env 文件

在项目根目录创建 `.env` 文件：

```env
# API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key

# 应用配置
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=false

# 数据库配置（如果使用外部数据库）
DATABASE_URL=sqlite:///./data/app.db
```

### 在 docker-compose.yml 中使用

取消 `docker-compose.yml` 中的注释：

```yaml
services:
  ai-app:
    env_file:
      - ../.env
```

---

## 🐛 常见问题

### 1. 端口被占用

**问题**：`Error: port 8000 already in use`

**解决方案**：
```bash
# 方法1：修改映射端口
# 在 docker-compose.yml 中修改：
ports:
  - "8080:8000"  # 将主机端口改为8080

# 方法2：停止占用端口的进程
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/macOS
lsof -ti:8000 | xargs kill -9
```

### 2. 容器无法启动

**检查日志**：
```bash
docker-compose -f docker文件/docker-compose.yml logs ai-app
```

**常见原因**：
- 依赖安装失败：检查网络连接
- 权限问题：确保 Docker 有足够权限
- 配置错误：检查 .env 文件

### 3. 数据持久化

**备份数据**：
```bash
# 备份数据卷
docker run --rm -v ai-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/ai-data-backup.tar.gz -C /data .

# 恢复数据卷
docker run --rm -v ai-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/ai-data-backup.tar.gz -C /data
```

### 4. 性能优化

**限制资源使用**：
在 `docker-compose.yml` 中添加：

```yaml
services:
  ai-app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
```

### 5. 清理 Docker 资源

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune

# 清理所有未使用的资源
docker system prune -a --volumes
```

---

## 🔒 安全建议

1. **不要在镜像中硬编码敏感信息**
   - 使用 `.env` 文件或 Docker secrets
   - 将 `.env` 添加到 `.gitignore`

2. **使用非 root 用户运行**
   - 在 Dockerfile 中添加：
   ```dockerfile
   RUN useradd -m -u 1000 appuser
   USER appuser
   ```

3. **定期更新基础镜像**
   ```bash
   docker pull python:3.11-slim
   docker-compose build --no-cache
   ```

---

## 📊 监控和日志

### 查看实时日志
```bash
docker-compose -f docker文件/docker-compose.yml logs -f --tail=100
```

### 健康检查
```bash
# 检查容器健康状态
docker ps --filter "name=ai-chat-app"

# 手动触发健康检查
docker exec ai-chat-app curl -f http://localhost:8000/api/health || echo "Unhealthy"
```

---

## 📚 更多资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [FastAPI 部署指南](https://fastapi.tiangolo.com/deployment/)

---

## 🆘 获取帮助

如果遇到问题：

1. 检查日志：`docker-compose logs ai-app`
2. 检查容器状态：`docker ps -a`
3. 查看容器详情：`docker inspect ai-chat-app`
4. 进入容器调试：`docker exec -it ai-chat-app /bin/bash`

---

## 📝 版本历史

- **v1.0.0** (2025-10-31)
  - 初始 Docker 配置
  - 支持生产和开发环境
  - 添加健康检查和数据持久化

