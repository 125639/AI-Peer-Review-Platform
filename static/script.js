/*
 * static/script.js
 * Version: 17.0.0 - 强制缓存更新 + 提示词管理功能
 * 更新时间: 2025-01-26 20:30:00
 */

console.log('🚀 Script v17.0.0 loaded - Timestamp: 2025-01-26-20:30:00');
console.log('✅ Prompt Management Feature Enabled');
console.log('✅ Tab Switching Feature Enabled');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing v16.0.0...');
    
    const API_BASE_URL = window.location.origin;
    let conversationHistory = [];
    let currentReader = null;
    let isGenerating = false;
    
    // === DOM元素引用 ===
    const addProviderForm = document.getElementById('add-provider-form');
    const providerListDiv = document.getElementById('provider-list');
    const modelListContainer = document.getElementById('model-list-container');
    const questionInput = document.getElementById('question-input');
    const submitBtn = document.getElementById('submit-btn');
    const stopBtn = document.getElementById('stop-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const submitIcon = document.getElementById('submit-icon');
    const chatLog = document.getElementById('chat-log');
    const newChatBtn = document.getElementById('new-chat-btn');
    const detailsModal = document.getElementById('details-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const processDetailsContainer = document.getElementById('process-details-container');
    const addPromptForm = document.getElementById('add-prompt-form');
    const promptListDiv = document.getElementById('prompt-list');
    
    console.log('Elements loaded:', { 
        submitBtn: !!submitBtn,
        stopBtn: !!stopBtn,
        questionInput: !!questionInput,
        promptListDiv: !!promptListDiv,
        addPromptForm: !!addPromptForm
    });
    
    // 检查标签页按钮是否存在
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log('Tab buttons found:', tabButtons.length);
    tabButtons.forEach((btn, index) => {
        console.log(`Tab button ${index}:`, btn.dataset.tab, btn.textContent.trim());
    });
    
    // === 标签页切换 ===
    document.querySelectorAll('.tab-btn').forEach(btn => {
        console.log('Adding click listener to tab:', btn.dataset.tab);
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            console.log('Tab clicked:', tabName);
            
            // 移除所有按钮的激活状态
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 隐藏所有标签页内容
            document.querySelectorAll('.tab-content').forEach(content => {
                console.log('Removing active from:', content.id);
                content.classList.remove('active');
            });
            
            // 显示选中的标签页
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.classList.add('active');
                console.log('Tab activated:', tabName, 'Display:', window.getComputedStyle(targetTab).display);
            } else {
                console.error('Tab not found:', `${tabName}-tab`);
            }
        });
    });
    
    // === 辅助函数 ===
    function markdownToHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 p-2 rounded-md my-2 text-sm overflow-x-auto"><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-900 px-1 rounded-sm">$1</code>')
            .replace(/\n/g, "<br>");
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function toggleLoading(isLoading) {
        isGenerating = isLoading;
        questionInput.disabled = isLoading;
        
        if (isLoading) {
            submitBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
        } else {
            submitBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        }
        
        loadingSpinner.classList.toggle('hidden', !isLoading);
        submitIcon.classList.toggle('hidden', isLoading);
    }
    
    // === 停止生成 ===
    function stopGeneration() {
        console.log('Stop button clicked');
        
        if (currentReader) {
            try {
                currentReader.cancel('User requested stop');
                console.log('Stream cancelled');
            } catch (e) {
                console.error('Cancel error:', e);
            }
            currentReader = null;
        }
        
        isGenerating = false;
        toggleLoading(false);
        
        // 在聊天中显示停止消息
        const stopMessage = document.createElement('div');
        stopMessage.className = 'chat-bubble assistant-bubble mt-4';
        stopMessage.innerHTML = '<span class="italic text-yellow-400">⚠️ 生成已被用户停止</span>';
        chatLog.appendChild(stopMessage);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
    
    // === 提示词管理功能 ===
    async function loadPrompts() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts`);
            const prompts = await response.json();
            renderPromptList(prompts);
        } catch (error) {
            console.error('Failed to load prompts:', error);
        }
    }
    
    function renderPromptList(prompts) {
        promptListDiv.innerHTML = prompts.map(prompt => `
            <div class="prompt-item ${prompt.is_active ? 'active' : ''}" data-id="${prompt.id}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-lg">${escapeHtml(prompt.name)}</h4>
                        ${prompt.is_active ? '<span class="text-xs text-green-400">✓ 当前使用</span>' : ''}
                    </div>
                    <div class="flex gap-2">
                        ${!prompt.is_active ? `<button onclick="activatePrompt(${prompt.id})" class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded">启用</button>` : ''}
                        <button onclick="editPrompt(${prompt.id})" class="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded">编辑</button>
                        <button onclick="deletePrompt(${prompt.id})" class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded">删除</button>
                    </div>
                </div>
                <details class="text-sm">
                    <summary class="cursor-pointer text-gray-400 hover:text-gray-300">查看详情</summary>
                    <div class="mt-2 space-y-2">
                        <div>
                            <p class="text-gray-400 text-xs mb-1">评审提示词:</p>
                            <pre class="bg-gray-900 p-2 rounded text-xs overflow-x-auto">${escapeHtml(prompt.critique_prompt)}</pre>
                        </div>
                        <div>
                            <p class="text-gray-400 text-xs mb-1">修订提示词:</p>
                            <pre class="bg-gray-900 p-2 rounded text-xs overflow-x-auto">${escapeHtml(prompt.revision_prompt)}</pre>
                        </div>
                    </div>
                </details>
            </div>
        `).join('');
    }
    
    window.activatePrompt = async function(promptId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}/activate`, {
                method: 'POST'
            });
            if (response.ok) {
                await loadPrompts();
                alert('提示词已激活！');
            }
        } catch (error) {
            console.error('Failed to activate prompt:', error);
            alert('激活失败');
        }
    };
    
    window.editPrompt = async function(promptId) {
        const prompts = await (await fetch(`${API_BASE_URL}/api/prompts`)).json();
        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt) return;
        
        const name = window.prompt('提示词名称:', prompt.name);
        if (!name) return;
        
        const critiquePrompt = window.prompt('评审提示词 (使用{question}、{target}、{answer}作为占位符):', prompt.critique_prompt);
        if (!critiquePrompt) return;
        
        const revisionPrompt = window.prompt('修订提示词 (使用{original}、{feedback}作为占位符):', prompt.revision_prompt);
        if (!revisionPrompt) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    critique_prompt: critiquePrompt,
                    revision_prompt: revisionPrompt
                })
            });
            if (response.ok) {
                await loadPrompts();
                alert('更新成功！');
            }
        } catch (error) {
            console.error('Failed to update prompt:', error);
            alert('更新失败');
        }
    };
    
    window.deletePrompt = async function(promptId) {
        if (!confirm('确定要删除这个提示词吗？')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                await loadPrompts();
                alert('删除成功！');
            } else {
                const error = await response.json();
                alert(error.detail || '删除失败');
            }
        } catch (error) {
            console.error('Failed to delete prompt:', error);
            alert('删除失败');
        }
    };
    
    addPromptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addPromptForm);
        const data = {
            name: formData.get('name'),
            critique_prompt: formData.get('critique_prompt'),
            revision_prompt: formData.get('revision_prompt')
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('提示词添加成功！');
                addPromptForm.reset();
                await loadPrompts();
            } else {
                const error = await response.json();
                alert(error.detail || '添加失败');
            }
        } catch (error) {
            console.error('Failed to add prompt:', error);
            alert('添加失败，请检查网络连接');
        }
    });
    
    // === 渲染服务商列表（可展开编辑） ===
    function renderProviderList(providers) {
        console.log('Rendering provider list, count:', providers.length);
        providerListDiv.innerHTML = "";
        
        if (providers.length === 0) {
            providerListDiv.innerHTML = '<p class="text-xs text-gray-500 p-2">尚未添加任何服务商</p>';
            return;
        }
        
        providers.forEach((p, index) => {
            console.log(`Creating provider card ${index + 1}:`, p.name);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'provider-item bg-gray-700/50 rounded-lg mb-2';
            
            // 头部（可点击展开）
            const header = document.createElement('div');
            header.className = 'flex justify-between items-center p-2 cursor-pointer hover:bg-gray-600/50 transition-colors rounded-t-lg';
            header.innerHTML = `
                <div>
                    <span class="font-semibold text-sm text-cyan-400">${escapeHtml(p.name)}</span>
                    <span class="text-xs text-gray-400 ml-2">(${p.type})</span>
                </div>
                <span class="text-gray-500 text-xs transition-transform arrow-icon">编辑 ▼</span>
            `;
            
            // 编辑表单（默认隐藏）
            const form = document.createElement('form');
            form.className = 'edit-form hidden p-3 border-t border-gray-600 space-y-2';
            form.innerHTML = `
                <input name="name" value="${escapeHtml(p.name)}" class="form-input text-sm bg-gray-600 cursor-not-allowed" readonly title="名称不可修改">
                <select name="type" class="form-input text-sm">
                    <option value="OpenAI" ${p.type === 'OpenAI' ? 'selected' : ''}>OpenAI 兼容型</option>
                    <option value="Gemini" ${p.type === 'Gemini' ? 'selected' : ''}>Google Gemini</option>
                </select>
                <input name="api_key" type="password" value="" class="form-input text-sm" placeholder="保持不变或输入新密钥">
                <input name="api_base" value="${escapeHtml(p.api_base || '')}" class="form-input text-sm" placeholder="API Base URL (OpenAI型必填)">
                <input name="models" required value="${escapeHtml(p.original_models)}" class="form-input text-sm" placeholder="模型列表 (逗号分隔)">
                <div class="flex space-x-2 pt-1">
                    <button type="submit" class="font-bold py-1 px-3 text-sm rounded-md bg-blue-600 hover:bg-blue-700 flex-1 transition-colors">保存</button>
                    <button type="button" class="delete-btn font-bold py-1 px-3 text-sm rounded-md bg-red-700 hover:bg-red-600">删除</button>
                </div>
            `;
            
            wrapper.appendChild(header);
            wrapper.appendChild(form);
            
            // 直接绑定事件
            header.addEventListener('click', function() {
                const arrow = this.querySelector('.arrow-icon');
                const isHidden = form.classList.contains('hidden');
                
                if (isHidden) {
                    form.classList.remove('hidden');
                    arrow.style.transform = 'rotate(180deg)';
                } else {
                    form.classList.add('hidden');
                    arrow.style.transform = 'rotate(0deg)';
                }
            });
            
            const deleteBtn = form.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async function() {
                if (!confirm(`确定要删除服务商 '${p.name}' 吗？`)) return;
                
                try {
                    const response = await fetch(`${API_BASE_URL}/api/providers/${encodeURIComponent(p.name)}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || '删除失败');
                    }
                    
                    await loadAndRenderAll();
                } catch (error) {
                    console.error('Delete error:', error);
                    alert(`错误: ${error.message}`);
                }
            });
            
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const submitButton = this.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.textContent = '处理中...';
                submitButton.disabled = true;
                
                try {
                    const formData = new FormData(this);
                    const data = {
                        name: formData.get('name'),
                        type: formData.get('type'),
                        api_base: formData.get('api_base') || '',
                        models: formData.get('models')
                    };
                    
                    const apiKey = formData.get('api_key');
                    if (apiKey && apiKey.trim() !== '') {
                        data.api_key = apiKey.trim();
                    }
                    
                    const response = await fetch(`${API_BASE_URL}/api/providers/${encodeURIComponent(p.name)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || '修改失败');
                    }
                    
                    await loadAndRenderAll();
                } catch (error) {
                    console.error('Update error:', error);
                    alert(`错误: ${error.message}`);
                } finally {
                    submitButton.textContent = originalText;
                    submitButton.disabled = false;
                }
            });
            
            providerListDiv.appendChild(wrapper);
        });
    }
    
    // === 渲染模型选择列表 ===
    function renderModelSelection(providers) {
        modelListContainer.innerHTML = "";
        
        if (providers.length === 0) {
            modelListContainer.innerHTML = '<p class="text-xs text-gray-500 p-2">无可用模型</p>';
            return;
        }
        
        providers.forEach(provider => {
            const models = provider.original_models.split(',').map(m => m.trim()).filter(Boolean);
            if (models.length === 0) return;
            
            models.forEach(modelName => {
                const modelIdentifier = `${provider.name}::${modelName}`;
                const label = document.createElement('label');
                label.className = 'flex items-center space-x-2 p-1.5 rounded-md cursor-pointer hover:bg-gray-700 transition-colors';
                label.innerHTML = `
                    <input type="checkbox" value="${escapeHtml(modelIdentifier)}" class="model-checkbox form-checkbox h-4 w-4 bg-gray-600 border-gray-500 text-purple-500 focus:ring-purple-500">
                    <span class="text-xs text-gray-300">${escapeHtml(provider.name)} - ${escapeHtml(modelName)}</span>
                `;
                modelListContainer.appendChild(label);
            });
        });
    }
    
    // === 添加服务商表单 ===
    if (addProviderForm) {
        addProviderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const submitButton = addProviderForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = '处理中...';
            submitButton.disabled = true;
            
            try {
                const formData = new FormData(addProviderForm);
                const data = {
                    name: formData.get('name').trim(),
                    type: formData.get('type'),
                    api_key: formData.get('api_key').trim(),
                    api_base: formData.get('api_base').trim() || '',
                    models: formData.get('models').trim()
                };
                
                const response = await fetch(`${API_BASE_URL}/api/providers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || '添加失败');
                }
                
                addProviderForm.reset();
                await loadAndRenderAll();
            } catch (error) {
                console.error('Add provider error:', error);
                alert(`错误: ${error.message}`);
            } finally {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
            
            return false;
        });
    }
    
    // === 加载并渲染所有数据 ===
    async function loadAndRenderAll() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/providers`);
            if (!response.ok) throw new Error('无法从服务器获取数据');
            
            const providers = await response.json();
            renderProviderList(providers);
            renderModelSelection(providers);
        } catch (error) {
            console.error('Load error:', error);
            const errorMsg = `<p class="text-red-500 p-2">加载失败: ${error.message}</p>`;
            providerListDiv.innerHTML = errorMsg;
            modelListContainer.innerHTML = errorMsg;
        }
        
        // 同时加载提示词列表
        await loadPrompts();
    }
    
    // === 提交问题 ===
    async function handleSubmission() {
        if (isGenerating) {
            console.log('Already generating, ignoring submit');
            return;
        }
        
        const question = questionInput.value.trim();
        if (!question) return;
        
        const selectedModels = Array.from(document.querySelectorAll('.model-checkbox:checked'))
            .map(cb => cb.value);
        
        if (selectedModels.length === 0) {
            alert('请至少选择一个模型！');
            return;
        }
        
        // 添加用户消息
        const userBubble = document.createElement('div');
        userBubble.className = 'chat-bubble user-bubble mt-8';
        userBubble.textContent = question;
        chatLog.appendChild(userBubble);
        
        conversationHistory.push({ role: 'user', content: question });
        questionInput.value = '';
        toggleLoading(true);
        
        // 添加临时助手气泡
        const assistantBubble = document.createElement('div');
        assistantBubble.className = 'chat-bubble assistant-bubble mt-4';
        assistantBubble.innerHTML = '<span class="italic text-gray-400">正在连接服务器...</span>';
        chatLog.appendChild(assistantBubble);
        chatLog.scrollTop = chatLog.scrollHeight;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    selected_models: selectedModels,
                    history: conversationHistory.slice(0, -1)
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            currentReader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalAnswer = '';
            let finalDetails = [];
            
            try {
                while (isGenerating) {
                    const { value, done } = await currentReader.read();
                    
                    if (done) {
                        console.log('Stream complete');
                        break;
                    }
                    
                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() || '';
                    
                    for (const part of parts) {
                        if (!part.startsWith('data: ')) continue;
                        
                        try {
                            const event = JSON.parse(part.substring(6));
                            
                            if (event.type === 'status') {
                                assistantBubble.innerHTML = `<span class="italic text-gray-400">${escapeHtml(event.data)}</span>`;
                            } else if (event.type === 'final_result') {
                                finalAnswer = event.data.best_answer;
                                finalDetails = event.data.process_details || [];
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                    
                    chatLog.scrollTop = chatLog.scrollHeight;
                }
            } catch (error) {
                if (error.name === 'AbortError' || error.message.includes('cancel')) {
                    console.log('Stream was cancelled');
                    return;
                }
                throw error;
            }
            
            // 只有在没被停止的情况下才显示最终结果
            if (isGenerating) {
                assistantBubble.innerHTML = markdownToHtml(finalAnswer);
                conversationHistory.push({ role: 'assistant', content: finalAnswer });
                
                // 添加操作按钮
                if (finalDetails.length > 0) {
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'action-buttons';
                    actionsDiv.innerHTML = `
                        <button class="action-btn view-details-btn">查看详情</button>
                        <button class="action-btn regen-btn">重新生成</button>
                    `;
                    chatLog.appendChild(actionsDiv);
                    
                    actionsDiv.querySelector('.view-details-btn').addEventListener('click', () => {
                        renderProcessDetails(finalDetails);
                        detailsModal.classList.add('active');
                    });
                    
                    actionsDiv.querySelector('.regen-btn').addEventListener('click', () => {
                        conversationHistory.pop();
                        conversationHistory.pop();
                        chatLog.removeChild(assistantBubble);
                        chatLog.removeChild(actionsDiv);
                        chatLog.removeChild(userBubble);
                        questionInput.value = question;
                        handleSubmission();
                    });
                }
            }
            
        } catch (error) {
            console.error('Submission error:', error);
            if (isGenerating) {
                assistantBubble.innerHTML = `<span class="text-red-400">错误: ${error.message}</span>`;
            }
        } finally {
            currentReader = null;
            toggleLoading(false);
            chatLog.scrollTop = chatLog.scrollHeight;
        }
    }
    
    // === 渲染详情 ===
    function renderProcessDetails(details) {
        processDetailsContainer.innerHTML = "";
        
        if (!details || details.length === 0) {
            processDetailsContainer.innerHTML = '<p class="text-gray-500">没有详细过程信息。</p>';
            return;
        }
        
        details.forEach(detail => {
            const wrapper = document.createElement('div');
            wrapper.className = 'bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4 collapse-wrapper';
            
            const scoreClass = detail.total_score >= 10 ? 'text-green-400' : 
                              detail.total_score >= 7 ? 'text-yellow-400' : 'text-red-400';
            
            let critiquesHtml = '<p class="text-xs text-gray-500">没有收到有效的评审意见。</p>';
            if (detail.critiques_received && detail.critiques_received.length > 0) {
                critiquesHtml = detail.critiques_received.map(c => `
                    <div class="mt-2 p-3 bg-gray-700/50 rounded-md">
                        <p class="text-sm">
                            <strong>评审员:</strong> ${escapeHtml(c.critic_name)} | 
                            <strong class="ml-2">总分:</strong> ${c.score}/12
                        </p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <span class="dimension-score score-${c.accuracy || 0}">准确性: ${c.accuracy || 0}/3</span>
                            <span class="dimension-score score-${c.completeness || 0}">完整性: ${c.completeness || 0}/3</span>
                            <span class="dimension-score score-${c.clarity || 0}">清晰性: ${c.clarity || 0}/3</span>
                            <span class="dimension-score score-${c.usefulness || 0}">实用性: ${c.usefulness || 0}/3</span>
                        </div>
                        <p class="text-xs mt-2"><strong>评语:</strong> ${escapeHtml(c.comment || 'N/A')}</p>
                    </div>
                `).join('');
            }
            
            wrapper.innerHTML = `
                <div class="flex justify-between items-center cursor-pointer collapsible-header">
                    <h3 class="text-lg font-bold text-cyan-400">${escapeHtml(detail.model_name)}</h3>
                    <span class="text-md font-semibold ${scoreClass}">总分: ${detail.total_score.toFixed(1)}/12</span>
                </div>
                <div class="collapsible-content mt-3 border-t border-gray-600 pt-3 text-gray-300 text-sm">
                    <div class="mb-4">
                        <h4 class="font-semibold mb-1 text-gray-400">1. 初始答案</h4>
                        <div class="p-3 bg-gray-900/40 rounded prose prose-invert max-w-none text-sm">
                            ${markdownToHtml(detail.initial_answer)}
                        </div>
                    </div>
                    <div class="mb-4">
                        <h4 class="font-semibold mb-1 text-gray-400">2. 收到的评审</h4>
                        ${critiquesHtml}
                    </div>
                    <div>
                        <h4 class="font-semibold mb-1 text-gray-400">3. 修正后答案</h4>
                        <div class="p-3 bg-gray-900/40 rounded prose prose-invert max-w-none text-sm">
                            ${markdownToHtml(detail.revised_answer)}
                        </div>
                    </div>
                </div>
            `;
            
            wrapper.querySelector('.collapsible-header').addEventListener('click', (e) => {
                e.currentTarget.parentElement.classList.toggle('open');
            });
            
            processDetailsContainer.appendChild(wrapper);
        });
    }
    
    // === 全局事件监听 ===
    submitBtn.addEventListener('click', handleSubmission);
    stopBtn.addEventListener('click', stopGeneration);
    
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmission();
        }
    });
    
    questionInput.addEventListener('input', () => {
        questionInput.style.height = 'auto';
        questionInput.style.height = `${questionInput.scrollHeight}px`;
    });
    
    newChatBtn.addEventListener('click', () => {
        if (confirm('确定要开始新对话吗？当前对话记录将被清除。')) {
            conversationHistory = [];
            chatLog.innerHTML = '';
            console.log('New chat started');
        }
    });
    
    closeModalBtn.addEventListener('click', () => {
        detailsModal.classList.remove('active');
    });
    
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            detailsModal.classList.remove('active');
        }
    });
    
    // === 初始化 ===
    loadAndRenderAll();
    console.log('Initialization complete v16.0.0');
});


