# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- **Build**: `python main.py` (launches FastAPI service)
- **Health Check**: `curl http://localhost:8000/health`
- **Dependency Management**: `pip install -r requirements.txt`

## Architecture Overview
The codebase follows a clean layered architecture:

```
├── main.py                 # FastAPI entrypoint
├── core/                   # Core infrastructure
│   ├── config.py           # Centralized configuration
│   ├── logging.py          # Unified logging system
│   ├── exceptions.py       # Structured exception hierarchy
│   ├── database.py         # SQLite operations
│   ├── models.py           # AI model abstractions
│   └── orchestrator.py     # Evaluation orchestration
├── api/router.py           # API endpoint routing
└── static/                 # Frontend resources
```

Key architectural principles:
- Strict single responsibility per module
- Dependency injection pattern for testability
- Centralized configuration, logging, and exception systems
- SQLite database for simplicity (providers.db)

## Configuration

## Next Steps

Based on your requests, here are the planned enhancements:

1.  **MCP 协议支持** - 实现 Model Context Protocol
2.  **图片生成优化** - 优化图片生成模型的提示词
3.  **代理支持** - 实现 SOCKS/HTTP 代理
4.  **高级提示词管理** - 建立更强大的提示词系统


Environment variables (from README.md):
```
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DB_PATH=providers.db
MODEL_TIMEOUT=60
```