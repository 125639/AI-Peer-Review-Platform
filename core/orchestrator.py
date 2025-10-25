import asyncio
import re
import aiohttp
from typing import List, Dict, Any, Tuple, AsyncGenerator

from .models import create_model_instance
import core.database as db

async def _get_completed_future(result):
    """一个辅助函数，将一个结果包装成一个已完成的 Future。"""
    return result

class Orchestrator:
    async def process_query_stream(self, user_question: str, selected_models: List[str], history: List[Dict[str, str]]) -> AsyncGenerator[Dict[str, Any], None]:
        yield {"type": "status", "data": "初始化模型..."}
        active_models = [
            instance for sm_id in selected_models
            if (provider_config := db.get_provider_by_name(sm_id.split('::', 1)[0]))
            and (instance := create_model_instance(provider_config, sm_id.split('::', 1)[1]))
        ]
        if not active_models:
            yield {"type": "error", "data": "错误：没有选择任何有效的模型。"}; return
        messages = history + [{"role": "user", "content": user_question}]
        async with aiohttp.ClientSession() as session:
            yield {"type": "status", "data": f"第一轮：{len(active_models)}个模型正在生成初始答案..."}
            initial_answers = await self._generate_initial_answers(messages, active_models, session)
            
            if len(active_models) > 1:
                yield {"type": "status", "data": "第二轮：进行交叉评审..."}
                critiques = await self._critique_answers(user_question, initial_answers, active_models, session)
                yield {"type": "status", "data": "第三轮：根据评审修正答案..."}
                revised_answers = await self._revise_answers(initial_answers, critiques, active_models, session)
            else:
                critiques, revised_answers = {}, initial_answers
            
            yield {"type": "status", "data": "最终决策..."}
            final_decision, all_results = self._make_final_decision(initial_answers, critiques, revised_answers)
            yield {"type": "final_result", "data": {"best_answer": final_decision, "process_details": all_results}}
            
    async def _generate_initial_answers(self, messages, models, session):
        tasks = [model.generate(messages, session) for model in models]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return {models[i].name: str(res) if not isinstance(res, Exception) else f"API调用失败: {res}" for i, res in enumerate(results)}
    
    async def _critique_answers(self, question, answers, models, session):
        pure_name_map = {m.name: m.name.split('::', 1)[1] for m in models}; reverse_name_map = {v: k for k, v in pure_name_map.items()}
        tasks = []
        for critic in models:
            others_text = "".join([f"\n\n--- 来自模型 '{pure_name_map.get(n, n)}' 的答案 ---\n{a}" for n, a in answers.items() if n != critic.name])
            if not others_text.strip(): continue
            prompt = self._build_critique_prompt(question, others_text)
            tasks.append((critic.name, critic.generate([{"role": "user", "content": prompt}], session)))
        if not tasks: return {name: [] for name in answers.keys()}
        results = await asyncio.gather(*[t for _, t in tasks], return_exceptions=True)
        all_critiques = {name: [] for name in answers.keys()}
        for i, (critic_name, _) in enumerate(tasks):
            text = str(results[i]) if not isinstance(results[i], Exception) else f"评审失败:{results[i]}"
            for critique in self._parse_critique(text, critic_name, reverse_name_map):
                if critique.get('model_name') in all_critiques: all_critiques[critique['model_name']].append(critique)
        return all_critiques

    async def _revise_answers(self, initial_answers, critiques, models, session):
        tasks = []
        for model in models:
            my_critiques = critiques.get(model.name, [])
            if not my_critiques: tasks.append((model.name, _get_completed_future(initial_answers.get(model.name, ""))))
            else:
                prompt = self._build_revision_prompt(initial_answers.get(model.name, ""), my_critiques)
                tasks.append((model.name, model.generate([{"role": "user", "content": prompt}], session)))
        results = await asyncio.gather(*[t for _, t in tasks], return_exceptions=True)
        return {name: str(res) if not isinstance(res, Exception) else f"修正失败:{res}" for (name, _), res in zip(tasks, results)}

    def _make_final_decision(self, initial, critiques, revised):
        scores = {n: sum(c.get('score', 0) for c in cl) for n, cl in critiques.items()} if critiques else {}
        results = [{"model_name": n, "initial_answer": initial.get(n, "N/A"), "critiques_received": critiques.get(n, []), "revised_answer": revised.get(n, "N/A"), "total_score": scores.get(n, 0)} for n in initial.keys()]
        results.sort(key=lambda x: x['total_score'], reverse=True)
        if not results: return "无可用结果", []
        best = results[0]
        return best.get('revised_answer') or best.get('initial_answer') or "未能生成最终答案", results

    def _build_critique_prompt(self, question: str, other_answers: str) -> str:
        return f"""You are an expert AI Critic. Your task is to evaluate answers from other AI models for a given question.
        
Question: "{question}"

Here are the answers from other models:
{other_answers}

Your task is to provide a structured critique for EACH model's answer. Use the following format, repeating it for every answer you see. Use '###' as a separator between critiques.

###
模型名称: [The name of the model you are critiquing, e.g., 'deepseek-v2']
评分: [An integer score from 1 to 10]
优点: [List the strengths of the answer, e.g., 'comprehensive', 'well-structured']
不足与改进建议: [List the weaknesses and suggest specific improvements]
###
"""

    def _build_revision_prompt(self, my_initial_answer: str, my_critiques: List[Dict]) -> str:
        feedback_text = "".join([
            f"""---
Feedback from {c.get('critic_name', 'an anonymous critic')} (Score: {c.get('score', 'N/A')}):
Strengths mentioned: {c.get('strengths', 'N/A')}
Weaknesses and suggestions: {c.get('weaknesses', 'N/A')}
"""
            for c in my_critiques
        ])

        return f"""You are an advanced AI model. You previously generated an answer which has now been reviewed by your peers. Your task is to revise your original answer based on the feedback to create a superior version.

Your Original Answer:
---
{my_initial_answer}
---

Feedback Received:
{feedback_text}
---

Your Revision Task:
Carefully analyze the feedback. Integrate the valid suggestions and correct the identified weaknesses. Your revised answer should be more accurate, comprehensive, and well-structured. Output ONLY the final, revised answer, without any conversational preamble.
"""

    def _parse_critique(self, critique_text, critic_name, reverse_name_map):
        critiques, pattern = [], re.compile(r"^\s*模型名称\s*[:：]\s*(.*?)\s*$", re.M | re.I)
        for block in critique_text.split('###'):
            if not block.strip(): continue
            name_match = pattern.search(block)
            if not name_match: continue
            pure_name = name_match.group(1).strip().strip("'\"")
            full_model_id = reverse_name_map.get(pure_name)
            if not full_model_id: continue
            data = {"critic_name": critic_name, "model_name": full_model_id, "score": 0, "strengths": "N/A", "weaknesses": "N/A"}
            score = re.search(r"(?:评分|score)\s*[:：]\s*(\d+)", block, re.I); strengths = re.search(r"优点\s*[:：]([\s\S]*?)(?=不足|$)", block, re.I); weaknesses = re.search(r"不足(?:与改进建议)?\s*[:：]([\s\S]*)", block, re.I)
            if score: data["score"] = int(score.group(1))
            if strengths: data["strengths"] = strengths.group(1).strip()
            if weaknesses: data["weaknesses"] = weaknesses.group(1).strip()
            critiques.append(data)
        return critiques

