"""
AI Peer Review Platform - Main Application
Linus Style: "Simple, explicit, and maintainable"
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from api.router import router as api_router
from core.database import initialize_database
from core.logging import get_logger
from core.config import get_config

# Initialize configuration and logging
config = get_config()
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager - modern FastAPI style"""
    # Startup
    logger.info("Starting AI Peer Review Platform v2.0...")
    initialize_database()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down AI Peer Review Platform...")

# Create FastAPI app - simple and explicit
app = FastAPI(
    title="AI Peer Review Platform",
    description="Linus-style: Simple, explicit, and maintainable",
    version="2.0.0",
    lifespan=lifespan
)

# CORS - allow all in development, restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files and API routes
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api_router, prefix="/api")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve main page"""
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        logger.error("index.html not found")
        return HTMLResponse(content="<h1>Error: index.html not found</h1>", status_code=500)

@app.get("/health")
async def health_check():
    """Health check endpoint - for monitoring"""
    return {"status": "ok", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {config.server.host}:{config.server.port}")
    uvicorn.run(
        "main:app",
        host=config.server.host,
        port=config.server.port,
        reload=config.server.reload,
        log_level=config.server.log_level
    )

