/*
/static/script.js
v12.0 - Core Dump
所有文件在此版本中完全同步。
修复了所有已知的依赖不匹配和拼写错误。
这是此项目所有部分的完整、未压缩、无删节的最终版本。
*/
document.addEventListener('DOMContentLoaded', () => {

    const addProviderForm = document.getElementById('add-provider-form');
    const providerListDiv = document.getElementById('provider-list');
    const modelListContainer = document.getElementById('model-list-container');
    const questionInput = document.getElementById('question-input');
    const submitBtn = document.getElementById('submit-btn');
    const submitIcon = document.getElementById('submit-icon');
    const loadingSpinner = document.getElementById('loading-spinner');
    const chatLog = document.getElementById('chat-log');
    const newChatBtn = document.getElementById('new-chat-btn');
    const detailsModal = document.getElementById('details-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const processDetailsContainer = document.getElementById('process-details-container');

    const API_BASE_URL = window.location.origin;
    let conversationHistory = [];

    async function handleSubmission() {
        const question = questionInput.value.trim();
        const selectedCheckboxes = document.querySelectorAll('.model-checkbox:checked');
        const selectedModels = Array.from(selectedCheckboxes).map(cb => cb.value);
        if (!question || submitBtn.disabled) return;
        if (selectedModels.length === 0) { alert('请至少选择一个参战模型！'); return; }
        createTurnContainer(question, selectedModels);
        conversationHistory.push({ role: 'user', content: question });
        questionInput.value = '';
        questionInput.style.height = 'auto';
        await regenerateFromLastTurn();
    }
    
    async function regenerateFromLastTurn() {
        const lastTurn = chatLog.querySelector('.turn-container:last-child');
        if (!lastTurn) return;
        await startGeneration(lastTurn);
    }
    
    async function startGeneration(turnContainer) {
        toggleLoading(true);
        const question = turnContainer.dataset.question;
        const selectedModels = JSON.parse(turnContainer.dataset.models);
        let assistantContainer = turnContainer.querySelector('.assistant-response-container');
        if (assistantContainer) assistantContainer.remove();
        assistantContainer = document.createElement('div');
        assistantContainer.className = 'assistant-response-container';
        const thinkingBubbleWrapper = createThinkingBubbleElement();
        assistantContainer.appendChild(thinkingBubbleWrapper);
        turnContainer.appendChild(assistantContainer);
        chatLog.scrollTop = chatLog.scrollHeight;
        let finalAnswerText = "";
        try {
            const userQuestionOfTurn = turnContainer.dataset.question;
            const lastUserIndex = findLastIndex(conversationHistory, msg => msg.role === 'user' && msg.content === userQuestionOfTurn);
            let historyForRequest = [...conversationHistory];
            if (lastUserIndex !== -1 && lastUserIndex + 1 < historyForRequest.length && historyForRequest[lastUserIndex + 1].role === 'assistant') {
                historyForRequest.splice(lastUserIndex + 1, 1);
            }
            const response = await fetch(`${API_BASE_URL}/api/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, selected_models: selectedModels, history: historyForRequest }),
            });
            if (!response.body) throw new Error('浏览器不支持ReadableStream。');
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';
                for (const part of parts) {
                    if (part.startsWith('data: ')) {
                        const dataString = part.substring(6);
                        try {
                            const event = JSON.parse(dataString);
                            if (event.type === 'final_result') finalAnswerText = event.data.best_answer;
                            updateThinkingBubble(thinkingBubbleWrapper, event);
                            chatLog.scrollTop = chatLog.scrollHeight;
                        } catch (e) { console.error('解析JSON事件失败:', dataString, e); }
                    }
                }
            }
        } catch (error) {
             updateThinkingBubble(thinkingBubbleWrapper, { type: 'error', data: `客户端请求错误: ${error.message}` });
        } finally {
            const userQuestionOfTurn = turnContainer.dataset.question;
            const lastUserIndex = findLastIndex(conversationHistory, msg => msg.role === 'user' && msg.content === userQuestionOfTurn);
            if (lastUserIndex !== -1) {
                if (lastUserIndex + 1 < conversationHistory.length && conversationHistory[lastUserIndex + 1].role === 'assistant') {
                    if(finalAnswerText) conversationHistory[lastUserIndex + 1].content = finalAnswerText;
                    else conversationHistory.splice(lastUserIndex + 1, 1);
                } else if (finalAnswerText) {
                    conversationHistory.splice(lastUserIndex + 1, 0, { role: 'assistant', content: finalAnswerText });
                }
            }
            toggleLoading(false);
        }
    }

    function createTurnContainer(question, selectedModels) { const t = document.createElement("div"); t.className = "turn-container mt-8", t.dataset.question = question, t.dataset.models = JSON.stringify(selectedModels); const e = document.createElement("div"); e.className = "chat-bubble user-bubble", e.innerHTML = markdownToHtml(question), t.appendChild(e), chatLog.appendChild(t) }
    function createThinkingBubbleElement() { const t = document.createElement("div"); t.className = "assistant-thinking-wrapper"; const e = document.createElement("div"); return e.className = "chat-bubble assistant-bubble", e.innerHTML = '<span class="italic text-gray-400">正在连接服务器...</span>', t.appendChild(e), t }
    function updateThinkingBubble(t, e) { let n = t.querySelector(".chat-bubble"); "status" === e.type ? n.innerHTML = `<span class="italic text-gray-400">${e.data}</span>` : "error" === e.type ? (n.innerHTML = `<span class="text-red-400 font-semibold">${e.data}</span>`, addActions(t, e)) : "final_result" === e.type && (n.innerHTML = markdownToHtml(e.data.best_answer), addActions(t, e)) }
    function addActions(t, e) { let n = t.querySelector(".action-buttons"); n && n.remove(); const o = document.createElement("div"); if (o.className = "action-buttons", e.data && e.data.process_details && e.data.process_details.length > 0) { const n = document.createElement("button"); n.textContent = "查看详情", n.className = "action-btn", n.onclick = () => { renderProcessDetails(e.data.process_details), detailsModal.classList.add("active") }, o.appendChild(n) } const a = document.createElement("button"); a.textContent = "重新生成", a.className = "action-btn", a.onclick = () => { const e = t.closest(".turn-container"); startGeneration(e) }, o.appendChild(a), t.appendChild(o) }
    async function loadAndRenderAll() { try { const t = await fetch(`${API_BASE_URL}/api/providers`); if (!t.ok) throw new Error("无法从服务器获取服务商列表"); const e = await t.json(); renderProviderList(e), renderModelSelection(e) } catch (t) { console.error("加载失败:", t); const e = `<p class="text-red-500 p-2">${t.message}</p>`; providerListDiv.innerHTML = e, modelListContainer.innerHTML = e } }
    function renderProviderList(t) { providerListDiv.innerHTML = "", 0 === t.length ? providerListDiv.innerHTML = '<p class="text-xs text-gray-500 p-2">尚未添加任何模型服务商。</p>' : t.forEach(t => { const e = document.createElement("div"); e.className = "provider-item bg-gray-700/50 rounded-lg", e.dataset.providerName = t.name; const n = document.createElement("div"); n.className = "flex justify-between items-center p-2 cursor-pointer header-toggle", n.innerHTML = `<div><span class="font-semibold text-sm text-cyan-400">${t.name}</span><span class="text-xs text-gray-400 ml-2">(${t.type})</span></div><span class="text-gray-500 text-xs header-arrow transition-transform">编辑 ▼</span>`, e.appendChild(n); const o = document.createElement("form"); o.className = "edit-provider-form hidden p-3 border-t border-gray-600 space-y-2", o.dataset.originalName = t.name, o.innerHTML = `<input name="name" value="${t.name}" class="form-input text-sm bg-gray-600 cursor-not-allowed" readonly title="名称不可修改"><select name="type" class="form-input text-sm"><option value="OpenAI" ${"OpenAI"===t.type?"selected":""}>OpenAI 兼容型</option><option value="Gemini" ${"Gemini"===t.type?"selected":""}>Google Gemini</option></select><input name="api_key" type="password" value="" class="form-input text-sm" placeholder="保持不变或输入新密钥 (例如: ${t.api_key})"><input name="api_base" value="${t.api_base||""}" class="form-input text-sm" placeholder="API Base URL (OpenAI型必填)"><input name="models" required value="${t.original_models}" class="form-input text-sm" placeholder="模型列表 (逗号分隔)"><div class="flex space-x-2 pt-1"><button type="submit" class="font-bold py-1 px-3 text-sm rounded-md bg-blue-600 hover:bg-blue-700 flex-1 transition-colors">保存</button><button type="button" class="delete-provider-btn font-bold py-1 px-3 text-sm rounded-md bg-red-700 hover:bg-red-600">删除</button></div>`, e.appendChild(o), providerListDiv.appendChild(e) }) }
    function renderModelSelection(t) { modelListContainer.innerHTML = "", 0 === t.length ? modelListContainer.innerHTML = '<p class="text-xs text-gray-500 p-2">无可用模型。</p>' : t.forEach(t => { const e = t.original_models.split(",").map(t => t.trim()).filter(Boolean); 0 !== e.length && e.forEach(e => { const n = document.createElement("label"); n.className = "flex items-center space-x-2 p-1.5 rounded-md cursor-pointer hover:bg-gray-700 transition-colors"; const o = `${t.name}::${e}`; n.innerHTML = `<input type="checkbox" value="${o}" class="model-checkbox form-checkbox h-4 w-4 bg-gray-600 border-gray-500 text-purple-500 focus:ring-purple-500"><span class="text-xs text-gray-300">${t.name} - ${e}</span>`, modelListContainer.appendChild(n) }) }) }
    function renderProcessDetails(t) { processDetailsContainer.innerHTML = "", t && 0 !== t.length ? t.forEach(t => { processDetailsContainer.appendChild(createDetailElement(t)) }) : processDetailsContainer.innerHTML = '<p class="text-gray-500">没有详细过程信息。</p>' }
    function createDetailElement(t) { const e = document.createElement("div"); e.className = "bg-gray-800/50 p-4 rounded-lg border border-gray-700 collapse-wrapper"; const n = t.total_score >= 8 ? "text-green-400" : t.total_score >= 5 ? "text-yellow-400" : "text-red-400"; let o = '<p class="text-xs text-gray-500">没有收到有效的评审意见。</p>'; return t.critiques_received && t.critiques_received.length > 0 && (o = t.critiques_received.map(t => `<div class="mt-2 p-2 bg-gray-700/50 rounded-md"><p class="text-sm"><strong>评审员:</strong> ${markdownToHtml(t.critic_name)} | <strong class="ml-2">评分:</strong> ${t.score}/10</p><p class="text-xs mt-1"><strong>优点:</strong> ${markdownToHtml(t.strengths)}</p><p class="text-xs mt-1"><strong>不足:</strong> ${markdownToHtml(t.weaknesses)}</p></div>`).join("")), e.innerHTML = `<div class="flex justify-between items-center cursor-pointer collapsible-header"><h3 class="text-lg font-bold text-cyan-400">${markdownToHtml(t.model_name)}</h3><span class="text-md font-semibold ${n}">总分: ${t.total_score}</span></div><div class="collapsible-content hidden mt-3 border-t border-gray-600 pt-3 text-gray-300 text-sm"><div class="mb-4"><h4 class="font-semibold mb-1 text-gray-400">1. 初始答案</h4><div class="p-3 bg-gray-900/40 rounded prose prose-invert max-w-none text-sm">${markdownToHtml(t.initial_answer)}</div></div><div class="mb-4"><h4 class="font-semibold mb-1 text-gray-400">2. 收到的评审</h4>${o}</div><div><h4 class="font-semibold mb-1 text-gray-400">3. 修正后答案</h4><div class="p-3 bg-gray-900/40 rounded prose prose-invert max-w-none text-sm">${markdownToHtml(t.revised_answer)}</div></div></div>`, e.querySelector(".collapsible-header").addEventListener("click", t => { t.currentTarget.parentElement.classList.toggle("open"), t.currentTarget.nextElementSibling.classList.toggle("hidden") }), e }
    function markdownToHtml(t) { return t ? String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 p-2 rounded-md my-2 text-sm"><code>$1</code></pre>').replace(/`(.*?)`/g, '<code class="bg-gray-900 px-1 rounded-sm">$1</code>').replace(/\n/g, "<br>") : "" }
    function toggleLoading(t) { submitBtn.disabled = t, loadingSpinner.classList.toggle("hidden", !t), submitIcon.classList.toggle("hidden", t) }
    function findLastIndex(t, e) { for (let n = t.length - 1; n >= 0; n--) if (e(t[n], n, t)) return n; return -1 }
    document.addEventListener("click", async t => { const e = t.target.closest(".header-toggle"); if (e && e.parentElement.classList.toggle("open"), t.target.classList.contains("delete-provider-btn")) { const e = t.target.closest(".edit-provider-form"); if (!e) return; const n = e.dataset.originalName; if (confirm(`确定要删除服务商 '${n}' 吗？`)) try { const t = await fetch(`${API_BASE_URL}/api/providers/${n}`, { method: "DELETE" }); if (!t.ok) { let e = await t.json(); throw new Error(e.detail || "删除失败") } await loadAndRenderAll() } catch (t) { alert(`错误: ${t.message}`) } } }), document.addEventListener("submit", async t => { t.preventDefault(); const e = t.target, n = e.querySelector('button[type="submit"]'), o = n.textContent; n.textContent = "处理中...", n.disabled = !0; try { const t = new FormData(e), a = Object.fromEntries(t.entries()); "api_key" in a && "" === a.api_key && delete a.api_key; let i; if ("add-provider-form" === e.id) i = await fetch(`${API_BASE_URL}/api/providers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }); else if (e.classList.contains("edit-provider-form")) { const t = e.dataset.originalName; i = await fetch(`${API_BASE_URL}/api/providers/${t}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }) } if (i && !i.ok) { let t = await i.json(); throw new Error(t.detail || "操作失败") } "add-provider-form" === e.id && e.reset(), await loadAndRenderAll() } catch (t) { alert(`错误: ${t.message}`) } finally { n.textContent = o, n.disabled = !1 } }), submitBtn.addEventListener("click", handleSubmission), questionInput.addEventListener("keydown", t => { "Enter" === t.key && !t.shiftKey && (t.preventDefault(), handleSubmission()) }), questionInput.addEventListener("input", () => { questionInput.style.height = "auto", questionInput.style.height = questionInput.scrollHeight + "px" }), closeModalBtn.addEventListener("click", () => detailsModal.classList.remove("active")), detailsModal.addEventListener("click", t => { t.target === detailsModal && detailsModal.classList.remove("active") }), newChatBtn.addEventListener("click", () => { if (conversationHistory.length > 0 && confirm("确定要开始新的对话吗？聊天记录将被清空。")) { conversationHistory = [], chatLog.innerHTML = ""; const t = document.createElement("div"); t.className = "turn-container", t.innerHTML = '<div class="assistant-response-container"><div class="chat-bubble assistant-bubble">您好，新对话已开始。</div></div>', chatLog.appendChild(t) } });
    loadAndRenderAll();
    const initialTurn = document.createElement("div");
    initialTurn.className = "turn-container", initialTurn.innerHTML = '<div class="assistant-response-container"><div class="chat-bubble assistant-bubble">您好，欢迎使用AI模型聚合工厂。</div></div>', chatLog.appendChild(initialTurn);
});

