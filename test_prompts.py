"""
测试提示词管理功能
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_get_prompts():
    """测试获取提示词列表"""
    print("\n=== 测试：获取提示词列表 ===")
    response = requests.get(f"{BASE_URL}/prompts")
    print(f"状态码: {response.status_code}")
    if response.ok:
        prompts = response.json()
        print(f"提示词数量: {len(prompts)}")
        for p in prompts:
            print(f"  - {p['name']} (ID: {p['id']}, 激活: {bool(p['is_active'])})")
    return response.json() if response.ok else []

def test_add_prompt():
    """测试添加新提示词"""
    print("\n=== 测试：添加新提示词 ===")
    new_prompt = {
        "name": "测试提示词",
        "critique_prompt": """请评审以下答案：

问题: {question}
答案: {answer}
来自: {target}

评分 (0-3分):
准确性: [分数]
完整性: [分数]
清晰性: [分数]
实用性: [分数]
总分: [总和]
评语: [评价]""",
        "revision_prompt": """请改进答案：

原答案: {original}
反馈: {feedback}

输出改进后的答案:"""
    }
    
    response = requests.post(
        f"{BASE_URL}/prompts",
        json=new_prompt,
        headers={"Content-Type": "application/json"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    return response.ok

def test_activate_prompt(prompt_id):
    """测试激活提示词"""
    print(f"\n=== 测试：激活提示词 ID={prompt_id} ===")
    response = requests.post(f"{BASE_URL}/prompts/{prompt_id}/activate")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    return response.ok

def test_update_prompt(prompt_id):
    """测试更新提示词"""
    print(f"\n=== 测试：更新提示词 ID={prompt_id} ===")
    update_data = {
        "name": "更新后的测试提示词",
        "critique_prompt": "更新的评审提示词\n问题: {question}\n答案: {answer}\n目标: {target}",
        "revision_prompt": "更新的修订提示词\n原答案: {original}\n反馈: {feedback}"
    }
    
    response = requests.put(
        f"{BASE_URL}/prompts/{prompt_id}",
        json=update_data,
        headers={"Content-Type": "application/json"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    return response.ok

def test_delete_prompt(prompt_id):
    """测试删除提示词"""
    print(f"\n=== 测试：删除提示词 ID={prompt_id} ===")
    response = requests.delete(f"{BASE_URL}/prompts/{prompt_id}")
    print(f"状态码: {response.status_code}")
    if response.ok:
        print(f"响应: {response.json()}")
    else:
        print(f"错误: {response.json()}")
    return response.ok

def main():
    print("开始测试提示词管理API...")
    print("=" * 50)
    
    # 1. 获取初始提示词列表
    initial_prompts = test_get_prompts()
    
    # 2. 添加新提示词
    if test_add_prompt():
        # 3. 再次获取列表，找到新添加的提示词
        prompts = test_get_prompts()
        if len(prompts) > len(initial_prompts):
            new_prompt = prompts[-1]
            new_id = new_prompt['id']
            
            # 4. 更新提示词
            test_update_prompt(new_id)
            
            # 5. 激活提示词
            test_activate_prompt(new_id)
            
            # 6. 验证激活状态
            test_get_prompts()
            
            # 7. 删除测试提示词（清理）
            test_delete_prompt(new_id)
    
    # 8. 最终验证
    test_get_prompts()
    
    print("\n" + "=" * 50)
    print("测试完成！")

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("错误：无法连接到服务器。请确保服务正在运行 (python main.py)")
    except Exception as e:
        print(f"测试过程中出错: {e}")
