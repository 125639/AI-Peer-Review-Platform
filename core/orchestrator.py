import asyncio
import re
from typing import List, Dict, Any, AsyncGenerator, Optional
from .models import create_model_instance
import core.database as db

class Orchestrator:
    async def process_query_stream(self, user_question: str, selected_models: List[str], 
                                   history: List[Dict[str, str]], ocr_text: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        yield {"type": "status", "data": "正在初始化模型..."}
        
        active_models = []
        for sm_id in selected_models:
            parts = sm_id.split('::', 1)
            if len(parts) != 2:
                continue
            provider_name, model_name = parts
            provider_config = db.get_provider_by_name(provider_name)
            if provider_config:
                if instance := create_model_instance(provider_config, model_name):
                    active_models.append(instance)
        
        if not active_models:
            yield {"type": "error", "data": "没有可用的模型"}
            return
        
        # 如果有OCR文本，将其与用户问题合并，作为更丰富的上下文
        if ocr_text and ocr_text.strip():
            combined_question = (
                f"以下是图片识别得到的文字内容：\n{ocr_text.strip()}\n\n"
                f"请结合以上识别文本回答：{user_question}"
            )
        else:
            combined_question = user_question

        messages = history + [{"role": "user", "content": combined_question}]
        
        yield {"type": "status", "data": "第一轮：生成初始答案..."}
        
        initial_answers = {}
        results = await asyncio.gather(*[model.generate(messages) for model in active_models], return_exceptions=True)
        
        for model, result in zip(active_models, results):
            initial_answers[model.name] = f"[失败: {result}]" if isinstance(result, Exception) else result
            yield {"type": "initial_answer_complete", "model_name": model.name, "answer": initial_answers[model.name]}
        
        if len(active_models) == 1:
            single_model_name = active_models[0].name
            yield {
                "type": "final_result",
                "data": {
                    "best_answer": initial_answers[single_model_name],
                    "process_details": [{
                        "model_name": single_model_name,
                        "initial_answer": initial_answers[single_model_name],
                        "critiques_received": [],
                        "revised_answer": initial_answers[single_model_name],
                        "total_score": 0
                    }]
                }
            }
            return
        
        yield {"type": "status", "data": "第二轮：互相评审..."}
        
        critiques = {m.name: [] for m in active_models}
        critique_tasks = [
            (critic.name, target.name, self._generate_critique(critic, target.name, user_question, initial_answers.get(target.name, "")))
            for critic in active_models for target in active_models if critic.name != target.name
        ]
        
        results = await asyncio.gather(*[task for _, _, task in critique_tasks], return_exceptions=True)
        
        for (critic_name, target_name, _), result in zip(critique_tasks, results):
            if not isinstance(result, Exception):
                critique_text, parsed = result
                critiques[target_name].append(parsed)
                yield {
                    "type": "critique_complete",
                    "critic_name": critic_name,
                    "target_model": target_name,
                    "critique_text": critique_text,
                    "critique_data": parsed
                }
        
        yield {"type": "status", "data": "第三轮：改进答案..."}
        
        revised_answers = {}
        revision_tasks = [
            (model.name, self._generate_revision(model, initial_answers.get(model.name, ""), critiques.get(model.name, [])))
            for model in active_models if critiques.get(model.name)
        ]
        
        if revision_tasks:
            results = await asyncio.gather(*[task for _, task in revision_tasks], return_exceptions=True)
            for (model_name, _), result in zip(revision_tasks, results):
                revised_answers[model_name] = initial_answers.get(model_name, "") if isinstance(result, Exception) else result
                yield {"type": "revision_complete", "model_name": model_name, "revised_answer": revised_answers[model_name]}
        
        for model in active_models:
            if model.name not in revised_answers:
                revised_answers[model.name] = initial_answers.get(model.name, "")
        
        yield {"type": "status", "data": "最终决策..."}
        best_answer, details = self._make_final_decision(initial_answers, critiques, revised_answers)
        yield {"type": "final_result", "data": {"best_answer": best_answer, "process_details": details}}
    
    async def _generate_critique(self, critic_model, target_name: str, question: str, answer: str) -> tuple:
        active_prompt = db.get_active_prompt()
        prompt = self._build_critique_prompt(question, target_name, answer, active_prompt)

        attempts = 0
        max_attempts = 3
        critique_text = ""
        parsed = {}

        while attempts < max_attempts:
            attempts += 1

            # 首次尝试使用原始提示词，后续尝试在提示词中追加纠正说明
            if attempts == 1:
                current_prompt = prompt
            else:
                current_prompt = self._build_retry_prompt(
                    question=question,
                    target=target_name,
                    answer=answer,
                    previous_output=critique_text,
                    missing_fields=parsed.get("missing_fields", []),
                    attempt=attempts
                )

            critique_text = await critic_model.generate([
                {"role": "user", "content": current_prompt}
            ])

            parsed = self._parse_critique(critique_text, critic_model.name)

            if not parsed.get("missing_fields") and parsed.get("comment"):
                break

        if parsed.get("missing_fields"):
            missing_display = "、".join(parsed["missing_fields"])
            print(
                f"⚠️ {critic_model.name} 在 {attempts} 次尝试后仍缺少字段: {missing_display}. "
                "将使用当前解析结果继续流程。"
            )

        return (critique_text, parsed)
    
    async def _generate_revision(self, model, original: str, critiques: List[Dict]) -> str:
        active_prompt = db.get_active_prompt()
        prompt = self._build_revision_prompt(original, critiques, active_prompt)
        return await model.generate([{"role": "user", "content": prompt}])
    
    def _make_final_decision(self, initial: Dict, critiques: Dict, revised: Dict):
        scores = {}
        for name, clist in critiques.items():
            # 过滤掉无效的、带有错误的评审
            valid_critiques = [c for c in clist if not c.get("error")]
            if valid_critiques:
                scores[name] = sum(c.get('score', 0) for c in valid_critiques) / len(valid_critiques)
            else:
                scores[name] = 0
        
        results = [
            {
                "model_name": name,
                "initial_answer": initial.get(name, ""),
                "critiques_received": critiques.get(name, []),
                "revised_answer": revised.get(name, initial.get(name, "")),
                "total_score": scores.get(name, 0)
            }
            for name in initial.keys()
        ]
        
        results.sort(key=lambda x: x['total_score'], reverse=True)
        best_answer = results[0].get('revised_answer', '') if results else "无结果"
        return best_answer, results
    
    def _build_critique_prompt(self, question: str, target: str, answer: str, prompt_template: Optional[Dict] = None) -> str:
        if prompt_template and prompt_template.get('critique_prompt'):
            template = prompt_template['critique_prompt']
            return template.format(question=question, target=target, answer=answer)
        # 默认提示词
        return f"""你是一位专业的同行评审专家。【重要：必须严格按照指定格式输出，否则评审无效】

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
- 必须给出具体的改进建议"""

    def _build_retry_prompt(
        self,
        question: str,
        target: str,
        answer: str,
        previous_output: str,
        missing_fields: List[str],
        attempt: int
    ) -> str:
        """在评审输出缺少评分字段时，构造补救提示词重新请求模型输出。"""

        missing_map = {
            "accuracy": "准确性",
            "completeness": "完整性",
            "clarity": "清晰性",
            "usefulness": "实用性",
            "total": "总分",
            "comment": "评语"
        }

        missing_display = "、".join(missing_map.get(field, field) for field in missing_fields)
        base_prompt = self._build_critique_prompt(question, target, answer, db.get_active_prompt())

        retry_instruction = (
            f"⚠️ 第 {attempt} 次尝试：你之前的回答缺少以下字段: {missing_display}。"
            "请严格按照格式重新给出评审结果。务必使用阿拉伯数字 (0-3) 填写每一项，并提供不少于50字的评语。"
            "不要复述上次的答案，也不要加入任何说明性文字。直接输出格式化结果。"
        )

        return (
            f"{retry_instruction}\n\n"
            f"供你参考的上一轮回答如下（仅供纠正，切勿照搬）：\n{previous_output}\n\n"
            f"以下是需要重新评审的任务说明：\n{base_prompt}"
        )
    
    def _build_revision_prompt(self, original: str, critiques: List[Dict], prompt_template: Optional[Dict] = None) -> str:
        feedback = "\n".join([
            f"评审员 {c.get('critic_name', 'N/A')}: {c.get('score', 0)}/12分 "
            f"(准确{c.get('accuracy', 0)} 完整{c.get('completeness', 0)} "
            f"清晰{c.get('clarity', 0)} 实用{c.get('usefulness', 0)}) - {c.get('comment', 'N/A')}"
            for c in critiques
        ])
        
        if prompt_template and prompt_template.get('revision_prompt'):
            template = prompt_template['revision_prompt']
            return template.format(original=original, feedback=feedback)
        # 默认提示词
        return f"""根据评审意见改进以下答案，只输出改进后的完整答案。

原答案:
{original}

评审意见:
{feedback}

改进要求: 针对性修复缺陷，补充遗漏内容，优化表达，增加实用性。
输出改进后的答案:"""
    
    def _parse_critique(self, text: str, critic_name: str) -> Dict:
        # 检查是否为模型返回的错误信息
        if text.strip().startswith("[Error:") or "Error code:" in text:
            print(f"\n{'='*60}")
            print(f"🔍 解析 {critic_name} 的评审输出")
            print(f"{'='*60}")
            preview = text if len(text) < 800 else text[:800] + "..."
            print(f"原始文本 ({len(text)} 字符):\n{preview}")
            print(f"{'='*60}\n")
            print(f"⚠️ 检测到模型返回错误，该次评审将被忽略。")
            print(f"{'='*60}\n")
            return {
                "critic_name": critic_name,
                "error": True,
                "raw_text": text,
                "comment": f"模型返回错误: {text}",
                "score": 0, "accuracy": 0, "completeness": 0, "clarity": 0, "usefulness": 0
            }

        data = {
            "critic_name": critic_name,
            "accuracy": 0,
            "completeness": 0,
            "clarity": 0,
            "usefulness": 0,
            "score": 0,
            "comment": "",
            "missing_fields": [],
            "raw_text": text
        }

        print(f"\n{'='*60}")
        print(f"🔍 解析 {critic_name} 的评审输出")
        print(f"{'='*60}")
        preview = text if len(text) < 800 else text[:800] + "..."
        print(f"原始文本 ({len(text)} 字符):\n{preview}")
        print(f"{'='*60}\n")

        field_patterns = [
            ("accuracy", [r"准确性\s*[:：]\s*(\d+)", r"准确性\s*(\d+)", r"accuracy\s*[:：]?\s*(\d+)"]),
            ("completeness", [r"完整性\s*[:：]\s*(\d+)", r"完整性\s*(\d+)", r"completeness\s*[:：]?\s*(\d+)"]),
            ("clarity", [r"清晰性\s*[:：]\s*(\d+)", r"清晰性\s*(\d+)", r"clarity\s*[:：]?\s*(\d+)"]),
            ("usefulness", [r"实用性\s*[:：]\s*(\d+)", r"实用性\s*(\d+)", r"usefulness\s*[:：]?\s*(\d+)"])
        ]

        for field, patterns in field_patterns:
            found = False
            for pattern in patterns:
                if match := re.search(pattern, text, re.I):
                    data[field] = min(3, int(match.group(1)))
                    found = True
                    print(f"✓ 找到{field}: {data[field]}")
                    break
            if not found:
                data["missing_fields"].append(field)
                print(f"✗ 未找到{field}评分")

        total_patterns = [r"总分\s*[:：]\s*(\d+)", r"总分\s*(\d+)", r"total\s*[:：]?\s*(\d+)"]
        total_found = False
        for pattern in total_patterns:
            if match := re.search(pattern, text, re.I):
                data["score"] = min(12, int(match.group(1)))
                total_found = True
                print(f"✓ 找到总分: {data['score']}")
                break

        if not total_found:
            data["score"] = data["accuracy"] + data["completeness"] + data["clarity"] + data["usefulness"]
            if 0 < data["score"] <= 12:
                print(
                    f"✓ 计算总分: {data['score']} = {data['accuracy']}+{data['completeness']}+"
                    f"{data['clarity']}+{data['usefulness']}"
                )
            else:
                data["missing_fields"].append("total")
                print("✗ 无法确认总分")
        
        # 提取评语 - 多种模式尝试
        comment_found = False
        
        # 模式1: 标准的"评语:"格式
        if comment := re.search(r"评语\s*[:：]\s*(.*?)(?:\n\n|\n(?:准确性|完整性|清晰性|实用性|总分)|$)", text, re.I | re.DOTALL):
            comment_text = comment.group(1).strip()
            if comment_text and len(comment_text) > 5:  # 确保有实质内容
                data["comment"] = comment_text
                comment_found = True
        
        # 模式2: 查找"建议"、"改进"、"缺陷"等关键词段落
        if not comment_found:
            keywords = [r"建议[:：]?(.*?)(?:\n\n|$)", r"改进[:：]?(.*?)(?:\n\n|$)", 
                       r"缺陷[:：]?(.*?)(?:\n\n|$)", r"问题[:：]?(.*?)(?:\n\n|$)"]
            for pattern in keywords:
                if match := re.search(pattern, text, re.I | re.DOTALL):
                    comment_text = match.group(1).strip()
                    if comment_text and len(comment_text) > 5:
                        data["comment"] = comment_text
                        comment_found = True
                        break
        
        # 模式3: 如果前面都没有找到，尝试提取总分之后的内容
        if not comment_found:
            if after_score := re.search(r"总分\s*[:：]\s*\d+\s*\n+(.*)", text, re.I | re.DOTALL):
                comment_text = after_score.group(1).strip()
                # 移除可能的多余换行和空格
                comment_text = re.sub(r'\n{3,}', '\n\n', comment_text)
                if comment_text and len(comment_text) > 10:
                    data["comment"] = comment_text
                    comment_found = True
        
        # 模式4: 如果还是没有，提取所有评分之后的文本
        if not comment_found:
            # 找到最后一个评分项之后的内容
            last_score_pos = 0
            for pattern in [r"准确性\s*[:：]\s*\d+", r"完整性\s*[:：]\s*\d+", 
                           r"清晰性\s*[:：]\s*\d+", r"实用性\s*[:：]\s*\d+", r"总分\s*[:：]\s*\d+"]:
                if match := re.search(pattern, text, re.I):
                    last_score_pos = max(last_score_pos, match.end())
            
            if last_score_pos > 0:
                remaining_text = text[last_score_pos:].strip()
                # 移除"评语:"标签（如果有）
                remaining_text = re.sub(r'^评语\s*[:：]\s*', '', remaining_text, flags=re.I)
                if remaining_text and len(remaining_text) > 10:
                    data["comment"] = remaining_text
                    comment_found = True
        
        # 如果所有模式都失败了，使用整个文本作为评语（但排除评分行）
        if not comment_found or not data["comment"]:
            # 移除所有评分行
            cleaned_text = re.sub(r'(准确性|完整性|清晰性|实用性|总分)\s*[:：]\s*\d+\s*\n?', '', text, flags=re.I)
            cleaned_text = cleaned_text.strip()
            if cleaned_text and len(cleaned_text) > 15:
                data["comment"] = cleaned_text
            else:
                data["comment"] = f"模型 {critic_name} 未按要求提供详细评语。"
                data["missing_fields"].append("comment")

        print(
            f"\n最终评分: 准确{data['accuracy']} 完整{data['completeness']} "
            f"清晰{data['clarity']} 实用{data['usefulness']} = {data['score']}/12"
        )
        if data.get("missing_fields"):
            print(f"⚠️ 缺少字段: {data['missing_fields']}")
        print(f"{'='*60}\n")
        
        return data


