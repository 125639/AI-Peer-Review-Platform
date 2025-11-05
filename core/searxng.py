"""
SearXNG 搜索引擎集成
提供隐私友好的元搜索功能
"""
import os
import asyncio
from typing import List, Dict, Optional
import aiohttp
try:
    import aiosocks # for socks proxy support (optional)
except ImportError:
    aiosocks = None
from core.logging import get_logger
from core.config import get_config

logger = get_logger(__name__)


class SearXNGClient:
    """SearXNG 客户端"""

    def __init__(self, base_url: str = None):
        """
        初始化 SearXNG 客户端

        Args:
            base_url: SearXNG 实例地址，默认使用公共实例
        """
        self.config = get_config()
        self.base_url = base_url or os.getenv(
            'SEARXNG_URL',
            'https://searx.be'  # 公共 SearXNG 实例
        )
        logger.info(f"SearXNG client initialized with URL: {self.base_url}")

    async def search(
        self,
        query: str,
        categories: Optional[List[str]] = None,
        engines: Optional[List[str]] = None,
        language: str = 'zh-CN',
        page: int = 1,
        time_range: Optional[str] = None
    ) -> Dict:
        """
        执行搜索查询

        Args:
            query: 搜索关键词
            categories: 搜索分类，如 ['general', 'images', 'videos']
            engines: 搜索引擎，如 ['google', 'bing']
            language: 语言代码
            page: 页码
            time_range: 时间范围，如 'day', 'week', 'month', 'year'

        Returns:
            搜索结果字典
        """
        if not query or not query.strip():
            return {
                'success': False,
                'error': '搜索关键词不能为空',
                'results': []
            }

        params = {
            'q': query.strip(),
            'format': 'json',
            'language': language,
            'pageno': page
        }

        if categories:
            params['categories'] = ','.join(categories)

        if engines:
            params['engines'] = ','.join(engines)

        if time_range:
            params['time_range'] = time_range

        try:
            proxy_url = None
            proxy_auth = None
            if self.config.proxy.enabled and self.config.proxy.host and self.config.proxy.port:
                if self.config.proxy.type == 'http':
                    proxy_url = f"http://{self.config.proxy.host}:{self.config.proxy.port}"
                elif self.config.proxy.type == 'socks5':
                    proxy_url = f"socks5://{self.config.proxy.host}:{self.config.proxy.port}"

                if self.config.proxy.username and self.config.proxy.password:
                    proxy_auth = aiohttp.BasicAuth(self.config.proxy.username, self.config.proxy.password)

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/search",
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10),
                    proxy=proxy_url,
                    proxy_auth=proxy_auth
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"SearXNG API error: {response.status} - {error_text}")
                        return {
                            'success': False,
                            'error': f'搜索引擎返回错误: {response.status}',
                            'results': []
                        }

                    data = await response.json()

                    # 提取和格式化结果
                    results = []
                    for item in data.get('results', []):
                        results.append({
                            'title': item.get('title', ''),
                            'url': item.get('url', ''),
                            'content': item.get('content', ''),
                            'engine': item.get('engine', ''),
                            'category': item.get('category', 'general'),
                            'score': item.get('score', 0),
                            'publishedDate': item.get('publishedDate')
                        })

                    logger.info(f"Search completed: '{query}' - {len(results)} results")

                    return {
                        'success': True,
                        'query': query,
                        'results': results,
                        'number_of_results': data.get('number_of_results', len(results)),
                        'suggestions': data.get('suggestions', [])
                    }

        except asyncio.TimeoutError:
            logger.error(f"Search timeout for query: {query}")
            return {
                'success': False,
                'error': '搜索请求超时，请稍后重试',
                'results': []
            }
        except aiohttp.ClientError as e:
            logger.error(f"Network error during search: {e}")
            return {
                'success': False,
                'error': f'网络错误: {str(e)}',
                'results': []
            }
        except Exception as e:
            logger.error(f"Unexpected error during search: {e}")
            return {
                'success': False,
                'error': f'搜索失败: {str(e)}',
                'results': []
            }

    async def search_with_ai_summary(self, query: str) -> Dict:
        """
        执行搜索并准备AI总结

        这个方法可以被AI模型使用来获取搜索结果并生成摘要
        """
        results = await self.search(query)

        if not results['success']:
            return results

        # 准备AI摘要的上下文
        context = []
        for idx, item in enumerate(results['results'][:5], 1):  # 只取前5条结果
            context.append(f"{idx}. {item['title']}\n{item['content']}\nURL: {item['url']}\n")

        results['ai_context'] = '\n'.join(context)
        return results


# 创建全局实例
_searxng_client = None

def get_searxng_client(base_url: str = None) -> SearXNGClient:
    """获取 SearXNG 客户端实例（单例模式）"""
    global _searxng_client
    if _searxng_client is None:
        # 优先使用传入的 base_url，否则从配置读取
        if base_url is None:
            config = get_config()
            if config.searxng.enabled:
                base_url = config.searxng.url
            else:
                raise Exception("SearXNG 功能已禁用，请在设置中启用")
        _searxng_client = SearXNGClient(base_url)
    return _searxng_client
