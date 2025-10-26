import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'providers.db')

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_database():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS providers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL,
                api_key TEXT NOT NULL,
                api_base TEXT,
                models TEXT NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                critique_prompt TEXT NOT NULL,
                revision_prompt TEXT NOT NULL,
                is_active INTEGER DEFAULT 0
            )
        ''')
        # 插入默认提示词
        conn.execute('''
            INSERT OR IGNORE INTO prompts (name, critique_prompt, revision_prompt, is_active)
            VALUES (?, ?, ?, ?)
        ''', (
            '默认提示词',
            '''你是一位专业的同行评审专家。【重要：必须严格按照指定格式输出，否则评审无效】

【评审任务】
问题: {question}
被评审模型: {target}
被评审答案: {answer}

【评分标准】(每项0-3分)
1. 准确性: 3=完全准确 2=基本准确 1=有错误 0=严重错误
2. 完整性: 3=全面覆盖 2=略有遗漏 1=明显不足 0=严重不完整
3. 清晰性: 3=清晰明了 2=基本清晰 1=表达混乱 0=难以理解
4. 实用性: 3=非常实用 2=有帮助 1=缺乏实操性 0=无用

【输出格式 - 必须严格遵守】
请直接输出以下格式，不要添加任何前缀、标题或额外内容：

准确性: [写0或1或2或3]
完整性: [写0或1或2或3]
清晰性: [写0或1或2或3]
实用性: [写0或1或2或3]
总分: [四项得分相加，0-12之间]
评语: [至少50字的详细评语，必须包括：1)具体优点 2)明确缺陷 3)改进建议]

【示例输出】
准确性: 2
完整性: 2
清晰性: 3
实用性: 1
总分: 8
评语: 该答案准确性较好，基本符合事实。完整性方面略有不足，缺少了对X的讨论。表达清晰易懂。但实用性较差，缺乏具体的操作步骤。建议补充实际案例和详细步骤，增加代码示例。

【警告】
- 不要输出任何其他格式
- 不要省略任何评分项
- 评语不能少于50字
- 必须给出具体的改进建议''',
            '''根据评审意见改进以下答案，只输出改进后的完整答案。

原答案:
{original}

评审意见:
{feedback}

改进要求: 针对性修复缺陷，补充遗漏内容，优化表达，增加实用性。
输出改进后的答案:''',
            1
        ))
        conn.commit()

def get_all_providers() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        providers_raw = conn.execute('SELECT * FROM providers ORDER BY name').fetchall()
        results = []
        for row in providers_raw:
            provider_dict = dict(row)
            provider_dict['original_models'] = provider_dict['models']
            key = provider_dict.get('api_key', '')
            provider_dict['api_key'] = f"{key[:5]}...{key[-4:]}" if len(key) > 8 else '********'
            results.append(provider_dict)
        return results

def get_provider_by_name(name: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        provider = conn.execute('SELECT * FROM providers WHERE name = ?', (name,)).fetchone()
        return dict(provider) if provider else None

def add_provider(provider_data: Dict[str, Any]):
    with get_db_connection() as conn:
        conn.execute('INSERT INTO providers (name, type, api_key, api_base, models) VALUES (?, ?, ?, ?, ?)',
                     (provider_data['name'], provider_data['type'], provider_data['api_key'], 
                      provider_data.get('api_base', ''), provider_data['models']))
        conn.commit()

def update_provider(original_name: str, provider_data: Dict[str, Any]) -> bool:
    with get_db_connection() as conn:
        if provider_data.get('api_key'):
            result = conn.execute('UPDATE providers SET type = ?, api_key = ?, api_base = ?, models = ? WHERE name = ?',
                                (provider_data['type'], provider_data['api_key'], 
                                 provider_data.get('api_base', ''), provider_data['models'], original_name)).rowcount > 0
        else:
            result = conn.execute('UPDATE providers SET type = ?, api_base = ?, models = ? WHERE name = ?',
                                (provider_data['type'], provider_data.get('api_base', ''), 
                                 provider_data['models'], original_name)).rowcount > 0
        conn.commit()
        return result

def delete_provider(name: str) -> bool:
    with get_db_connection() as conn:
        result = conn.execute('DELETE FROM providers WHERE name = ?', (name,)).rowcount > 0
        conn.commit()
        return result

# 提示词管理
def get_all_prompts() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        prompts = conn.execute('SELECT * FROM prompts ORDER BY id').fetchall()
        return [dict(p) for p in prompts]

def get_active_prompt() -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        prompt = conn.execute('SELECT * FROM prompts WHERE is_active = 1 LIMIT 1').fetchone()
        return dict(prompt) if prompt else None

def add_prompt(prompt_data: Dict[str, Any]):
    with get_db_connection() as conn:
        conn.execute('INSERT INTO prompts (name, critique_prompt, revision_prompt, is_active) VALUES (?, ?, ?, ?)',
                     (prompt_data['name'], prompt_data['critique_prompt'], 
                      prompt_data['revision_prompt'], prompt_data.get('is_active', 0)))
        conn.commit()

def update_prompt(prompt_id: int, prompt_data: Dict[str, Any]) -> bool:
    with get_db_connection() as conn:
        result = conn.execute(
            'UPDATE prompts SET name = ?, critique_prompt = ?, revision_prompt = ? WHERE id = ?',
            (prompt_data['name'], prompt_data['critique_prompt'], 
             prompt_data['revision_prompt'], prompt_id)
        ).rowcount > 0
        conn.commit()
        return result

def set_active_prompt(prompt_id: int) -> bool:
    with get_db_connection() as conn:
        conn.execute('UPDATE prompts SET is_active = 0')
        result = conn.execute('UPDATE prompts SET is_active = 1 WHERE id = ?', (prompt_id,)).rowcount > 0
        conn.commit()
        return result

def delete_prompt(prompt_id: int) -> bool:
    with get_db_connection() as conn:
        result = conn.execute('DELETE FROM prompts WHERE id = ?', (prompt_id,)).rowcount > 0
        conn.commit()
        return result


