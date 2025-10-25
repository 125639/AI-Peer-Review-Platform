import abc
import openai
import google.generativeai as genai
from typing import List, Dict, Optional, AsyncGenerator
import asyncio

# --- 抽象基类 ---
class BaseModel(abc.ABC):
    """所有AI模型的抽象基类"""
    def __init__(self, provider_config: Dict, model_name: str):
        self.name = f"{provider_config['name']}::{model_name}"
        self.provider_type = provider_config['type']
    
    @abc.abstractmethod
    async def generate(self, messages: List[Dict]) -> str:
        """生成响应（阻塞式，返回完整结果）"""
        pass
    
    async def generate_stream(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        """流式生成（可选，默认回退到阻塞式）"""
        result = await self.generate(messages)
        # 模拟流式输出
        for char in result:
            yield char
            await asyncio.sleep(0.01)

# --- OpenAI 兼容模型 ---
class OpenAIModel(BaseModel):
    """支持OpenAI API格式的模型"""
    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        self.model_name = model_name
        self.client = openai.AsyncOpenAI(
            api_key=provider_config['api_key'],
            base_url=provider_config.get('api_base')
        )

    async def generate(self, messages: List[Dict]) -> str:
        """阻塞式生成"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[OpenAI API Error: {str(e)}]"
    
    async def generate_stream(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        """真正的流式生成"""
        try:
            stream = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                stream=True
            )
            
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            yield f"[OpenAI API Error: {str(e)}]"

# --- Google Gemini 模型 ---
class GeminiModel(BaseModel):
    """Google Gemini模型"""
    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        self.model_name = model_name
        genai.configure(api_key=provider_config['api_key'])
        self.model = genai.GenerativeModel(model_name)

    async def generate(self, messages: List[Dict]) -> str:
        """阻塞式生成"""
        try:
            gemini_messages = self._convert_messages(messages)
            response = await asyncio.to_thread(
                self.model.generate_content,
                gemini_messages,
                generation_config=genai.types.GenerationConfig(temperature=0.7)
            )
            return response.text
        except Exception as e:
            return f"[Gemini API Error: {str(e)}]"
    
    def _convert_messages(self, messages: List[Dict]) -> List[Dict]:
        """转换消息格式"""
        result = []
        for msg in messages:
            role = 'user' if msg['role'] == 'user' else 'model'
            result.append({'role': role, 'parts': [msg['content']]})
        return result

# --- 工厂函数 ---
def create_model_instance(provider_config: Dict, model_name: str) -> Optional[BaseModel]:
    """根据配置创建模型实例"""
    model_type = provider_config.get('type')
    if model_type == 'OpenAI':
        return OpenAIModel(provider_config, model_name)
    elif model_type == 'Gemini':
        return GeminiModel(provider_config, model_name)
    else:
        return None

