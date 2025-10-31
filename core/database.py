import os
import sqlite3
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
                name_zh TEXT NOT NULL,
                critique_prompt_zh TEXT NOT NULL,
                revision_prompt_zh TEXT NOT NULL,
                name_en TEXT NOT NULL,
                critique_prompt_en TEXT NOT NULL,
                revision_prompt_en TEXT NOT NULL,
                is_active INTEGER DEFAULT 0
            )
        ''')
        # 插入默认提示词(中英文)
        conn.execute('''
            INSERT OR IGNORE INTO prompts (id, name_zh, critique_prompt_zh, revision_prompt_zh, name_en, critique_prompt_en, revision_prompt_en, is_active)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            '默认提示词',
            '''你是一位专业的同行评审专家。【重要：必须严格按照指定格式输出，否则评审无效】\n\n【评审任务】\n问题: {question}\n被评审模型: {target}\n被评审答案: {answer}\n\n【评分标准】(每项0-3分)\n1. 准确性: 3=完全准确 2=基本准确 1=有错误 0=严重错误\n2. 完整性: 3=全面覆盖 2=略有遗漏 1=明显不足 0=严重不完整\n3. 清晰性: 3=清晰明了 2=基本清晰 1=表达混乱 0=难以理解\n4. 实用性: 3=非常实用 2=有帮助 1=缺乏实操性 0=无用\n\n【输出格式 - 必须严格遵守】\n请直接输出以下格式，不要添加任何前缀、标题或额外内容：\n\n准确性: [写0或1或2或3]\n完整性: [写0或1或2或3]\n清晰性: [写0或1或2或3]\n实用性: [写0或1或2或3]\n总分: [四项得分相加，0-12之间]\n评语: [至少50字的详细评语，必须包括：1)具体优点 2)明确缺陷 3)改进建议]\n\n【示例输出】\n准确性: 2\n完整性: 2\n清晰性: 3\n实用性: 1\n总分: 8\n评语: 该答案准确性较好，基本符合事实。完整性方面略有不足，缺少了对X的讨论。表达清晰易懂。但实用性较差，缺乏具体的操作步骤。建议补充实际案例和详细步骤，增加代码示例。\n\n【警告】\n- 不要输出任何其他格式\n- 不要省略任何评分项\n- 评语不能少于50字\n- 必须给出具体的改进建议''',
            '根据评审意见改进以下答案，只输出改进后的完整答案。\n\n原答案:\n{original}\n\n评审意见:\n{feedback}\n\n改进要求: 针对性修复缺陷，补充遗漏内容，优化表达，增加实用性。\n输出改进后的答案:',
            'Default Prompt',
            '''You are a professional peer reviewer. [IMPORTANT: Your output must strictly follow the specified format or it will be considered invalid.]\n\n[Review Task]\nQuestion: {question}\nModel Under Review: {target}\nAnswer Under Review: {answer}\n\n[Scoring Criteria] (Each item 0-3 points)\n1. Accuracy: 3=Completely accurate 2=Mostly accurate 1=Some errors 0=Serious errors\n2. Completeness: 3=Fully complete 2=Minor omissions 1=Significant omissions 0=Very incomplete\n3. Clarity: 3=Very clear 2=Generally clear 1=Confusing 0=Unintelligible\n4. Usefulness: 3=Very useful 2=Helpful 1=Lacks actionable value 0=Useless\n\n[Output Format - Must strictly follow]\nDirectly output the following format, do not add any prefix, headings or extra notes:\n\nAccuracy: [0 or 1 or 2 or 3]\nCompleteness: [0 or 1 or 2 or 3]\nClarity: [0 or 1 or 2 or 3]\nUsefulness: [0 or 1 or 2 or 3]\nTotal Score: [Sum of four above, 0-12]\nComment: [At least 50 words, including 1) strengths 2) specific weaknesses 3) suggestions for improvement]\n\n[Example Output]\nAccuracy: 2\nCompleteness: 2\nClarity: 3\nUsefulness: 1\nTotal Score: 8\nComment: The answer is mostly accurate and fact-based. However, it lacks coverage of X, hence completeness is not perfect. The language used is clear and easy to understand. Usefulness is slightly lacking due to missing detailed steps. Suggest adding practical cases and step-by-step guides, with code if possible.\n\n[WARNING]\n- Do NOT output any other format\n- Do NOT omit any score item\n- Comment MUST exceed 50 words\n- You MUST include actionable improvement suggestions.''',
            'Revise the answer below based on the review, output ONLY the improved version.\n\nOriginal Answer:\n{original}\n\nReview Feedback:\n{feedback}\n\nRevision Requirement: Fix all issues, make up for missing content, improve clarity and usefulness.\nOutput the improved answer:',
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
            result = conn.execute(
                'UPDATE providers SET type = ?, api_key = ?, api_base = ?, models = ? WHERE name = ?',
                (provider_data['type'], provider_data['api_key'], 
                 provider_data.get('api_base', ''), provider_data['models'], original_name)
            ).rowcount > 0
        else:
            result = conn.execute(
                'UPDATE providers SET type = ?, api_base = ?, models = ? WHERE name = ?',
                (provider_data['type'], provider_data.get('api_base', ''), 
                 provider_data['models'], original_name)
            ).rowcount > 0
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
        conn.execute(
            'INSERT INTO prompts (name_zh, critique_prompt_zh, revision_prompt_zh, name_en, critique_prompt_en, revision_prompt_en, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (
                prompt_data['name_zh'], prompt_data['critique_prompt_zh'], prompt_data['revision_prompt_zh'],
                prompt_data['name_en'], prompt_data['critique_prompt_en'], prompt_data['revision_prompt_en'],
                prompt_data.get('is_active', 0)
            )
        )
        conn.commit()

def update_prompt(prompt_id: int, prompt_data: Dict[str, Any]) -> bool:
    with get_db_connection() as conn:
        result = conn.execute(
            'UPDATE prompts SET name_zh = ?, critique_prompt_zh = ?, revision_prompt_zh = ?, name_en = ?, critique_prompt_en = ?, revision_prompt_en = ? WHERE id = ?',
            (
                prompt_data['name_zh'], prompt_data['critique_prompt_zh'], prompt_data['revision_prompt_zh'],
                prompt_data['name_en'], prompt_data['critique_prompt_en'], prompt_data['revision_prompt_en'],
                prompt_id
            )
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


