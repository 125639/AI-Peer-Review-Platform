import asyncio
import json
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, AsyncGenerator

from core.orchestrator import Orchestrator
import core.database as db

# --- Pydantic 模型定义 ---
class ChatMessage(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    question: str
    selected_models: List[str]
    history: Optional[List[ChatMessage]] = []

class ProviderModel(BaseModel):
    name: str = Field(..., min_length=1)
    type: str = Field(..., pattern="^(OpenAI|Gemini)$")
    api_key: str
    models: str = Field(..., min_length=1)
    api_base: Optional[str] = None

# --- 路由器实例 ---
router = APIRouter()

# --- 流式响应 ---
async def stream_process_generator(request: QueryRequest) -> AsyncGenerator[str, None]:
    """生成器函数，用于流式返回处理事件。"""
    try:
        orch = Orchestrator()
        history_dicts = [msg.dict() for msg in request.history]
        async for event in orch.process_query_stream(request.question, request.selected_models, history_dicts):
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(0.01)
    except Exception as e:
        error_event = {"type": "error", "data": f"服务器内部错误: {e}"}
        yield f"data: {json.dumps(error_event)}\n\n"

@router.post("/process")
async def process_user_query_stream(request: QueryRequest):
    """处理用户查询并返回事件流。"""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")
    if not request.selected_models:
        raise HTTPException(status_code=400, detail="必须选择至少一个模型")
    return StreamingResponse(stream_process_generator(request), media_type="text/event-stream")


# --- Provider CRUD API ---
@router.get("/providers", response_model=List[Dict[str, Any]])
def get_providers():
    """获取所有模型服务商的列表。"""
    return db.get_all_providers()

@router.post("/providers", status_code=status.HTTP_201_CREATED)
def add_new_provider(data: ProviderModel):
    """添加一个新的模型服务商。"""
    if data.type == 'OpenAI' and not data.api_base:
        raise HTTPException(status_code=422, detail="类型为 'OpenAI' 的服务商必须提供 'api_base' URL。")
    if db.get_provider_by_name(data.name):
        raise HTTPException(status_code=409, detail=f"服务商名称 '{data.name}' 已存在。")
    db.add_provider(data.dict())
    return {"message": "添加成功"}

@router.delete("/providers/{name}")
def remove_provider(name: str):
    """删除一个模型服务商。"""
    if not db.delete_provider(name):
        raise HTTPException(404, "未找到该服务商")
    return {"message": "删除成功"}

@router.put("/providers/{name}", status_code=200)
def update_provider_by_name(name: str, data: ProviderModel):
    """更新一个模型服务商。"""
    if data.name != name:
        raise HTTPException(400, "不允许修改名称")
    if data.type == 'OpenAI' and not data.api_base:
        raise HTTPException(422, "OpenAI类型需提供api_base")

    update_data = data.dict(exclude_unset=True)
    if 'api_key' in update_data and (not update_data['api_key'] or '...' in update_data['api_key'] or update_data['api_key'] == '********'):
        del update_data['api_key']

    if not db.update_provider(name, update_data):
        raise HTTPException(404, "未找到该服务商或更新失败")
    return {"message": "更新成功"}

