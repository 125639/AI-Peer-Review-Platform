import asyncio
import re
from typing import List, Dict, Any, AsyncGenerator

from .models import create_model_instance
import core.database as db

class Orchestrator:
    """核心编排器：管理多模型协作"""
    
    async def process_query_stream(self, user_question: str, selected_models: List[str], 
                                   history: List[Dict[str, str]]) -> AsyncGenerator[Dict[str, Any], None]:
        """流式处理查询"""
        
        yield {"type": "status", "data": "正在初始化模型..."}
        
        # 创建模型实例
        active_models = []
        for sm_id in selected_models:
            parts = sm_id.split('::', 1)
            if len(parts) != 2:
                continue
            provider_name, model_name = parts
            provider_config = db.get_provider_by_name(provider_name)
            if not provider_config:
                continue
            instance = create_model_instance(provider_config, model_name)
            if instance:
                active_models.append(instance)
        
        if not active_models:
            yield {"type": "error", "data": "没有可用的模型"}
            return
        
        messages = history + [{"role": "user", "content": user_question}]
        
        # === 第一轮：生成初始答案 ===
        yield {"type": "status", "data": "第一轮：AI们正在思考答案..."}
        
        initial_answers = {}
        tasks = [self._generate_answer(model, messages) for model in active_models]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for model, result in zip(active_models, results):
            if isinstance(result, Exception):
                initial_answers[model.name] = f"[生成失败: {result}]"
            else:
                initial_answers[model.name] = result
            yield {
                "type": "initial_answer_complete",
                "model_name": model.name,
                "answer": initial_answers[model.name]
            }
        
        # 如果只有一个模型
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
        
        # === 第二轮：互相评审 ===
        yield {"type": "status", "data": "第二轮：AI们正在互相评审..."}
        
        critiques = {m.name: [] for m in active_models}
        critique_tasks = []
        
        for critic in active_models:
            for target_model in active_models:
                if critic.name == target_model.name:
                    continue
                critique_tasks.append(
                    self._generate_critique(
                        critic, target_model.name, user_question,
                        initial_answers.get(target_model.name, "")
                    )
                )
        
        critique_results = await asyncio.gather(*critique_tasks, return_exceptions=True)
        
        task_idx = 0
        for critic in active_models:
            for target_model in active_models:
                if critic.name == target_model.name:
                    continue
                result = critique_results[task_idx]
                task_idx += 1
                
                if isinstance(result, Exception):
                    continue
                
                critique_text, parsed = result
                critiques[target_model.name].append(parsed)
                
                yield {
                    "type": "critique_complete",
                    "critic_name": critic.name,
                    "target_model": target_model.name,
                    "critique_text": critique_text,
                    "critique_data": parsed
                }
        
        # === 第三轮：修正答案 ===
        yield {"type": "status", "data": "第三轮：AI们正在根据评审改进答案..."}
        
        revised_answers = {}
        revision_tasks = []
        
        for model in active_models:
            my_critiques = critiques.get(model.name, [])
            if not my_critiques:
                revised_answers[model.name] = initial_answers.get(model.name, "")
            else:
                revision_tasks.append((model.name, self._generate_revision(
                    model, initial_answers.get(model.name, ""), my_critiques
                )))
        
        if revision_tasks:
            revision_results = await asyncio.gather(
                *[task for _, task in revision_tasks],
                return_exceptions=True
            )
            for (model_name, _), result in zip(revision_tasks, revision_results):
                if isinstance(result, Exception):
                    revised_answers[model_name] = initial_answers.get(model_name, "")
                else:
                    revised_answers[model_name] = result
                yield {
                    "type": "revision_complete",
                    "model_name": model_name,
                    "revised_answer": revised_answers[model_name]
                }
        
        # === 最终决策 ===
        yield {"type": "status", "data": "正在进行最终决策..."}
        
        best_answer, details = self._make_final_decision(initial_answers, critiques, revised_answers)
        
        yield {
            "type": "final_result",
            "data": {
                "best_answer": best_answer,
                "process_details": details
            }
        }
    
    async def _generate_answer(self, model, messages: List[Dict]) -> str:
        """生成单个答案（阻塞式）"""
        return await model.generate(messages)
    
    async def _generate_critique(self, critic_model, target_name: str, 
                                 question: str, answer: str) -> tuple:
        """生成评审"""
        prompt = self._build_critique_prompt(question, target_name, answer)
        messages = [{"role": "user", "content": prompt}]
        critique_text = await critic_model.generate(messages)
        parsed = self._parse_critique(critique_text, critic_model.name)
        return (critique_text, parsed)
    
    async def _generate_revision(self, model, original: str, critiques: List[Dict]) -> str:
        """生成修正"""
        prompt = self._build_revision_prompt(original, critiques)
        messages = [{"role": "user", "content": prompt}]
        return await model.generate(messages)
    
    def _make_final_decision(self, initial: Dict, critiques: Dict, revised: Dict):
        """最终决策"""
        scores = {}
        for model_name, critique_list in critiques.items():
            total = sum(c.get('score', 0) for c in critique_list)
            count = len(critique_list)
            scores[model_name] = total / count if count > 0 else 0
        
        results = []
        for name in initial.keys():
            results.append({
                "model_name": name,
                "initial_answer": initial.get(name, ""),
                "critiques_received": critiques.get(name, []),
                "revised_answer": revised.get(name, initial.get(name, "")),
                "total_score": scores.get(name, 0)
            })
        
        results.sort(key=lambda x: x['total_score'], reverse=True)
        best = results[0] if results else None
        best_answer = best.get('revised_answer', '') if best else "无结果"
        
        return best_answer, results
    
    def _build_critique_prompt(self, question: str, target: str, answer: str) -> str:
        """构建评审提示词 - v15.0严格批评版本"""
        return f"""你是一个严格的AI评审员。你的任务是找出答案中的缺陷和不足，而不是夸奖。

【用户问题】
{question}

【被评审的答案（来自'{target}'）】
{answer}

【评审标准（每项0-3分，必须严格评分）】

1. **准确性 (Accuracy)** - 信息是否正确？
   - 3分：完全准确，无错误
   - 2分：基本准确，有1-2处小瑕疵
   - 1分：存在明显错误或过时信息
   - 0分：严重错误或完全不准确

2. **完整性 (Completeness)** - 是否遗漏重要内容？
   - 3分：全面覆盖，无遗漏
   - 2分：覆盖主要内容，有小遗漏
   - 1分：明显遗漏重要信息
   - 0分：严重不完整或跑题

3. **清晰性 (Clarity)** - 表达是否清晰？结构是否合理？
   - 3分：清晰明了，结构完美
   - 2分：基本清晰，略有混乱
   - 1分：表达模糊或逻辑混乱
   - 0分：完全看不懂或极度啰嗦

4. **实用性 (Usefulness)** - 是否对用户有实际帮助？
   - 3分：非常实用，有具体建议
   - 2分：有一定帮助
   - 1分：泛泛而谈，缺乏实操性
   - 0分：完全没用或误导用户

【评分要求】
- 不要客气！普通答案应该在5-8分之间
- 如果答案有明显缺陷，该维度直接给0-1分
- 只有真正优秀的答案才能得10-12分
- 评语必须包含：至少1个主要缺陷 + 至少2条具体改进建议

【输出格式（严格按照此格式）】
准确性: [0-3的数字]
完整性: [0-3的数字]
清晰性: [0-3的数字]
实用性: [0-3的数字]
总分: [四项相加的总和]
评语: [必须指出具体缺陷，并给出改进建议，不要只说优点！]

现在开始严格评审，不要手下留情！"""
    
    def _build_revision_prompt(self, original: str, critiques: List[Dict]) -> str:
        """构建修订提示词 - v15.0针对性改进版本"""
        feedback_details = []
        for c in critiques:
            critic_name = c.get('critic_name', 'Reviewer')
            score = c.get('score', 0)
            comment = c.get('comment', 'N/A')
            accuracy = c.get('accuracy', 0)
            completeness = c.get('completeness', 0)
            clarity = c.get('clarity', 0)
            usefulness = c.get('usefulness', 0)
            
            feedback_details.append(f"""
评审员: {critic_name}
总分: {score}/12 (准确性{accuracy}/3, 完整性{completeness}/3, 清晰性{clarity}/3, 实用性{usefulness}/3)
评语: {comment}
""")
        
        feedback = "\n".join(feedback_details)
        
        return f"""你需要根据评审意见改进你的答案。请注意：这不是让你重写答案，而是针对性地修复缺陷。

【你的原始答案】
{original}

【收到的评审意见】
{feedback}

【改进要求】
1. 仔细分析每个评审员指出的具体缺陷
2. 如果准确性被扣分，检查并修正错误信息
3. 如果完整性被扣分，补充遗漏的重要内容
4. 如果清晰性被扣分，优化表达和结构
5. 如果实用性被扣分，增加具体建议和实操指导

【输出要求】
- 只输出改进后的完整答案
- 不要写"根据评审意见..."这样的元信息
- 不要只是换个说法，要真正解决评审中指出的问题
- 如果评审认为没有明显缺陷，可以保持原样或略微润色

现在输出改进后的答案："""
    
    def _parse_critique(self, text: str, critic_name: str) -> Dict:
        """解析评审结果"""
        data = {
            "critic_name": critic_name,
            "accuracy": 0,
            "completeness": 0,
            "clarity": 0,
            "usefulness": 0,
            "score": 0,
            "comment": ""
        }
        
        # 使用更宽松的正则表达式匹配
        acc = re.search(r"准确性\s*[:：]\s*(\d+)", text, re.I)
        comp = re.search(r"完整性\s*[:：]\s*(\d+)", text, re.I)
        clar = re.search(r"清晰性\s*[:：]\s*(\d+)", text, re.I)
        use = re.search(r"实用性\s*[:：]\s*(\d+)", text, re.I)
        total = re.search(r"总分\s*[:：]\s*(\d+)", text, re.I)
        comment = re.search(r"评语\s*[:：](.*?)(?:\n\n|$)", text, re.I | re.DOTALL)
        
        if acc: data["accuracy"] = min(3, int(acc.group(1)))
        if comp: data["completeness"] = min(3, int(comp.group(1)))
        if clar: data["clarity"] = min(3, int(clar.group(1)))
        if use: data["usefulness"] = min(3, int(use.group(1)))
        
        # 计算总分
        if total: 
            data["score"] = min(12, int(total.group(1)))
        else: 
            data["score"] = data["accuracy"] + data["completeness"] + data["clarity"] + data["usefulness"]
        
        if comment: 
            data["comment"] = comment.group(1).strip()
        else:
            data["comment"] = "未提供评语"
        
        return data

