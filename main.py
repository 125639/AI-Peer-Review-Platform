import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import core.database
from api.router import router as api_router

async def startup_event():
    """在服务器启动时，初始化数据库。"""
    core.database.initialize_database()

app = FastAPI(
    title="AI模型聚合工厂 (v12.0 - Core Dump)",
    on_startup=[startup_event]
)

# 允许所有来源的跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含API路由
app.include_router(api_router, prefix="/api", tags=["AI Factory"])

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", include_in_schema=False)
async def root():
    """根路径返回主页。"""
    return FileResponse("static/index.html")

if __name__ == "__main__":
    # 这是一个帮助信息，实际启动应通过uvicorn命令行
    print("这是一个FastAPI应用。请使用以下命令启动：")
    print("uvicorn main:app --host 0.0.0.0 --port 8000 --reload")

