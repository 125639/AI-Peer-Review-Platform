import abc
import openai
import google.generativeai as genai
import aiohttp
from typing import List, Dict, Optional, Coroutine

# --- 抽象基类 ---
class BaseModel(abc.ABC):
    def __init__(self, provider_config: Dict, model_name: str):
        self.name = f"{provider_config['name']}::{model_name}"
        self.provider_type = provider_config['type']
    
    @abc.abstractmethod
    async def generate(self, messages: List[Dict], session: aiohttp.ClientSession) -> str:
        pass

# --- OpenAI 兼容模型 ---
class OpenAIModel(BaseModel):
    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        self.model_name = model_name
        self.client = openai.AsyncOpenAI(
            api_key=provider_config['api_key'],
            base_url=provider_config.get('api_base')
        )

    async def generate(self, messages: List[Dict], session: aiohttp.ClientSession) -> str:
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            stream=False 
        )
        return response.choices[0].message.content or ""

# --- Google Gemini 模型 ---
class GeminiModel(BaseModel):
    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        self.model_name = model_name
        genai.configure(api_key=provider_config['api_key'])
        # 注意: Gemini的异步支持需要特定设置，此处简化为在线程池中运行同步代码
        self.model = genai.GenerativeModel(model_name)

    async def generate(self, messages: List[Dict], session: aiohttp.ClientSession) -> str:
        # 重构历史记录以适应Gemini格式
        gemini_history = []
        for msg in messages[:-1]: # 除了最后一个用户消息
            gemini_history.append({'role': msg['role'], 'parts': [{'text': msg['content']}]})
        
        last_user_message = messages[-1]['content']
        
        # Gemini的generate_content是同步的，所以我们在异步函数中await它
        # 实际生产中应使用 asyncio.to_thread 来避免阻塞事件循环
        response = await self.model.generate_content_async(last_user_message, generation_config={"temperature": 0.7})
        return response.text

# --- 工厂函数 ---
def create_model_instance(provider_config: Dict, model_name: str) -> Optional[BaseModel]:
    """根据服务商配置和模型名称创建模型实例。"""
    model_type = provider_config.get('type')
    if model_type == 'OpenAI':
        return OpenAIModel(provider_config, model_name)
    elif model_type == 'Gemini':
        # Gemini的Python SDK目前对多模型实例的异步支持不佳，此实现为简化版
        return GeminiModel(provider_config, model_name)
    else:
        # 可以扩展支持其他类型的模型
        return None

