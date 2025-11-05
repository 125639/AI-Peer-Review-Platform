#!/usr/bin/env python3
"""
图像生成提示词优化系统
支持多种图像生成模型的提示词优化
"""

import abc
from typing import List, Optional

class BaseImagePromptOptimizer(abc.ABC):
    """基础提示词优化器"""

    def __init__(self, model_type: str):
        self.model_type = model_type

    def _add_keywords(self, prompt: str, keywords: List[str]) -> str:
        """添加关键词到提示词，避免重复"""
        current_keywords = {k.strip() for k in prompt.lower().split(',')}
        for keyword in keywords:
            if keyword.startswith('--'):
                if keyword not in prompt:
                    prompt += f" {keyword}"
            elif keyword.lower() not in current_keywords:
                prompt += f", {keyword}"
                current_keywords.add(keyword.lower())
        return prompt

    def _apply_style_template(self, prompt: str, style_template: Optional[str]) -> str:
        """应用风格模板"""
        return f"{style_template}, {prompt}" if style_template else prompt

    @abc.abstractmethod
    def optimize_prompt(self, user_prompt: str, style_template: str = None) -> str:
        pass

    @abc.abstractmethod
    def get_default_style_template(self) -> str:
        pass

class OpenAIImageOptimizer(BaseImagePromptOptimizer):
    """OpenAI图像模型提示词优化器"""

    def __init__(self):
        super().__init__('OpenAI')
        self.quality_keywords = [
            "masterpiece", "best quality", "ultradetailed", "8K, UHD",
            "high resolution", "detailed", "professional photography",
            "cinematic lighting", "vibrant colors", "epic composition",
            "fine details", "award winning"
        ]
        self.artistic_keywords = [
            "surrealism", "abstract art", "impressionistic", "cyberpunk",
            "fantasy art", "sci-fi art", "watercolor", "oil painting", "pencil sketch"
        ]

    def optimize_prompt(self, user_prompt: str, style_template: str = None) -> str:
        """优化OpenAI图像生成的提示词"""
        prompt = self._add_keywords(user_prompt, self.quality_keywords)
        prompt = self._add_keywords(prompt, self.artistic_keywords)
        return self._apply_style_template(prompt, style_template)

    def get_default_style_template(self) -> str:
        return """Create a high-quality artistic image with professional composition,
lighting and depth of field. Use cinematic lighting and professional
photography techniques to create a visually stunning composition."

class SDXLImageOptimizer(BaseImagePromptOptimizer):
    """Stable Diffusion XL 提示词优化器"""

    def __init__(self):
        super().__init__('SDXL')
        self.keywords = [
            "cinematic photography", "photorealistic", "artistic masterpiece",
            "professional studio lighting", "vibrant, dramatic colors",
            "ultra realistic", "sharp focus", "high detail",
            "professional lighting", "depth of field", "8k, UHD"
        ]

    def optimize_prompt(self, user_prompt: str, style_template: str = None) -> str:
        """优化SDXL图像生成的提示词"""
        prompt = self._add_keywords(user_prompt, self.keywords)
        return self._apply_style_template(prompt, style_template)

    def get_default_style_template(self) -> str:
        return """Create a photorealistic image with professional
lighting and composition. Pay attention to realistic textures,
lighting effects and fine details."

class MidjourneyOptimizer(BaseImagePromptOptimizer):
    """Midjourney 提示词优化器"""

    def __init__(self):
        super().__init__('Midjourney')
        self.keywords = [
            "--v 5.2", "--ar 16:9", "--style raw", "--s 750", "--q 2",
            "cinematic", "photorealistic", "epic composition",
            "ultra detailed", "vibrant colors", "award winning photography"
        ]

    def optimize_prompt(self, user_prompt: str, style_template: str = None) -> str:
        """优化Midjourney图像生成的提示词"""
        prompt = self._add_keywords(user_prompt, self.keywords)
        return self._apply_style_template(prompt, style_template)

    def get_default_style_template(self) -> str:
        return """Create a stunning, highly detailed image with a strong sense of atmosphere and professional aesthetics. Emphasize visual storytelling and dramatic impact."
