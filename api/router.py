import asyncio
import json
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, AsyncGenerator
from core.orchestrator import Orchestrator
import core.database as db

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

router = APIRouter()

async def stream_process_generator(request: QueryRequest) -> AsyncGenerator[str, None]:
    try:
        orch = Orchestrator()
        history_dicts = [msg.dict() for msg in request.history]
        async for event in orch.process_query_stream(request.question, request.selected_models, history_dicts):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.01)
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'data': f'错误: {e}'}, ensure_ascii=False)}\n\n"

@router.post("/process")
async def process_user_query_stream(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(400, "问题不能为空")
    if not request.selected_models:
        raise HTTPException(400, "必须选择至少一个模型")
    return StreamingResponse(stream_process_generator(request), media_type="text/event-stream")

@router.get("/providers", response_model=List[Dict[str, Any]])
def get_providers():
    return db.get_all_providers()

@router.post("/providers", status_code=201)
def add_new_provider(data: ProviderModel):
    if data.type == 'OpenAI' and not data.api_base:
        raise HTTPException(422, "OpenAI类型需提供api_base")
    if db.get_provider_by_name(data.name):
        raise HTTPException(409, f"服务商 '{data.name}' 已存在")
    db.add_provider(data.dict())
    return {"message": "添加成功"}

@router.delete("/providers/{name}")
def remove_provider(name: str):
    if not db.delete_provider(name):
        raise HTTPException(404, "未找到该服务商")
    return {"message": "删除成功"}

@router.put("/providers/{name}")
def update_provider_by_name(name: str, data: ProviderModel):
    if data.name != name:
        raise HTTPException(400, "不允许修改名称")
    if data.type == 'OpenAI' and not data.api_base:
        raise HTTPException(422, "OpenAI类型需提供api_base")
    
    update_data = data.dict(exclude_unset=True)
    if 'api_key' in update_data and (not update_data['api_key'] or '...' in update_data['api_key'] or update_data['api_key'] == '********'):
        del update_data['api_key']
    
    if not db.update_provider(name, update_data):
        raise HTTPException(404, "更新失败")
    return {"message": "更新成功"}

# 提示词管理API
class PromptModel(BaseModel):
    name: str = Field(..., min_length=1)
    critique_prompt: str = Field(..., min_length=1)
    revision_prompt: str = Field(..., min_length=1)
    is_active: Optional[int] = 0

@router.get("/prompts", response_model=List[Dict[str, Any]])
def get_prompts():
    return db.get_all_prompts()

@router.post("/prompts", status_code=201)
def add_new_prompt(data: PromptModel):
    if any(p['name'] == data.name for p in db.get_all_prompts()):
        raise HTTPException(409, f"提示词 '{data.name}' 已存在")
    db.add_prompt(data.dict())
    return {"message": "添加成功"}

@router.put("/prompts/{prompt_id}")
def update_prompt_by_id(prompt_id: int, data: PromptModel):
    if not db.update_prompt(prompt_id, data.dict()):
        raise HTTPException(404, "更新失败")
    return {"message": "更新成功"}

@router.post("/prompts/{prompt_id}/activate")
def activate_prompt(prompt_id: int):
    if not db.set_active_prompt(prompt_id):
        raise HTTPException(404, "设置失败")
    return {"message": "已激活"}

@router.delete("/prompts/{prompt_id}")
def remove_prompt(prompt_id: int):
    prompts = db.get_all_prompts()
    if len(prompts) <= 1:
        raise HTTPException(400, "至少保留一个提示词")
    if not db.delete_prompt(prompt_id):
        raise HTTPException(404, "删除失败")
    return {"message": "删除成功"}


