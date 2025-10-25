import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'providers.db')

def get_db_connection() -> sqlite3.Connection:
    """建立并返回数据库连接。"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_database():
    """初始化数据库，如果表不存在则创建。"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='providers'")
        if not cursor.fetchone():
            cursor.execute('''
                CREATE TABLE providers (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    type TEXT NOT NULL,
                    api_key TEXT NOT NULL,
                    api_base TEXT,
                    models TEXT NOT NULL
                )
            ''')
            conn.commit()

def get_all_providers() -> List[Dict[str, Any]]:
    """获取所有服务商列表，并进行安全处理和数据重构以适应前端。"""
    with get_db_connection() as conn:
        providers_raw = conn.execute('SELECT * FROM providers ORDER BY name').fetchall()
        results = []
        for row in providers_raw:
            provider_dict = dict(row)
            # 契约字段: 为前端保留原始的'models'字符串
            provider_dict['original_models'] = provider_dict['models']
            
            # 安全处理: 掩码API Key
            original_key = provider_dict.get('api_key', '')
            if len(original_key) > 8:
                provider_dict['api_key'] = f"{original_key[:5]}...{original_key[-4:]}"
            else:
                provider_dict['api_key'] = '********'
            
            results.append(provider_dict)
        return results

def get_provider_by_name(name: str) -> Optional[Dict[str, Any]]:
    """通过名称获取单个服务商的完整信息（内部使用，包含完整API Key）。"""
    with get_db_connection() as conn:
        provider = conn.execute('SELECT * FROM providers WHERE name = ?', (name,)).fetchone()
        return dict(provider) if provider else None

def add_provider(provider_data: Dict[str, Any]):
    """向数据库添加一个新的服务商。"""
    with get_db_connection() as conn:
        conn.execute('INSERT INTO providers (name, type, api_key, api_base, models) VALUES (?, ?, ?, ?, ?)',
                     (provider_data['name'], provider_data['type'], provider_data['api_key'], 
                      provider_data.get('api_base', ''), provider_data['models']))
        conn.commit()

def update_provider(original_name: str, provider_data: Dict[str, Any]) -> bool:
    """更新一个已有的服务商。如果提供了新的api_key则更新，否则保持原有。"""
    with get_db_connection() as conn:
        if provider_data.get('api_key'):  # 如果传入了新的、非空的api_key
            result = conn.execute('UPDATE providers SET type = ?, api_key = ?, api_base = ?, models = ? WHERE name = ?',
                                (provider_data['type'], provider_data['api_key'], 
                                 provider_data.get('api_base', ''), provider_data['models'], original_name)).rowcount > 0
        else:  # 否则，不更新api_key
            result = conn.execute('UPDATE providers SET type = ?, api_base = ?, models = ? WHERE name = ?',
                                (provider_data['type'], provider_data.get('api_base', ''), 
                                 provider_data['models'], original_name)).rowcount > 0
        conn.commit()
        return result

def delete_provider(name: str) -> bool:
    """从数据库删除一个服务商。"""
    with get_db_connection() as conn:
        result = conn.execute('DELETE FROM providers WHERE name = ?', (name,)).rowcount > 0
        conn.commit()
        return result

