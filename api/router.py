import asyncio
import base64
import json
import mimetypes
from typing import List, Dict, Any, Optional, AsyncGenerator

import google.generativeai as genai
import openai
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from core.orchestrator import Orchestrator
import core.database as db
from core.searxng import get_searxng_client
from core.logging import get_logger

logger = get_logger(__name__)

class ChatMessage(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    question: str
    selected_models: List[str]
    history: Optional[List[ChatMessage]] = []
    ocr_text: Optional[str] = None
    enable_search: Optional[bool] = False

class ProviderModel(BaseModel):
    name: str = Field(..., min_length=1)
    type: str = Field(..., pattern="^(OpenAI|Gemini)$")
    api_key: str
    models: str = Field(..., min_length=1)
    api_base: Optional[str] = None

class ProviderUpdateModel(BaseModel):
    name: str = Field(..., min_length=1)
    type: str = Field(..., pattern="^(OpenAI|Gemini)$")
    api_key: Optional[str] = None
    models: str = Field(..., min_length=1)
    api_base: Optional[str] = None

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}

def get_available_tools(enable_network: bool = False):
    """获取可用的工具列表"""
    from core.config import get_config
    config = get_config()
    tools = []
    
    # 如果 SearXNG 已启用并且用户开启网络搜索，添加搜索工具
    if enable_network and config.searxng.enabled:
        tools.append({
            "type": "function",
            "function": {
                "name": "network_search",
                "description": "使用 SearXNG 元搜索引擎进行网络搜索。当你需要获取实时信息、最新资讯、事实核查或当前事件时，应该使用此工具。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "搜索关键词或问题"
                        }
                    },
                    "required": ["query"]
                }
            }
        })
    
    return tools

async def stream_process_generator(request: QueryRequest) -> AsyncGenerator[str, None]:
    try:
        orch = Orchestrator()
        history_dicts = [msg.model_dump() for msg in request.history] if request.history else []
        # 根据用户设置获取可用工具
        tools = get_available_tools(enable_network=request.enable_search or False)
        async for event in orch.process_query_stream(
            request.question, 
            request.selected_models, 
            history_dicts, 
            request.ocr_text,
            tools=tools if tools else None
        ):
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
    db.add_provider(data.model_dump())
    return {"message": "添加成功"}

@router.delete("/providers/{name}")
def remove_provider(name: str):
    if not db.delete_provider(name):
        raise HTTPException(404, "未找到该服务商")
    return {"message": "删除成功"}

@router.put("/providers/{name}")
def update_provider_by_name(name: str, data: ProviderUpdateModel):
    if data.name != name:
        raise HTTPException(400, "不允许修改名称")
    if data.type == 'OpenAI' and not data.api_base:
        raise HTTPException(422, "OpenAI类型需提供api_base")
    
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)
    
    # 如果api_key为空字符串或包含占位符，则从更新数据中移除，保留原有值
    if 'api_key' in update_data and (not update_data['api_key'] or '...' in update_data['api_key'] or update_data['api_key'] == '********'):
        del update_data['api_key']
    
    # 对于Gemini类型，如果没有提供api_base，则设为None
    if data.type == 'Gemini' and 'api_base' not in update_data:
        update_data['api_base'] = None
    
    if not db.update_provider(name, update_data):
        raise HTTPException(404, "更新失败")
    return {"message": "更新成功"}

# 提示词管理API
class PromptModel(BaseModel):
    name_zh: str = Field(..., min_length=1)
    critique_prompt_zh: str = Field(..., min_length=1)
    revision_prompt_zh: str = Field(..., min_length=1)
    name_en: str = Field(..., min_length=1)
    critique_prompt_en: str = Field(..., min_length=1)
    revision_prompt_en: str = Field(..., min_length=1)
    is_active: Optional[int] = 0

@router.get("/prompts", response_model=List[Dict[str, Any]])
def get_prompts():
    return db.get_all_prompts()

