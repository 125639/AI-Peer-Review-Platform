import abc
import openai
import google.generativeai as genai
from typing import List, Dict, Optional, AsyncGenerator
import asyncio

class BaseModel(abc.ABC):
    def __init__(self, provider_config: Dict, model_name: str):
        self.name = f"{provider_config['name']}::{model_name}"
        self.provider_type = provider_config['type']
    
    @abc.abstractmethod
    async def generate(self, messages: List[Dict]) -> str:
        pass
    
    async def generate_stream(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        result = await self.generate(messages)
        for char in result:
            yield char
            await asyncio.sleep(0.01)

class OpenAIModel(BaseModel):
    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        self.model_name = model_name
        self.client = openai.AsyncOpenAI(
            api_key=provider_config['api_key'],
            base_url=provider_config.get('api_base')
        )

    async def generate(self, messages: List[Dict]) -> str:
        try:
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[Error: {e}]"
    
    async def generate_stream(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        try:
            stream = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7,
                stream=True
            )
            async for chunk in stream:
                if content := chunk.choices[0].delta.content:
                    yield content
        except Exception as e:
            yield f"[Error: {e}]"

class GeminiModel(BaseModel):
    def __init__(self, provider_config: Dict, model_name: str):
        super().__init__(provider_config, model_name)
        self.model_name = model_name
        genai.configure(api_key=provider_config['api_key'])
        self.model = genai.GenerativeModel(model_name)

    async def generate(self, messages: List[Dict]) -> str:
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
    model_type = provider_config.get('type')
    if model_type == 'OpenAI':
        return OpenAIModel(provider_config, model_name)
    elif model_type == 'Gemini':
        return GeminiModel(provider_config, model_name)
    return None

