# 使用Python 3.11官方镜像作为基础镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件和pip配置
COPY requirements.txt .
COPY docker文件/pip.conf /etc/pip.conf

# 安装Python依赖（使用国内镜像源加速，避免被Cloudflare阻止）
RUN pip install --no-cache-dir -r requirements.txt 2>&1 | tee /tmp/pip-install.log || \
    (echo "使用备用镜像源重试..." && \
     pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt) || \
    (echo "使用官方源重试..." && \
     pip install --no-cache-dir -i https://pypi.org/simple -r requirements.txt)

# 复制应用代码
COPY . .

# 创建数据目录（用于存储数据库等）
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8000

# 健康检查（使用curl而不是Python requests，避免依赖问题）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