@router.post("/prompts", status_code=201)
def add_new_prompt(data: PromptModel):
    # 只校验中英文名称是否重复
    for p in db.get_all_prompts():
        if p['name_zh'] == data.name_zh or p['name_en'] == data.name_en:
            raise HTTPException(409, f"提示词 '{data.name_zh}'/{data.name_en} 已存在")
    db.add_prompt(data.model_dump())
    return {"message": "添加成功"}

@router.put("/prompts/{prompt_id}")
def update_prompt_by_id(prompt_id: int, data: PromptModel):
    if not db.update_prompt(prompt_id, data.model_dump()):
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


# OCR 接口：上传图片，指定OCR模型，返回识别出的文本
@router.post("/ocr")
async def ocr_image(
    file: UploadFile = File(...),
    ocr_model: str = Form(...)
):
    logger.info(f"=== [/api/ocr] OCR请求开始 ===")
    logger.info(f"[/api/ocr] 文件名: {file.filename}")
    logger.info(f"[/api/ocr] Content-Type: {file.content_type}")
    logger.info(f"[/api/ocr] OCR模型: {ocr_model}")
    
    # 解析模型标识: provider::model
    try:
        provider_name, model_name = ocr_model.split("::", 1)
    except ValueError:
        logger.error(f"[/api/ocr] 模型格式错误: {ocr_model}")
        raise HTTPException(400, "ocr_model 格式应为 '服务商名::模型名'")

    provider_config = db.get_provider_by_name(provider_name)
    if not provider_config:
        logger.error(f"[/api/ocr] 未找到服务商: {provider_name}")
        raise HTTPException(404, f"未找到服务商: {provider_name}")

    # 读取图片字节与 MIME 类型
    image_bytes = await file.read()
    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    
    logger.info(f"[/api/ocr] 图片字节数: {len(image_bytes)}")
    logger.info(f"[/api/ocr] MIME类型: {mime_type}")

    if not image_bytes:
        logger.error(f"[/api/ocr] 未读取到图片内容")
        raise HTTPException(400, "未读取到图片内容")

    provider_type = provider_config.get('type')
    logger.info(f"[/api/ocr] 服务商类型: {provider_type}")

    try:
        if provider_type == 'OpenAI':
            logger.info(f"[/api/ocr] 使用OpenAI Vision API")
            # 使用 OpenAI Chat Completions 的 vision 能力
            client = openai.AsyncOpenAI(
                api_key=provider_config['api_key'],
                base_url=provider_config.get('api_base')
            )
            b64 = base64.b64encode(image_bytes).decode('utf-8')
            image_url = f"data:{mime_type};base64,{b64}"
            prompt_text = "请识别图片中的文字内容，尽量保持原有段落与换行。只输出识别到的文本。"
            logger.info(f"[/api/ocr] 发送OpenAI API请求...")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {"type": "image_url", "image_url": {"url": image_url}}
                        ]
                    }
                ],
                temperature=0
            )
            text = response.choices[0].message.content or ""
            logger.info(f"[/api/ocr] OpenAI返回OCR文本，长度: {len(text)}")
            logger.info(f"[/api/ocr] OCR文本内容: {text[:200]}...")

        elif provider_type == 'Gemini':
            logger.info(f"[/api/ocr] 使用Gemini多模态API")
            # 使用 Gemini 多模态能力进行OCR
            genai.configure(api_key=provider_config['api_key'])
            model = genai.GenerativeModel(model_name)
            prompt_text = "请识别图片中的文字内容，尽量保持原有段落与换行。只输出识别到的文本。"
            parts = [
                prompt_text,
                {"mime_type": mime_type, "data": image_bytes}
            ]
            logger.info(f"[/api/ocr] 发送Gemini API请求...")
            resp = await asyncio.to_thread(model.generate_content, parts)
            text = getattr(resp, 'text', '') or ''
            logger.info(f"[/api/ocr] Gemini返回OCR文本，长度: {len(text)}")
            logger.info(f"[/api/ocr] OCR文本内容: {text[:200]}...")
        else:
            logger.error(f"[/api/ocr] 不支持的服务商类型: {provider_type}")
            raise HTTPException(400, f"不支持的服务商类型: {provider_type}")

        if not text:
            logger.warning(f"[/api/ocr] OCR返回空文本")
            text = ""
        
        logger.info(f"[/api/ocr] 返回结果: ocr_text长度={len(text)}")
        return JSONResponse({"ocr_text": text})
    except Exception as e:
        logger.error(f"[/api/ocr] OCR识别失败: {e}", exc_info=True)
        raise HTTPException(500, f"OCR 识别失败: {e}")


