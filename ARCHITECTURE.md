"""
Project Structure Documentation - Linus Style
"Documentation should be simple and useful, not fancy" - Linus Torvalds

AI Peer Review Platform - Architecture Overview
================================================

Directory Structure:
--------------------
/home/docker-al/
├── main.py              # Entry point - FastAPI application
├── requirements.txt     # Dependencies
├── providers.db         # SQLite database
├── api/                 # API layer
│   ├── __init__.py
│   └── router.py        # API endpoints
├── core/                # Business logic layer
│   ├── __init__.py
│   ├── config.py        # Configuration management (NEW)
│   ├── logging.py       # Unified logging (NEW)
│   ├── exceptions.py    # Exception hierarchy (NEW)
│   ├── database.py      # Database operations
│   ├── models.py        # AI model abstractions
│   └── orchestrator.py  # Peer review orchestration
└── static/              # Frontend assets
    ├── index.html       # Main UI
    ├── script.js        # Core JS logic
    ├── wallpaper.js     # Wallpaper module
    ├── history.js       # History module
    └── i18n.js          # Internationalization

Core Principles (Linus Style):
-------------------------------
1. **Good Taste**: Remove special cases, make edge cases normal cases
2. **Simplicity**: Explicit is better than implicit
3. **Single Responsibility**: Each module does one thing well
4. **No Magic**: Configuration and behavior should be obvious

Architecture Layers:
--------------------
1. **API Layer** (api/router.py)
   - HTTP request/response handling
   - Input validation (Pydantic)
   - Error translation (to HTTP codes)
   
2. **Business Logic** (core/)
   - Orchestrator: Peer review workflow
   - Models: AI model abstraction
   - Database: Data persistence
   
3. **Infrastructure** (core/)
   - Config: Centralized configuration
   - Logging: Unified logging
   - Exceptions: Structured errors

Key Improvements in v2.0:
--------------------------
1. **Centralized Configuration**: No more hardcoded values
   - Environment-based config
   - Easy to override for testing
   
2. **Unified Logging**: Consistent logging across all modules
   - Simple format, easy to grep
   - Log levels properly used
   
3. **Proper Error Handling**: Exception hierarchy
   - Errors are typed and explicit
   - No more swallowed exceptions
   
4. **Dependency Injection**: No more global imports
   - Config injected where needed
   - Testable and maintainable

Configuration:
--------------
Environment variables (optional, with defaults):
- SERVER_HOST=0.0.0.0
- SERVER_PORT=8000
- SERVER_RELOAD=true
- LOG_LEVEL=info
- DB_PATH=providers.db
- MODEL_TIMEOUT=60
- MODEL_TEMPERATURE=0.7
- MODEL_MAX_RETRIES=3

Testing:
--------
Run the server:
    python main.py

Health check:
    curl http://localhost:8000/health

Future Enhancements:
--------------------
1. Searxng integration (search capability)
2. MCP protocol support
3. Image generation optimization
4. Proxy support (SOCKS/HTTP)
5. Advanced prompt management

"Talk is cheap. Show me the code." - Linus Torvalds
