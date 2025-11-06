import asyncio
import re
from typing import List, Dict, Any, AsyncGenerator, Optional

from .models import create_model_instance
from .logging import get_logger
import core.database as db

logger = get_logger(__name__)

# 常量定义
MAX_SCORE_PER_FIELD = 3
MAX_TOTAL_SCORE = 12
MIN_COMMENT_LENGTH = 50
MAX_PREVIEW_LENGTH = 800
MIN_COMMENT_PREVIEW = 5
MIN_COMMENT_AFTER_SCORE = 10
MIN_COMMENT_FINAL = 15

DISCLAIMER_PATTERNS = [
    re.compile(r"无法(?:直接)?(?:查看|访问|识别).*?(?:图片|图像)", re.I),
    re.compile(r"看不到这?(?:张)?(?:图片|图像)", re.I),
    re.compile(r"作为.*?(?:文本|language|text).*?(?:模型|ai|model)(?!.*?(?:可以|能够|能|会))", re.I),
    re.compile(r"(?:i am|i'm).*?(?:text[- ]only|language).*?(?:model|ai)", re.I),
    re.compile(r"can't\s*(?:access|see|view).*?(?:image|picture)", re.I),
    re.compile(r"no\s*(?:vision|image\s*capability)", re.I),
    re.compile(r"没有.*?(?:视觉|图像|图片).*?(?:能力|功能)", re.I)
]

