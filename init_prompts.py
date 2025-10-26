"""
初始化或重置数据库
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'providers.db')

def init_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 创建提示词表（如果不存在）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            critique_prompt TEXT NOT NULL,
            revision_prompt TEXT NOT NULL,
            is_active INTEGER DEFAULT 0
        )
    ''')
    
    # 检查是否已有默认提示词
    cursor.execute("SELECT COUNT(*) FROM prompts WHERE name = '默认提示词'")
    count = cursor.fetchone()[0]
    
    # 新的评审提示词
    new_critique_prompt = '''你是一位专业的同行评审专家。请严格按照以下格式评审答案，确保包含所有必需项。

【评审任务】
问题: {question}
被评审模型: {target}
被评审答案: {answer}

【评分标准】(每项0-3分，必须给出)
1. 准确性: 3=完全准确 2=基本准确 1=有错误 0=严重错误
2. 完整性: 3=全面覆盖 2=略有遗漏 1=明显不足 0=严重不完整
3. 清晰性: 3=清晰明了 2=基本清晰 1=表达混乱 0=难以理解
4. 实用性: 3=非常实用 2=有帮助 1=缺乏实操性 0=无用

【输出格式】(严格按照此格式，不要遗漏任何一项)
准确性: [0-3的数字]
完整性: [0-3的数字]
清晰性: [0-3的数字]
实用性: [0-3的数字]
总分: [四项得分之和，0-12]
评语: [必须提供至少50字的详细评语，包括：1)具体指出优点 2)明确指出缺陷 3)提供改进建议]

重要提示：评语部分必须详细具体，不能只说"很好"或"需要改进"，要给出可操作的建议。'''

    revision_prompt = '''根据评审意见改进以下答案，只输出改进后的完整答案。

原答案:
{original}

评审意见:
{feedback}

改进要求: 针对性修复缺陷，补充遗漏内容，优化表达，增加实用性。
输出改进后的答案:'''
    
    if count == 0:
        # 插入新的默认提示词
        cursor.execute('''
            INSERT INTO prompts (name, critique_prompt, revision_prompt, is_active)
            VALUES (?, ?, ?, ?)
        ''', ('默认提示词', new_critique_prompt, revision_prompt, 1))
        print("✅ 已创建新的默认提示词")
    else:
        # 更新现有的默认提示词
        cursor.execute('''
            UPDATE prompts 
            SET critique_prompt = ?, revision_prompt = ?
            WHERE name = '默认提示词'
        ''', (new_critique_prompt, revision_prompt))
        print("✅ 已更新默认提示词")
    
    conn.commit()
    conn.close()
    print("✅ 数据库初始化完成！")

if __name__ == '__main__':
    init_database()
