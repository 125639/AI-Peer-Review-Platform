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
            '严格差异化评分标准',
            '''你是一位严格、挑剔的同行评审专家。【重要：必须严格按照指定格式输出，否则评审无效】

【评审任务】
问题: {question}
被评审模型: {target}
被评审答案: {answer}

【评分标准 - 严格标准，需要明确证据才能得分】

准确性 (满分3分)：
  3分: 完全准确，无任何事实错误，使用了准确的专业术语
  2分: 基本准确，但有1-2处可能需要验证的地方 或 用词不够精确  
  1分: 有明显错误或混淆，至少1个关键事实错误
  0分: 多个严重错误或完全错误

完整性 (满分3分)：
  3分: 覆盖了所有关键点，层层递进，系统全面，处理了各种情况
  2分: 覆盖了大部分关键点，但至少遗漏了1个重要方面 或 层次不够深入
  1分: 仅覆盖了部分要点，明显缺少多个重要内容
  0分: 内容极度不完整，基本无法解答问题

清晰性 (满分3分)：
  3分: 逻辑清晰，结构明确，易于理解，使用了恰当的例子或类比
  2分: 基本清晰，但某些部分表述不够直接 或 缺少具体例子
  1分: 表述混乱，逻辑不清，需要重新整理才能理解
  0分: 难以理解，完全无逻辑

实用性 (满分3分)：
  3分: 可直接应用，包含具体步骤/代码/方法，用户可立即行动
  2分: 有一定实用性，但缺少具体步骤 或 需要进一步具体化
  1分: 理论多但缺乏可操作性，用户不知道如何使用
  0分: 完全不实用，无法应用

【输出格式 - 必须严格遵守】
请直接输出以下格式，不要添加任何前缀、标题或额外内容：

准确性: [写0或1或2或3]
完整性: [写0或1或2或3]
清晰性: [写0或1或2或3]
实用性: [写0或1或2或3]
总分: [四项得分相加，0-12之间]
评语: [至少100字的详细评语，必须具体说明：1)最大优点（说明为什么得这个分）2)主要缺陷（列举具体问题）3)改进建议（如何改进）]

【评分指南 - 确保区分度】
- 9-12分: 优秀答案，几乎无缺陷或只有微不足道的小问题
- 7-8分: 良好答案，有1-2个明显但可接受的缺陷
- 5-6分: 中等答案，有多个明显缺陷但整体可用
- 3-4分: 较差答案，存在较多严重缺陷，需要显著改进
- 0-2分: 很差的答案，基本不适合用户，严重缺陷

【示例输出】
准确性: 2
完整性: 2
清晰性: 3
实用性: 1
总分: 8
评语: 优点：该答案对核心概念的解释基本准确，术语使用相对恰当。表达结构清晰，分点明确，易于理解。缺陷：完整性不足——虽然解释了核心定义，但遗漏了对重要应用场景的讨论，这是用户经常需要了解的。最严重的缺点是实用性严重不足——只有理论解释而完全没有实际操作步骤或代码示例，用户无法将理论转化为实践。改进建议：补充至少3-5个实际应用案例，添加详细的使用步骤和代码示例，介绍常见的陷阱和最佳实践。

【警告和要求】
- 不要输出任何其他格式或多余内容
- 必须给出具体、可检验的理由，说明扣分原因
- 不要一开始就给满分，除非答案确实非常完美
- 评语必须有具体例子或引用，不能是空洞的表扬或模糊的批评
- 必须严格按照分数范围来评分，有明确缺陷就不能是3分
- 如果模型表现很好（如9-12分），要诚实给高分；如果有缺陷（如5-8分），不要勉强给9分''',
            '根据评审意见改进以下答案，只输出改进后的完整答案，不要添加任何解释。\n\n原答案:\n{original}\n\n评审意见:\n{feedback}\n\n改进要求：针对评审指出的具体缺陷进行修正，补充遗漏的内容，优化表达和逻辑，显著增加实用性。必须体现出明确的改进。',
            'Strict Differentiated Scoring Standards',
            '''You are a strict and critical peer reviewer. [IMPORTANT: Your output MUST strictly follow the specified format or it will be considered invalid.]

[Review Task]
Question: {question}
Model Under Review: {target}
Answer Under Review: {answer}

[Scoring Criteria - Strict standards, clear evidence needed for each score]

Accuracy (Max 3 points):
  3 points: Completely accurate, no factual errors, proper professional terminology used
  2 points: Mostly accurate, but has 1-2 items requiring verification OR imprecise wording
  1 point: Obvious errors or confusion, at least 1 critical factual error
  0 points: Multiple serious errors or completely wrong

Completeness (Max 3 points):
  3 points: Covers all key points comprehensively, logical progression, systematic, handles various cases
  2 points: Covers most key points, but missing at least 1 important aspect OR lacks depth
  1 point: Only covers partial points, obviously missing multiple important contents
  0 points: Extremely incomplete, basically cannot answer the question

Clarity (Max 3 points):
  3 points: Clear logic, obvious structure, easy to understand, uses appropriate examples or analogies
  2 points: Generally clear, but some parts unclear OR lacking concrete examples
  1 point: Confusing expression, unclear logic, needs restructuring to understand
  0 points: Hard to understand, completely illogical

Usefulness (Max 3 points):
  3 points: Directly applicable, contains specific steps/code/methods, users can act immediately
  2 points: Some usefulness, but lacking specific steps OR needs further specification
  1 point: Theory-heavy but lacks actionability, users don't know how to apply
  0 points: Completely not useful, cannot be applied

[Output Format - MUST strictly follow]
Output ONLY the following format, do not add any prefix, headings or extra notes:

Accuracy: [0 or 1 or 2 or 3]
Completeness: [0 or 1 or 2 or 3]
Clarity: [0 or 1 or 2 or 3]
Usefulness: [0 or 1 or 2 or 3]
Total Score: [Sum of four above, 0-12]
Comment: [At least 100 words, specifically stating: 1) Greatest strength (explain why this score) 2) Main defects (list specific issues) 3) Improvement suggestions (how to improve)]

[Scoring Guide - Ensure differentiation]
- 9-12 points: Excellent answer, almost flawless or only trivial issues
- 7-8 points: Good answer, has 1-2 obvious but acceptable defects
- 5-6 points: Average answer, has multiple obvious defects but usable
- 3-4 points: Poor answer, many serious defects, needs significant improvement
- 0-2 points: Very poor answer, basically unsuitable for users, severe defects

[Example Output]
Accuracy: 2
Completeness: 2
Clarity: 3
Usefulness: 1
Total Score: 8
Comment: Strengths: The answer's explanation of core concepts is mostly accurate with appropriate terminology. The structure is clear with well-organized points, easy to follow. Weaknesses: Completeness is insufficient—while it explains core definitions, it omits discussion of important application scenarios that users often need to understand. Most critically, usefulness is severely lacking—it provides only theoretical explanation with absolutely no practical operational steps or code examples, making it impossible for users to convert theory into practice. Improvement suggestions: Add at least 3-5 real-world application cases, include detailed usage steps and code examples, discuss common pitfalls and best practices.

[Warnings and Requirements]
- Do NOT output any other format or extra content
- MUST provide specific, verifiable reasons and explain why points are deducted
- Do NOT automatically give perfect scores unless the answer is truly excellent
- Comments MUST include specific examples or quotations, not vague praise or fuzzy criticism
- MUST strictly follow score ranges—obvious defects mean no 3-point score
- If model performs very well (9-12 points), honestly give high scores; if there are defects (5-8 points), don't force a 9-point score''',
            'Revise the answer below based on the specific review feedback, output ONLY the revised answer with clear improvements. Do not add explanations.\n\n Original Answer:\n{original}\n\nReview Feedback:\n{feedback}\n\nRevision Requirements: Directly fix the specific defects pointed out in the review, supplement all missing content, optimize expression and logic, and significantly increase usefulness. The improvement must be clearly evident.',
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
        # 获取当前记录以保留未更新的字段
        current = conn.execute('SELECT * FROM providers WHERE name = ?', (original_name,)).fetchone()
        if not current:
            return False
        
        # 准备更新数据，保留原有值如果新值未提供
        api_base = provider_data.get('api_base', current['api_base'])
        if api_base is None:
            api_base = ''
        
        if provider_data.get('api_key'):
            result = conn.execute(
                'UPDATE providers SET type = ?, api_key = ?, api_base = ?, models = ? WHERE name = ?',
                (provider_data['type'], provider_data['api_key'], 
                 api_base, provider_data['models'], original_name)
            ).rowcount > 0
        else:
            result = conn.execute(
                'UPDATE providers SET type = ?, api_base = ?, models = ? WHERE name = ?',
                (provider_data['type'], api_base, 
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


