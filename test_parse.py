"""
测试评分解析功能
"""

import re
from typing import Dict

def parse_critique_test(text: str, critic_name: str) -> Dict:
    data = {"critic_name": critic_name, "accuracy": 0, "completeness": 0, "clarity": 0, "usefulness": 0, "score": 0, "comment": ""}
    
    print(f"\n{'='*60}")
    print(f"🔍 测试解析: {critic_name}")
    print(f"{'='*60}")
    print(f"文本:\n{text}\n")
    print(f"{'='*60}\n")
    
    # 提取评分 - 支持多种格式
    if acc := re.search(r"准确性\s*[:：]\s*(\d+)", text, re.I):
        data["accuracy"] = min(3, int(acc.group(1)))
        print(f"✓ 找到准确性: {data['accuracy']}")
    elif acc := re.search(r"准确性\s*(\d+)", text, re.I):
        data["accuracy"] = min(3, int(acc.group(1)))
        print(f"✓ 找到准确性(无冒号): {data['accuracy']}")
    else:
        print(f"✗ 未找到准确性")
    
    if comp := re.search(r"完整性\s*[:：]\s*(\d+)", text, re.I):
        data["completeness"] = min(3, int(comp.group(1)))
        print(f"✓ 找到完整性: {data['completeness']}")
    elif comp := re.search(r"完整性\s*(\d+)", text, re.I):
        data["completeness"] = min(3, int(comp.group(1)))
        print(f"✓ 找到完整性(无冒号): {data['completeness']}")
    else:
        print(f"✗ 未找到完整性")
    
    if clar := re.search(r"清晰性\s*[:：]\s*(\d+)", text, re.I):
        data["clarity"] = min(3, int(clar.group(1)))
        print(f"✓ 找到清晰性: {data['clarity']}")
    elif clar := re.search(r"清晰性\s*(\d+)", text, re.I):
        data["clarity"] = min(3, int(clar.group(1)))
        print(f"✓ 找到清晰性(无冒号): {data['clarity']}")
    else:
        print(f"✗ 未找到清晰性")
    
    if use := re.search(r"实用性\s*[:：]\s*(\d+)", text, re.I):
        data["usefulness"] = min(3, int(use.group(1)))
        print(f"✓ 找到实用性: {data['usefulness']}")
    elif use := re.search(r"实用性\s*(\d+)", text, re.I):
        data["usefulness"] = min(3, int(use.group(1)))
        print(f"✓ 找到实用性(无冒号): {data['usefulness']}")
    else:
        print(f"✗ 未找到实用性")
    
    data["score"] = data["accuracy"] + data["completeness"] + data["clarity"] + data["usefulness"]
    
    print(f"\n结果: 准确{data['accuracy']} 完整{data['completeness']} 清晰{data['clarity']} 实用{data['usefulness']} = {data['score']}/12\n")
    return data


# 测试案例
test_cases = [
    ("标准格式", """准确性: 2
完整性: 1
清晰性: 3
实用性: 2
总分: 8
评语: 这是一个测试"""),
    
    ("无冒号格式", """准确性 2
完整性 1
清晰性 3
实用性 2
总分 8
评语 这是一个测试"""),
    
    ("中文冒号", """准确性：2
完整性：1
清晰性：3
实用性：2
总分：8
评语：这是一个测试"""),
    
    ("gemini可能的格式", """的缺陷，主要集中在'完整性'上。"""),
]

if __name__ == '__main__':
    for name, text in test_cases:
        result = parse_critique_test(text, name)
        print(f"{'='*60}\n")