# ==================== SearXNG 搜索引擎 API ====================

class SearchRequest(BaseModel):
    """搜索请求模型"""
    query: str = Field(..., min_length=1, description="搜索关键词")
    categories: Optional[List[str]] = Field(None, description="搜索分类，如 ['general', 'images']")
    engines: Optional[List[str]] = Field(None, description="搜索引擎，如 ['google', 'bing']")
    language: Optional[str] = Field('zh-CN', description="语言代码")
    page: Optional[int] = Field(1, ge=1, le=10, description="页码（1-10）")
    time_range: Optional[str] = Field(None, description="时间范围，如 'day', 'week', 'month'")

@router.post("/search")
async def search(request: SearchRequest):
    """
    执行搜索查询

    使用 SearXNG 元搜索引擎进行隐私友好的网络搜索
    """
    logger.info(f"[/api/search] 搜索请求: '{request.query}'")

    try:
        client = get_searxng_client()
        results = await client.search(
            query=request.query,
            categories=request.categories,
            engines=request.engines,
            language=request.language,
            page=request.page,
            time_range=request.time_range
        )

        logger.info(f"[/api/search] 搜索完成: {len(results.get('results', []))} 条结果")
        return JSONResponse(results)

    except Exception as e:
        logger.error(f"[/api/search] 搜索失败: {e}", exc_info=True)
        raise HTTPException(500, f"搜索失败: {str(e)}")

@router.post("/search/ai-summary")
async def search_with_ai_summary(request: SearchRequest):
    """
    执行搜索并返回AI摘要上下文

    返回搜索结果以及格式化的AI摘要上下文
    """
    logger.info(f"[/api/search/ai-summary] AI搜索请求: '{request.query}'")

    try:
        client = get_searxng_client()
        results = await client.search_with_ai_summary(request.query)

        logger.info(f"[/api/search/ai-summary] 搜索完成，返回 {len(results.get('results', []))} 条结果")
        return JSONResponse(results)

    except Exception as e:
        logger.error(f"[/api/search/ai-summary] AI搜索失败: {e}", exc_info=True)
        raise HTTPException(500, f"AI搜索失败: {str(e)}")

# SearXNG 配置管理
class SearXNGConfigModel(BaseModel):
    url: str = Field(..., min_length=1)
    enabled: bool = True

@router.get("/config/searxng")
def get_searxng_config():
    """获取 SearXNG 配置"""
    from core.config import get_config
    config = get_config()
    return {
        "url": config.searxng.url,
        "enabled": config.searxng.enabled
    }

@router.put("/config/searxng")
def update_searxng_config(data: SearXNGConfigModel):
    """更新 SearXNG 配置"""
    import os
    import json
    config_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'searxng_config.json')
    
    try:
        config_data = {
            "url": data.url,
            "enabled": data.enabled
        }
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
        
        # 重新加载配置
        from core.config import _config
        if _config:
            _config.searxng.url = data.url
            _config.searxng.enabled = data.enabled
        
        # 重置 SearXNG 客户端和配置缓存
        import core.searxng as searxng_module
        searxng_module._searxng_client = None
        from core.config import _config as config_module
        config_module._config = None  # 强制下次调用时重新加载
        
        logger.info(f"SearXNG 配置已更新: {data.url}, enabled={data.enabled}")
        return {"message": "配置已保存"}
    except Exception as e:
        logger.error(f"保存 SearXNG 配置失败: {e}", exc_info=True)
        raise HTTPException(500, f"保存配置失败: {str(e)}")