class Orchestrator:
    async def process_query_stream(
        self,
        user_question: str,
        selected_models: List[str],
        history: List[Dict[str, str]],
        ocr_text: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        tool_choice: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        yield {"type": "status", "data": "正在初始化模型..."}
        
        active_models = []
        for sm_id in selected_models:
            parts = sm_id.split('::', 1)
            if len(parts) != 2:
                continue
            provider_name, model_name = parts
            provider_config = db.get_provider_by_name(provider_name)
            if provider_config:
                instance = create_model_instance(provider_config, model_name)
                if instance:
                    active_models.append(instance)
        
        if not active_models:
            yield {"type": "error", "data": "没有可用的模型"}
            return
        
        # 如果有OCR文本，将其与用户问题合并，作为更丰富且显式的上下文
        ocr_text_clean = ocr_text.strip() if ocr_text else ""
        user_question_clean = user_question.strip()

        # 如果有工具可用，添加工具使用提示
        tool_hint = ""
        if tools:
            tool_hint = "\n\n【重要提示】如果你需要获取实时信息、最新资讯、事实核查或当前事件，请使用 network_search 工具进行网络搜索。"
        
        if ocr_text_clean:
            combined_question = (
                "【OCR识别文本】\n"
                f"{ocr_text_clean}\n\n"
                "【强制要求】\n"
                "1. 你无法直接查看原图，禁止回复'无法看到图片''我是文本AI'等托辞。\n"
                "2. 必须完全依据上方OCR文字做出专业分析，指出优点、缺陷与改进建议。\n"
                "3. 如OCR文字存在缺漏，请说明缺失信息对判断的影响。\n"
                "4. 结尾至少提出两条具体改进建议。\n"
                f"【用户问题】{user_question_clean or '请基于OCR内容给出详细、严格的专业评估。'}\n"
                f"{tool_hint}"
            )
        else:
            combined_question = (user_question_clean or "请结合已有对话提供回答。") + tool_hint

        messages = history + [{"role": "user", "content": combined_question}]
        
        yield {"type": "status", "data": "第一轮：生成初始答案..."}
        
        initial_answers = {}
        results = await asyncio.gather(
            *[model.generate(messages, tools=tools, tool_choice=tool_choice) for model in active_models],
            return_exceptions=True
        )

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
            (critic.name, target.name, self._generate_critique(
                critic, target.name, combined_question, initial_answers.get(target.name, ""), ocr_text_clean, tools, tool_choice
            ))
            for critic in active_models 
            for target in active_models 
            if critic.name != target.name
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
            (model.name, self._generate_revision(
                model, initial_answers.get(model.name, ""), critiques.get(model.name, []), tools, tool_choice
            ))
            for model in active_models 
            if critiques.get(model.name)
        ]
        
        if revision_tasks:
            results = await asyncio.gather(*[task for _, task in revision_tasks], return_exceptions=True)
            for (model_name, _), result in zip(revision_tasks, results):
                if isinstance(result, Exception):
                    revised_answers[model_name] = initial_answers.get(model_name, "")
                else:
                    revised_answers[model_name] = result
                yield {
                    "type": "revision_complete", 
                    "model_name": model_name, 
                    "revised_answer": revised_answers[model_name]
                }
        
        for model in active_models:
            if model.name not in revised_answers:
                revised_answers[model.name] = initial_answers.get(model.name, "")
        
        yield {"type": "status", "data": "最终决策..."}
        best_answer, details = self._make_final_decision(initial_answers, critiques, revised_answers)
        yield {
            "type": "final_result", 
            "data": {"best_answer": best_answer, "process_details": details}
        }
    
    async def _generate_critique(self, critic_model, target_name: str, question: str, answer: str, ocr_text: str = "", tools: Optional[List[Dict]] = None, tool_choice: Optional[str] = None) -> tuple:
        active_prompt = db.get_active_prompt()
        prompt = self._build_critique_prompt(question, target_name, answer, active_prompt, ocr_text)

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

            critique_text = await critic_model.generate(
                messages=[
                    {"role": "user", "content": current_prompt}
                ],
                tools=tools,
                tool_choice=tool_choice,
            )

            parsed = self._parse_critique(critique_text, critic_model.name)

            if not parsed.get("missing_fields") and parsed.get("comment"):
                break

        if parsed.get("missing_fields"):
            missing_display = "、".join(parsed["missing_fields"])
            logger.warning(
                f"{critic_model.name} 在 {attempts} 次尝试后仍缺少字段: {missing_display}. "
                "将使用当前解析结果继续流程。"
            )

        return (critique_text, parsed)
    
    async def _generate_revision(self, model, original: str, critiques: List[Dict], tools: Optional[List[Dict]] = None, tool_choice: Optional[str] = None) -> str:
        active_prompt = db.get_active_prompt()
        prompt = self._build_revision_prompt(original, critiques, active_prompt)
        return await model.generate([{"role": "user", "content": prompt}], tools=tools, tool_choice=tool_choice)
    
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

        for item in results:
            if self._contains_disclaimer(item.get("revised_answer")) or self._contains_disclaimer(item.get("initial_answer")):
                item["total_score"] = 0.0
                item["disqualified_reason"] = "vision_disclaimer"
            else:
                critic_penalties = [c for c in item.get("critiques_received", []) if c.get("penalty_reason") == "vision_disclaimer"]
                if critic_penalties:
                    item.setdefault("warnings", []).append("critique_disclaimer")
        
        results.sort(key=lambda x: x['total_score'], reverse=True)
        if results:
            best_answer = results[0].get('revised_answer', '')
        else:
            best_answer = "无结果"
        return best_answer, results
    
    def _build_critique_prompt(self, question: str, target: str, answer: str, prompt_template: Optional[Dict] = None, ocr_text: str = "") -> str:
        if prompt_template and prompt_template.get('critique_prompt'):
            template = prompt_template['critique_prompt']
            return template.format(question=question, target=target, answer=answer, ocr_text=ocr_text)
        
        # 默认提示词 - 包含OCR文本上下文
        ocr_section = ""
        if ocr_text:
            ocr_section = f"""【图片内容 (OCR识别)】
{ocr_text}

"""
        
        return f"""你是一位专业的同行评审专家。【重要：必须严格按照指定格式输出，否则评审无效】

【评审背景】
{ocr_section}【评审问题】
{question}

【被评审的答案 (来自 {target})】
{answer}

【评分标准】(每项0-3分，必须严格区分)
1. 准确性: 3=完全准确无误 2=基本准确但有小瑕疵 1=有明显错误 0=严重错误或完全相反
2. 完整性: 3=全面深入，覆盖所有关键点 2=覆盖大部分要点但有遗漏 1=覆盖不足 0=严重不完整
3. 清晰性: 3=表达清晰有条理 2=基本清晰但逻辑稍乱 1=表达不够清楚 0=难以理解
4. 实用性: 3=可直接应用，提供具体方案 2=有帮助但缺乏实操细节 1=理论多实践少 0=无用

【评语要求】(至少80字，必须具体指向答案内容)
- 不要使用通用表述，必须针对该答案的具体内容
- 指出具体的好处 (如："答案准确指出了...")
- 指出具体的问题 (如："答案遗漏了..." 或 "答案错误地说...")
- 给出具体的改进建议 (如："可以补充..." 或 "应该修正...")
- 如有OCR文本，务必参考其内容进行评价

【输出格式 - 必须严格遵守，不要添加任何其他内容】
准确性: [0-3]
完整性: [0-3]
清晰性: [0-3]
实用性: [0-3]
总分: [0-12]
评语: [80字以上的具体评语]

【格式示例】
准确性: 2
完整性: 1
清晰性: 2
实用性: 3
总分: 8
评语: 该答案准确地指出了OCR文本中的关键词"design"，但完整性不足，遗漏了对"layout"的分析。表达基本清晰。实用性较好，提供了可行的改进方向。建议补充对"color harmony"的讨论，并提供具体的设计工具或参考资源。"""

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
    
    def _contains_disclaimer(self, text: Optional[str]) -> bool:
        if not text:
            return False
        for pattern in DISCLAIMER_PATTERNS:
            if pattern.search(text):
                return True
        return False

    def _parse_critique(self, text: str, critic_name: str) -> Dict:
        # 检查是否为模型返回的错误信息
        if text.strip().startswith("[Error:") or "Error code:" in text:
            logger.error(f"解析 {critic_name} 的评审输出时检测到模型返回错误")
            preview = text if len(text) < MAX_PREVIEW_LENGTH else text[:MAX_PREVIEW_LENGTH] + "..."
            logger.debug(f"原始文本 ({len(text)} 字符): {preview}")
            logger.warning("检测到模型返回错误，该次评审将被忽略。")
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

        logger.debug(f"解析 {critic_name} 的评审输出")
        preview = text if len(text) < MAX_PREVIEW_LENGTH else text[:MAX_PREVIEW_LENGTH] + "..."
        logger.debug(f"原始文本 ({len(text)} 字符): {preview}")

        field_patterns = [
            ("accuracy", [r"准确性\s*[:：]\s*(\d+)(?:/\d+)?", r"accuracy\s*[:：]?\s*(\d+)(?:/\d+)?"]),
            ("completeness", [r"完整性\s*[:：]\s*(\d+)(?:/\d+)?", r"completeness\s*[:：]?\s*(\d+)(?:/\d+)?"]),
            ("clarity", [r"清晰性\s*[:：]\s*(\d+)(?:/\d+)?", r"clarity\s*[:：]?\s*(\d+)(?:/\d+)?"]),
            ("usefulness", [r"实用性\s*[:：]\s*(\d+)(?:/\d+)?", r"usefulness\s*[:：]?\s*(\d+)(?:/\d+)?"])
        ]

        for field, patterns in field_patterns:
            found = False
            for pattern in patterns:
                match = re.search(pattern, text, re.I)
                if match:
                    data[field] = min(MAX_SCORE_PER_FIELD, int(match.group(1)))
                    found = True
                    logger.debug(f"找到 {field}: {data[field]} (使用正则: {pattern})")
                    break
            if not found:
                data["missing_fields"].append(field)
                logger.warning(f"未找到 {field} 评分")

        total_patterns = [r"总分\s*[:：]\s*(\d+)(?:/\d+)?", r"total\s*[:：]?\s*(\d+)(?:/\d+)?"]
        total_found = False
        for pattern in total_patterns:
            match = re.search(pattern, text, re.I)
            if match:
                data["score"] = min(MAX_TOTAL_SCORE, int(match.group(1)))
                total_found = True
                logger.debug(f"找到总分: {data['score']} (使用正则: {pattern})")
                break

        calculated_score = data["accuracy"] + data["completeness"] + data["clarity"] + data["usefulness"]

        if not total_found:
            # 如果没有通过正则找到总分，则使用计算出的分数
            data["score"] = calculated_score
            logger.info(f"未找到总分，使用计算值: {data['score']}")
            # 如果计算出的分数大于0，我们认为总分是有效的，即使它没有被显式提供
            if calculated_score == 0 and "total" not in data["missing_fields"]:
                 data["missing_fields"].append("total")
                 logger.warning("计算总分为0，可能存在解析问题")
        else:
            # 如果找到了总分，但它与计算值不匹配，记录一个警告
            if data["score"] != calculated_score:
                logger.warning(
                    f"解析到的总分 ({data['score']}) 与计算值 ({calculated_score}) 不匹配。 "
                    f"将使用解析到的总分。这可能表示模型没有正确计算总和。"
                )
        
        # 提取评语 - 多种模式尝试
        comment_found = False
        
        # 模式1: 标准的"评语:"格式
        comment = re.search(r"评语\s*[:：]\s*(.*?)(?:\n\n|\n(?:准确性|完整性|清晰性|实用性|总分)|$)", text, re.I | re.DOTALL)
        if comment:
            comment_text = comment.group(1).strip()
            if comment_text and len(comment_text) > MIN_COMMENT_PREVIEW:  # 确保有实质内容
                data["comment"] = comment_text
                comment_found = True
        
        # 模式2: 查找"建议"、"改进"、"缺陷"等关键词段落
        if not comment_found:
            keywords = [r"建议[:：]?(.*?)(?:\n\n|$)", r"改进[:：]?(.*?)(?:\n\n|$)", 
                       r"缺陷[:：]?(.*?)(?:\n\n|$)", r"问题[:：]?(.*?)(?:\n\n|$)"]
            for pattern in keywords:
                match = re.search(pattern, text, re.I | re.DOTALL)
                if match:
                    comment_text = match.group(1).strip()
                    if comment_text and len(comment_text) > MIN_COMMENT_PREVIEW:
                        data["comment"] = comment_text
                        comment_found = True
                        break
        
        # 模式3: 如果前面都没有找到，尝试提取总分之后的内容
        if not comment_found:
            after_score = re.search(r"总分\s*[:：]\s*\d+(?:/\d+)?\s*\n+(.*)", text, re.I | re.DOTALL)
            if after_score:
                comment_text = after_score.group(1).strip()
                # 移除可能的多余换行和空格
                comment_text = re.sub(r'\n{3,}', '\n\n', comment_text)
                if comment_text and len(comment_text) > MIN_COMMENT_AFTER_SCORE:
                    data["comment"] = comment_text
                    comment_found = True
        
        # 模式4: 如果还是没有，提取所有评分之后的文本
        if not comment_found:
            # 找到最后一个评分项之后的内容
            last_score_pos = 0
            for pattern in [r"准确性\s*[:：]\s*\d+(?:/\d+)?", r"完整性\s*[:：]\s*\d+(?:/\d+)?", 
                           r"清晰性\s*[:：]\s*\d+(?:/\d+)?", r"实用性\s*[:：]\s*\d+(?:/\d+)?", r"总分\s*[:：]\s*\d+(?:/\d+)?"]:
                match = re.search(pattern, text, re.I)
                if match:
                    last_score_pos = max(last_score_pos, match.end())
            
            if last_score_pos > 0:
                remaining_text = text[last_score_pos:].strip()
                # 移除"评语:"标签（如果有）
                remaining_text = re.sub(r'^评语\s*[:：]\s*', '', remaining_text, flags=re.I)
                if remaining_text and len(remaining_text) > MIN_COMMENT_AFTER_SCORE:
                    data["comment"] = remaining_text
                    comment_found = True
        
        # 如果所有模式都失败了，使用整个文本作为评语（但排除评分行）
        if not comment_found or not data["comment"]:
            # 移除所有评分行
            cleaned_text = re.sub(r'(准确性|完整性|清晰性|实用性|总分)\s*[:：]\s*\d+(?:/\d+)?\s*\n?', '', text, flags=re.I)
            cleaned_text = cleaned_text.strip()
            if cleaned_text and len(cleaned_text) > MIN_COMMENT_FINAL:
                data["comment"] = cleaned_text
            else:
                data["comment"] = f"模型 {critic_name} 未按要求提供详细评语。"
                if "comment" not in data["missing_fields"]:
                    data["missing_fields"].append("comment")

        self._apply_strict_penalties(data)

        logger.info(
            f"最终评分: 准确{data['accuracy']} 完整{data['completeness']} "
            f"清晰{data['clarity']} 实用{data['usefulness']} = {data['score']}/12"
        )
        if data.get("missing_fields"):
            logger.warning(f"缺少字段: {data['missing_fields']}")
        
        return data

    def _apply_strict_penalties(self, data: Dict[str, Any]) -> None:
        """
        调整和校准评分，使其更合理，避免极端高分或低分。
        新逻辑 (v3):
        1. 基础分映射: 稍微降低原始分，但比之前宽松。3->2.5, 2->1.8, 1->1.0。
        2. 智能分析评语:
           - 高分低评 (给出高分但评语负面): 扣分。
           - 低分高评 (给出低分但评语正面): 扣分。
           - 低分且评语具体指出问题: 奖励。
        3. 评语质量调整: 长度不足或过于笼统会轻微扣分。
        4. 最终分数映射: 将计算出的分数映射到0-12分的区间，使其分布更合理。
        """
        comment_text = (data.get("comment", "") or "").lower()
        raw_text = (data.get("raw_text", "") or "").lower()

        # 规则1: 如果包含免责声明，直接0分
        if self._contains_disclaimer(comment_text) or self._contains_disclaimer(raw_text):
            for field in ("accuracy", "completeness", "clarity", "usefulness"):
                data[field] = 0
            data["score"] = 0.0
            data["penalty_reason"] = "vision_disclaimer"
            return

        # 规则2: 基础分重新映射
        base_score = 0.0
        field_scores = {}
        for field in ("accuracy", "completeness", "clarity", "usefulness"):
            original_value = data.get(field, 0)
            
            if original_value >= 3:
                adjusted_value = 2.5
            elif original_value == 2:
                adjusted_value = 1.8
            elif original_value == 1:
                adjusted_value = 1.0
            else:
                adjusted_value = 0.0
            
            field_scores[field] = adjusted_value
            base_score += adjusted_value
        
        # 规则3: 基于评语和评分的一致性进行调整
        adjustment = 0.0
        negative_keywords = ["但", "不足", "问题", "缺陷", "遗漏", "错误", "however", "issue", "problem", "lack"]
        positive_keywords = ["准确", "清晰", "完整", "优秀", "全面", "很好", "good", "excellent", "clear"]

        has_negative = any(kw in comment_text for kw in negative_keywords)
        has_positive = any(kw in comment_text for kw in positive_keywords)

        # 如果总分偏高（>=8），但评语包含负面词，说明可能过誉，扣分
        if base_score >= 8.0 and has_negative:
            adjustment -= 1.0
        
        # 如果总分偏低（<=5），但评语主要是正面词，说明可能过谦，也轻微扣分
        if base_score <= 5.0 and has_positive and not has_negative:
            adjustment -= 0.5

        # 如果总分偏低（<=5），且评语包含负面词，说明批评到位，给予奖励
        if base_score <= 5.0 and has_negative:
            adjustment += 1.0

        # 规则4: 评语质量调整
        if len(comment_text) < MIN_COMMENT_LENGTH:
            adjustment -= 1.0  # 评语太短，扣分
        
        # 如果模型给自己的所有单项都打了满分，这通常是不合理的，进行惩罚
        if all(data.get(f, 0) == 3 for f in ("accuracy", "completeness", "clarity", "usefulness")):
            adjustment -= 2.0

        # 规则5: 计算最终分数
        # 基础分(0-10) + 调整项(-4.5 ~ +1.0)
        final_score = base_score + adjustment

        # 将分数映射到更合理的0-12分范围
        # 使用一个非线性函数 (如sigmoid变体) 来调整分布，让分数更集中在中间区域
        # 这里的映射函数将原始的 final_score (大致在-4.5到11之间) 映射到 0-12
        # 我们设计一个函数，让 5分 -> 7分, 8分 -> 10分, 10分 -> 11.5分
        if final_score > 0:
            # 一个简化的映射：高于5分的部分打折，低于5分的部分放大
            if final_score <= 5:
                # 0-5分区间拉伸到0-7分
                mapped_score = final_score * (7/5)
            else:
                # 5-11分区间压缩到7-12分
                mapped_score = 7 + (final_score - 5) * (5/6)
        else:
            mapped_score = 0

        # 确保分数在0-12的范围内
        final_score = max(0.0, min(12.0, mapped_score))

        # 如果有任何字段缺失，分数直接归零，以惩罚不按格式输出的模型
        if data.get("missing_fields"):
            final_score = 0.0

        data["score"] = round(final_score, 1)
        # 将调整后的各单项分也更新回去，虽然主要以总分为准
        for field, score in field_scores.items():
            data[field] = round(score, 1)


