# pyright: reportGeneralTypeIssues=false
"""
AI模型抽象层
"""
import abc
import asyncio
import json
from typing import Any, AsyncGenerator, Dict, List, Optional, cast

import google.generativeai as genai
import openai
from openai import NOT_GIVEN
from openai.types.chat import ChatCompletionMessageParam


def _parse_max_pages(value: Any) -> Optional[int]:
    """Normalize the optional max_pages argument passed to tools."""
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None

class BaseModel(abc.ABC):
    """基础模型抽象类"""

    def __init__(self, provider_config: Dict[str, Any], model_name: str):
        self.name = f"{provider_config['name']}::{model_name}"
        self.provider_type = provider_config['type']
        self.model_name = model_name

    @abc.abstractmethod
    async def generate(self, messages: List[Any], tools: Optional[List[Any]] = None, tool_choice: Optional[str] = None) -> str:
        """生成回复"""
        pass

    async def generate_stream(self, messages: List[Any], tools: Optional[List[Any]] = None, tool_choice: Optional[str] = None) -> AsyncGenerator[str, None]:
        """流式生成回复"""
        result = await self.generate(messages)
        for char in result:
            yield char
            await asyncio.sleep(0.01)

class OpenAIModel(BaseModel):
    """OpenAI模型实现"""

    def __init__(self, provider_config: Dict[str, Any], model_name: str):
        super().__init__(provider_config, model_name)
        
        # 配置代理
        from core.config import get_config
        import httpx
        config = get_config()
        http_client = None
        
        if config.proxy.enabled and config.proxy.host and config.proxy.port:
            proxy_url = None
            if config.proxy.type == 'http':
                if config.proxy.username and config.proxy.password:
                    proxy_url = f"http://{config.proxy.username}:{config.proxy.password}@{config.proxy.host}:{config.proxy.port}"
                else:
                    proxy_url = f"http://{config.proxy.host}:{config.proxy.port}"
            elif config.proxy.type in ['socks5', 'socks']:
                if config.proxy.username and config.proxy.password:
                    proxy_url = f"socks5://{config.proxy.username}:{config.proxy.password}@{config.proxy.host}:{config.proxy.port}"
                else:
                    proxy_url = f"socks5://{config.proxy.host}:{config.proxy.port}"
            
            if proxy_url:
                http_client = httpx.AsyncClient(proxy=proxy_url)
        
        self.client = openai.AsyncOpenAI(
            api_key=provider_config['api_key'],
            base_url=provider_config.get('api_base'),
            http_client=http_client
        )

    async def generate(self, messages: List[ChatCompletionMessageParam], tools: Optional[List[Any]] = None, tool_choice: Optional[str] = None) -> str:
        try:
            tool_payload = tools if tools is not None else NOT_GIVEN
            openai_client = cast(Any, self.client)
            response = await openai_client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                tools=tool_payload,
                tool_choice=tool_choice,
            )
            message = response.choices[0].message
            
            # 处理工具调用
            if message.tool_calls:
                # 将工具调用添加到消息历史中
                tool_calls_list: List[Any] = list(message.tool_calls or [])
                tool_call_dicts: List[Dict[str, Any]] = []
                for tc in tool_calls_list:
                    tc_id = getattr(tc, "id", "")
                    func = getattr(tc, "function", None)
                    tool_call_dicts.append({
                        "id": tc_id,
                        "type": "function",
                        "function": {
                            "name": getattr(func, "name", ""),
                            "arguments": getattr(func, "arguments", ""),
                        }
                    })

                messages.append(cast(ChatCompletionMessageParam, {
                    "role": "assistant",
                    "content": message.content,
                    "tool_calls": tool_call_dicts,
                }))
                
                # 执行工具调用
                import json
                from core.searxng import get_searxng_client
                from core.browser_search import (
                    BrowserSearchUnavailable,
                    get_browser_search_client,
                )

                tool_results: List[Dict[str, Any]] = []
                for tc in tool_calls_list:
                    func = getattr(tc, "function", None)
                    func_name = getattr(func, "name", "") or ""
                    try:
                        args = json.loads(getattr(func, "arguments", "") or "{}")
                    except json.JSONDecodeError:
                        args = {}

                    args_dict: Dict[str, Any] = cast(Dict[str, Any], args) if isinstance(args, dict) else {}

                    query = str(args_dict.get("query", "") or "").strip()
                    max_pages = _parse_max_pages(args_dict.get("max_pages"))

                    if func_name == "network_search":
                        if not query:
                            tool_results.append({
                                "tool_call_id": getattr(tc, "id", ""),
                                "role": "tool",
                                "name": "network_search",
                                "content": "搜索关键词为空。"
                            })
                            continue

                        try:
                            searxng_client = cast(Any, get_searxng_client())
                            search_result: Dict[str, Any] = await searxng_client.search_with_ai_summary(query)
                            if search_result.get('success'):
                                results_text = search_result.get('ai_context', '')
                                if results_text:
                                    content = (
                                        "搜索结果：\n\n"
                                        f"{results_text}\n\n"
                                        "基于以上搜索结果，请回答用户的问题。"
                                    )
                                else:
                                    content = "搜索未找到相关结果。"
                            else:
                                error_msg = search_result.get('error', '搜索失败')
                                content = f"搜索失败: {error_msg}"
                        except Exception as e:
                            content = f"执行搜索时出错: {str(e)}"

                        tool_results.append({
                            "tool_call_id": getattr(tc, "id", ""),
                            "role": "tool",
                            "name": "network_search",
                            "content": content
                        })

                    elif func_name == "browser_search":
                        if not query:
                            tool_results.append({
                                "tool_call_id": getattr(tc, "id", ""),
                                "role": "tool",
                                "name": "browser_search",
                                "content": "浏览器搜索关键词为空。"
                            })
                            continue

                        try:
                            browser_client = cast(Any, get_browser_search_client())
                            browser_result: Dict[str, Any] = await browser_client.search(query, max_pages=max_pages)
                            if browser_result.get("success"):
                                context = browser_result.get("context", "")
                                if context:
                                    content = (
                                        "浏览器抓取结果：\n\n"
                                        f"{context}\n\n"
                                        "请结合上述网页内容，整合出权威、最新的回答。"
                                    )
                                else:
                                    content = "浏览器抓取完成，但未提取到可用正文。"
                            else:
                                content = f"浏览器抓取失败: {browser_result.get('error', '未知错误')}"
                        except BrowserSearchUnavailable as e:
                            content = f"浏览器搜索当前不可用: {e}"
                        except Exception as e:
                            content = f"执行浏览器搜索时出错: {str(e)}"

                        tool_results.append({
                            "tool_call_id": getattr(tc, "id", ""),
                            "role": "tool",
                            "name": "browser_search",
                            "content": content
                        })
                
                # 将工具结果添加到消息历史中
                messages.extend(cast(List[ChatCompletionMessageParam], tool_results))
                
                # 再次调用模型，让它基于搜索结果生成回答
                second_response = await openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=0.7,
                    tools=tool_payload,
                    tool_choice=tool_choice,
                )
                return second_response.choices[0].message.content or ""
            
            return message.content or ""
        except Exception as e:
            return f"[Error: {e}]"

    async def generate_stream(self, messages: List[ChatCompletionMessageParam], tools: Optional[List[Any]] = None, tool_choice: Optional[str] = None) -> AsyncGenerator[str, None]:
        try:
            tool_payload = tools if tools is not None else NOT_GIVEN
            openai_client = cast(Any, self.client)
            stream = await openai_client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                stream=True,
                tools=tool_payload,
                tool_choice=tool_choice,
            )
            
            # 收集完整的消息内容，用于处理工具调用
            full_content = ""
            tool_calls_accumulated: Dict[str, Dict[str, Any]] = {}
            
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                tool_calls = chunk.choices[0].delta.tool_calls

                if content:
                    full_content += content
                    yield content
                
                if tool_calls:
                    # 累积工具调用信息
                    for tc in tool_calls:
                        tc_id = getattr(tc, "id", "")
                        func = getattr(tc, "function", None)
                        if tc_id and func:
                            if tc_id not in tool_calls_accumulated:
                                tool_calls_accumulated[tc_id] = {
                                    "id": tc_id,
                                    "name": getattr(func, "name", "") or "",
                                    "arguments": getattr(func, "arguments", "") or ""
                                }
                            else:
                                arguments = getattr(func, "arguments", "")
                                if arguments:
                                    tool_calls_accumulated[tc_id]["arguments"] += arguments
            
            # 如果检测到工具调用，执行它们
            if tool_calls_accumulated:
                # 将工具调用添加到消息历史中
                messages.append({
                    "role": "assistant",
                    "content": full_content,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": tc["arguments"]
                            }
                        } for tc in tool_calls_accumulated.values()
                    ]
                })
                
                # 执行工具调用
                import json
                from core.searxng import get_searxng_client
                from core.browser_search import (
                    BrowserSearchUnavailable,
                    get_browser_search_client,
                )

                tool_results: List[Dict[str, Any]] = []
                for tc_data in tool_calls_accumulated.values():
                    func_name = tc_data.get("name", "")
                    try:
                        args = json.loads(tc_data.get("arguments", "") or "{}")
                    except json.JSONDecodeError:
                        args = {}

                    args_dict: Dict[str, Any] = cast(Dict[str, Any], args) if isinstance(args, dict) else {}

                    query = str(args_dict.get("query", "") or "").strip()
                    max_pages = _parse_max_pages(args_dict.get("max_pages"))

                    if func_name == "network_search":
                        if not query:
                            tool_results.append({
                                "tool_call_id": tc_data["id"],
                                "role": "tool",
                                "name": "network_search",
                                "content": "搜索关键词为空。"
                            })
                            continue

                        try:
                            searxng_client = cast(Any, get_searxng_client())
                            search_result: Dict[str, Any] = await searxng_client.search_with_ai_summary(query)
                            if search_result.get('success'):
                                results_text = search_result.get('ai_context', '')
                                if results_text:
                                    content = (
                                        "搜索结果：\n\n"
                                        f"{results_text}\n\n"
                                        "基于以上搜索结果，请回答用户的问题。"
                                    )
                                else:
                                    content = "搜索未找到相关结果。"
                            else:
                                content = f"搜索失败: {search_result.get('error', '搜索失败')}"
                        except Exception as e:
                            content = f"执行搜索时出错: {str(e)}"

                        tool_results.append({
                            "tool_call_id": tc_data["id"],
                            "role": "tool",
                            "name": "network_search",
                            "content": content
                        })

                    elif func_name == "browser_search":
                        if not query:
                            tool_results.append({
                                "tool_call_id": tc_data["id"],
                                "role": "tool",
                                "name": "browser_search",
                                "content": "浏览器搜索关键词为空。"
                            })
                            continue

                        try:
                            browser_client = cast(Any, get_browser_search_client())
                            browser_result: Dict[str, Any] = await browser_client.search(query, max_pages=max_pages)
                            if browser_result.get("success"):
                                context = browser_result.get("context", "")
                                if context:
                                    content = (
                                        "浏览器抓取结果：\n\n"
                                        f"{context}\n\n"
                                        "请结合上述网页内容，整合出权威、最新的回答。"
                                    )
                                else:
                                    content = "浏览器抓取完成，但未提取到可用正文。"
                            else:
                                content = f"浏览器抓取失败: {browser_result.get('error', '未知错误')}"
                        except BrowserSearchUnavailable as e:
                            content = f"浏览器搜索当前不可用: {e}"
                        except Exception as e:
                            content = f"执行浏览器搜索时出错: {str(e)}"

                        tool_results.append({
                            "tool_call_id": tc_data["id"],
                            "role": "tool",
                            "name": "browser_search",
                            "content": content
                        })
                
                # 将工具结果添加到消息历史中
                messages.extend(cast(List[ChatCompletionMessageParam], tool_results))
                
                # 再次调用模型，流式返回基于搜索结果的回答
                second_stream = await openai_client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=0.7,
                    stream=True,
                    tools=tool_payload,
                    tool_choice=tool_choice,
                )
                async for chunk in second_stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
        except Exception as e:
            yield f"[Error: {e}]"

class GeminiModel(BaseModel):
    """Gemini模型实现"""

    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        genai.configure(api_key=provider_config['api_key'])
        self.model = genai.GenerativeModel(model_name)

    async def generate(self, messages: List[Dict], tools: Optional[List[Any]] = None, tool_choice: Optional[str] = None) -> str:
        try:
            gemini_messages = [
                {'role': 'user' if msg['role'] == 'user' else 'model', 'parts': [msg['content']]}
                for msg in messages
            ]
            response = await asyncio.to_thread(
                self.model.generate_content,
                gemini_messages,
                generation_config=genai.types.GenerationConfig(temperature=0.7)
            )
            return response.text
        except Exception as e:
            return f"[Error: {e}]"

def create_model_instance(provider_config: Dict, model_name: str) -> Optional[BaseModel]:
    """工厂函数：根据配置创建模型实例"""
    model_type = provider_config.get('type')
    if model_type == 'OpenAI':
        return OpenAIModel(provider_config, model_name)
    elif model_type == 'Gemini':
        return GeminiModel(provider_config, model_name)
    return None
