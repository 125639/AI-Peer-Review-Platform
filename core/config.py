"""配置管理"""
import os
import json
from typing import Optional

import dataclasses

@dataclasses.dataclass
class ServerConfig:
    host: str = '0.0.0.0'
    port: int = 8000
    reload: bool = False
    log_level: str = 'info'

@dataclasses.dataclass
class ProxyConfig:
    enabled: bool = False
    type: str = 'http'  # http, socks5
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None

@dataclasses.dataclass
class SearXNGConfig:
    url: str = 'https://searx.be'
    enabled: bool = True

@dataclasses.dataclass
class BrowserSearchConfig:
    enabled: bool = True
    max_pages: int = 3
    max_chars: int = 2000
    timeout_ms: int = 15000
    user_agent: Optional[str] = None

@dataclasses.dataclass
class AppConfig:
    server: ServerConfig
    proxy: ProxyConfig
    searxng: SearXNGConfig
    browser: BrowserSearchConfig

_config: Optional[AppConfig] = None

def get_config() -> AppConfig:
    global _config
    if _config is None:
        server_config = ServerConfig(
            host=os.getenv('SERVER_HOST', '0.0.0.0'),
            port=int(os.getenv('SERVER_PORT', '8000')),
            reload=os.getenv('SERVER_RELOAD', 'False').lower() == 'true',
            log_level=os.getenv('LOG_LEVEL', 'info')
        )

        proxy_port = os.getenv('PROXY_PORT')
        proxy_config = ProxyConfig(
            enabled=os.getenv('PROXY_ENABLED', 'False').lower() == 'true',
            type=os.getenv('PROXY_TYPE', 'http'),
            host=os.getenv('PROXY_HOST'),
            port=int(proxy_port) if proxy_port else None,
            username=os.getenv('PROXY_USERNAME'),
            password=os.getenv('PROXY_PASSWORD')
        )
        
        # 尝试从 JSON 文件读取 SearXNG 配置
        searxng_url = os.getenv('SEARXNG_URL', 'https://searx.be')
        searxng_enabled = os.getenv('SEARXNG_ENABLED', 'True').lower() == 'true'
        
        config_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'searxng_config.json')
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    searxng_data = json.load(f)
                    searxng_url = searxng_data.get('url', searxng_url)
                    searxng_enabled = searxng_data.get('enabled', searxng_enabled)
            except Exception:
                pass  # 如果读取失败，使用默认值
        
        searxng_config = SearXNGConfig(
            url=searxng_url,
            enabled=searxng_enabled
        )

        browser_config = BrowserSearchConfig(
            enabled=os.getenv('BROWSER_SEARCH_ENABLED', 'True').lower() == 'true',
            max_pages=int(os.getenv('BROWSER_SEARCH_MAX_PAGES', '3') or 3),
            max_chars=int(os.getenv('BROWSER_SEARCH_MAX_CHARS', '2000') or 2000),
            timeout_ms=int(os.getenv('BROWSER_SEARCH_TIMEOUT_MS', '15000') or 15000),
            user_agent=os.getenv('BROWSER_SEARCH_USER_AGENT')
        )
        
        _config = AppConfig(
            server=server_config,
            proxy=proxy_config,
            searxng=searxng_config,
            browser=browser_config
        )
    return _config
