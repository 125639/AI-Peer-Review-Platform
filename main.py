from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from api.router import router as api_router
import core.database as db
from datetime import datetime
import os

app = FastAPI(title="AI Model Factory v14.3")

# 判断是否为开发模式
IS_DEV = os.getenv("ENV", "development") == "development"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api_router, prefix="/api", tags=["API"])

@app.on_event("startup")
async def startup_event():
    """启动时初始化数据库"""
    db.initialize_database()  # ← 修复：使用正确的函数名
    print("✓ Database initialized successfully")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # 开发模式：使用时间戳，每次都是新的
    # 生产模式：使用固定版本号，可以缓存
    if IS_DEV:
        cache_buster = str(int(datetime.now().timestamp()))
    else:
        cache_buster = "14.3"
    
    html_content = html_content.replace(
        '<script src="/static/script.js"></script>',
        f'<script src="/static/script.js?v={cache_buster}"></script>'
    )
    
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

