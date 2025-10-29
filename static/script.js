/*
 * static/script.js
 * Version: 17.0.0 - 强制缓存更新 + 提示词管理功能
 * 更新时间: 2025-01-26 20:30:00
 * Copyright (c) 2025 AI-Peer-Review-Platform. All rights reserved.
 */

// 初始化日志记录
const log = {
    info: (message) => {
        if (window.DEBUG) {
            // 使用自定义日志输出而不是 console
            const logElement = document.getElementById('debug-log') || createDebugLogElement();
            const timestamp = new Date().toISOString();
            logElement.innerHTML += `<div class="log-entry info">[${timestamp}] [INFO] ${message}</div>`;
            logElement.scrollTop = logElement.scrollHeight;
        }
    },
    error: (message) => {
        // 错误日志总是显示
        const logElement = document.getElementById('debug-log') || createDebugLogElement();
        const timestamp = new Date().toISOString();
        logElement.innerHTML += `<div class="log-entry error">[${timestamp}] [ERROR] ${message}</div>`;
        logElement.scrollTop = logElement.scrollHeight;
    },
    warn: (message) => {
        // 警告日志总是显示
        const logElement = document.getElementById('debug-log') || createDebugLogElement();
        const timestamp = new Date().toISOString();
        logElement.innerHTML += `<div class="log-entry warn">[${timestamp}] [WARN] ${message}</div>`;
        logElement.scrollTop = logElement.scrollHeight;
    }
};

// 创建调试日志元素
function createDebugLogElement() {
    const logElement = document.createElement('div');
    logElement.id = 'debug-log';
    logElement.className = 'fixed bottom-4 left-4 w-96 h-48 bg-gray-900 text-white text-xs p-2 overflow-y-auto border border-gray-600 rounded z-50 hidden';
    logElement.style.fontFamily = 'monospace';
    document.body.appendChild(logElement);
    return logElement;
}

// 通知系统
const notification = {
    show: (message, type = 'info', duration = 3000) => {
        const notificationElement = document.createElement('div');
        notificationElement.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;

        const typeClasses = {
            success: 'bg-green-600 text-white',
            error: 'bg-red-600 text-white',
            warning: 'bg-yellow-600 text-white',
            info: 'bg-blue-600 text-white',
        };

        notificationElement.className += ` ${typeClasses[type] || typeClasses.info}`;
        notificationElement.textContent = message;

        document.body.appendChild(notificationElement);

        // 动画显示
        setTimeout(() => {
            notificationElement.classList.remove('translate-x-full');
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            notificationElement.classList.add('translate-x-full');
            setTimeout(() => {
                if (notificationElement.parentNode) {
                    notificationElement.parentNode.removeChild(notificationElement);
                }
            }, 300);
        }, duration);
    },

    success: (message) => notification.show(message, 'success'),
    error: (message) => notification.show(message, 'error', 5000),
    warning: (message) => notification.show(message, 'warning'),
    info: (message) => notification.show(message, 'info'),
};

// 确认对话框系统
const confirmDialog = {
    show: (message, title = '确认') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
            
            const dialog = document.createElement('div');
            dialog.className = 'bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl';
            
            dialog.innerHTML = `
                <h3 class="text-lg font-semibold text-white mb-4">${title}</h3>
                <p class="text-gray-300 mb-6">${message}</p>
                <div class="flex gap-3 justify-end">
                    <button class="cancel-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors">
                        取消
                    </button>
                    <button class="confirm-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                        确认
                    </button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const confirmBtn = dialog.querySelector('.confirm-btn');
            
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    },
};

// 输入对话框系统
const inputDialog = {
    show: (message, defaultValue = '', title = '输入') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
            
            const dialog = document.createElement('div');
            dialog.className = 'bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl';
            
            dialog.innerHTML = `
                <h3 class="text-lg font-semibold text-white mb-4">${title}</h3>
                <p class="text-gray-300 mb-4">${message}</p>
                <input type="text" class="input-field w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none" value="${defaultValue}">
                <div class="flex gap-3 justify-end mt-6">
                    <button class="cancel-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors">
                        取消
                    </button>
                    <button class="confirm-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                        确认
                    </button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            const inputField = dialog.querySelector('.input-field');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const confirmBtn = dialog.querySelector('.confirm-btn');
            
            // 自动聚焦并选中文本
            inputField.focus();
            inputField.select();
            
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(inputField.value);
            });
            
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    cleanup();
                    resolve(inputField.value);
                } else if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            });
        });
    },
};

log.info('Script v17.0.0 loaded - Timestamp: 2025-01-26-20:30:00');
log.info('Prompt Management Feature Enabled');
log.info('Tab Switching Feature Enabled');

document.addEventListener('DOMContentLoaded', () => {
    log.info('DOM loaded, initializing v16.0.0...');
    
    const API_BASE_URL = window.location.origin;
    let conversationHistory = [];
    let currentReader = null;
    let isGenerating = false;
    let pendingOcrText = null;
    let selectedImageFile = null;
    
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
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIconSun = document.getElementById('theme-icon-sun');
    const themeIconMoon = document.getElementById('theme-icon-moon');
    const themeText = document.getElementById('theme-text');
    const imageInput = document.getElementById('image-input');
    const ocrModelSelect = document.getElementById('ocr-model-select');
    const ocrBtn = document.getElementById('ocr-btn');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const deleteImageBtn = document.getElementById('delete-image-btn');
    const uploadLabel = document.getElementById('upload-label');
    
    log.info('Elements loaded:', { 
        submitBtn: !!submitBtn,
        stopBtn: !!stopBtn,
        questionInput: !!questionInput,
        promptListDiv: !!promptListDiv,
        addPromptForm: !!addPromptForm,
        imagePreview: !!imagePreview
    });
    
    // 检查标签页按钮是否存在
    const tabButtons = document.querySelectorAll('.tab-btn');
    log.info(`Tab buttons found: ${tabButtons.length}`);
    tabButtons.forEach((btn, index) => {
        log.info(`Tab button ${index}: ${btn.dataset.tab} - ${btn.textContent.trim()}`);
    });
    
    // === 标签页切换 ===
    document.querySelectorAll('.tab-btn').forEach(btn => {
        log.info(`Adding click listener to tab: ${btn.dataset.tab}`);
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            log.info(`Tab clicked: ${tabName}`);
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                log.info(`Removing active from: ${content.id}`);
                content.classList.remove('active');
            });
        
            const targetTab = document.getElementById(`${tabName}-tab`);
            if (targetTab) {
                targetTab.classList.add('active');
                log.info(`Tab activated: ${tabName}, Display: ${window.getComputedStyle(targetTab).display}`);
            } else {
                log.error(`Tab not found: ${tabName}-tab`);
            }
        });
    });

    // === 辅助函数 ===
    function markdownToHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 p-2 rounded-md my-2 text-sm overflow-x-auto"><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-900 px-1 rounded-sm">$1</code>')
            .replace(/\n/g, '<br>');
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
        log.info('Stop button clicked');
        
        if (currentReader) {
            try {
                currentReader.cancel('User requested stop');
                log.info('Stream cancelled');
            } catch (e) {
                log.error(`Cancel error: ${e}`);
            }
            currentReader = null;
        }
        
        isGenerating = false;
        toggleLoading(false);
        
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
            log.error(`Failed to load prompts: ${error}`);
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
                notification.success('提示词已激活！');
            }
        } catch (error) {
            log.error(`Failed to activate prompt: ${error}`);
            notification.error('激活失败');
        }
    };
    
    window.editPrompt = async function(promptId) {
        const prompts = await (await fetch(`${API_BASE_URL}/api/prompts`)).json();
        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt) return;
        
        const name = await inputDialog.show('提示词名称:', prompt.name, '编辑提示词');
        if (!name) return;
        
        const critiquePrompt = await inputDialog.show('评审提示词 (使用{question}、{target}、{answer}作为占位符):', prompt.critique_prompt, '编辑评审提示词');
        if (!critiquePrompt) return;
        
        const revisionPrompt = await inputDialog.show('修订提示词 (使用{original}、{feedback}作为占位符):', prompt.revision_prompt, '编辑修订提示词');
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
                notification.success('更新成功！');
            }
        } catch (error) {
            log.error(`Failed to update prompt: ${error}`);
            notification.error('更新失败');
        }
    };
    
    window.deletePrompt = async function(promptId) {
        const confirmed = await confirmDialog.show('确定要删除这个提示词吗？', '删除提示词');
        if (!confirmed) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                await loadPrompts();
                notification.success('删除成功！');
            } else {
                const error = await response.json();
                notification.error(error.detail || '删除失败');
            }
        } catch (error) {
            log.error(`Failed to delete prompt: ${error}`);
            notification.error('删除失败');
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
                notification.success('提示词添加成功！');
                addPromptForm.reset();
                await loadPrompts();
            } else {
                const error = await response.json();
                notification.error(error.detail || '添加失败');
            }
        } catch (error) {
            log.error(`Failed to add prompt: ${error}`);
            notification.error('添加失败，请检查网络连接');
        }
    });
    
    // === 渲染服务商列表（可展开编辑） ===
    function renderProviderList(providers) {
        log.info(`Rendering provider list, count: ${providers.length}`);
        providerListDiv.innerHTML = '';
        
        if (providers.length === 0) {
            providerListDiv.innerHTML = '<p class="text-xs text-gray-500 p-2">尚未添加任何服务商</p>';
            return;
        }
        
        providers.forEach((provider, index) => {
            log.info(`Creating provider card ${index + 1}: ${provider.name}`);
            const wrapper = createProviderCard(provider);
            providerListDiv.appendChild(wrapper);
        });
    }

    function createProviderCard(provider) {
        const wrapper = document.createElement('div');
        wrapper.className = 'provider-item bg-gray-700/50 rounded-lg mb-2';
        
        const header = createProviderHeader(provider);
        const form = createProviderForm(provider);
        
        wrapper.appendChild(header);
        wrapper.appendChild(form);
        
        setupProviderEventListeners(header, form, provider);
        
        return wrapper;
    }

    function createProviderHeader(provider) {
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center p-2 cursor-pointer hover:bg-gray-600/50 transition-colors rounded-t-lg';
        header.innerHTML = `
            <div>
                <span class="font-semibold text-sm text-cyan-400">${escapeHtml(provider.name)}</span>
                <span class="text-xs text-gray-400 ml-2">(${provider.type})</span>
            </div>
            <span class="text-gray-500 text-xs transition-transform arrow-icon">编辑 ▼</span>
        `;
        return header;
    }

    function createProviderForm(provider) {
        const form = document.createElement('form');
        form.className = 'edit-form hidden p-3 border-t border-gray-600 space-y-2';
        form.innerHTML = `
            <input name="name" value="${escapeHtml(provider.name)}" class="form-input text-sm bg-gray-600 cursor-not-allowed" readonly title="名称不可修改">
            <select name="type" class="form-input text-sm">
                <option value="OpenAI" ${provider.type === 'OpenAI' ? 'selected' : ''}>OpenAI 兼容型</option>
                <option value="Gemini" ${provider.type === 'Gemini' ? 'selected' : ''}>Google Gemini</option>
            </select>
            <input name="api_key" type="password" value="" class="form-input text-sm" placeholder="保持不变或输入新密钥">
            <input name="api_base" value="${escapeHtml(provider.api_base || '')}" class="form-input text-sm" placeholder="API Base URL (OpenAI型必填)">
            <input name="models" required value="${escapeHtml(provider.original_models)}" class="form-input text-sm" placeholder="模型列表 (逗号分隔)">
            <div class="flex space-x-2 pt-1">
                <button type="submit" class="font-bold py-1 px-3 text-sm rounded-md bg-blue-600 hover:bg-blue-700 flex-1 transition-colors">保存</button>
                <button type="button" class="delete-btn font-bold py-1 px-3 text-sm rounded-md bg-red-700 hover:bg-red-600">删除</button>
            </div>
        `;
        return form;
    }

    function setupProviderEventListeners(header, form, provider) {
        // 头部点击事件
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
        
        // 删除按钮事件
        const deleteBtn = form.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => handleProviderDelete(provider));
        
        // 表单提交事件
        form.addEventListener('submit', (e) => handleProviderUpdate(e, provider));
    }

    async function handleProviderDelete(provider) {
        const confirmed = await confirmDialog.show(`确定要删除服务商 '${provider.name}' 吗？`, '删除服务商');
        if (!confirmed) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/providers/${encodeURIComponent(provider.name)}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '删除失败');
            }
            
            await loadAndRenderAll();
        } catch (error) {
            log.error(`Delete error: ${error}`);
            notification.error(`错误: ${error.message}`);
        }
    }

    async function handleProviderUpdate(e, provider) {
        e.preventDefault();
        e.stopPropagation();
        
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = '处理中...';
        submitButton.disabled = true;
        
        try {
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                type: formData.get('type'),
                api_base: formData.get('api_base') || '',
                models: formData.get('models'),
            };
            
            const apiKey = formData.get('api_key');
            if (apiKey && apiKey.trim() !== '') {
                data.api_key = apiKey.trim();
            }
            
            const response = await fetch(`${API_BASE_URL}/api/providers/${encodeURIComponent(provider.name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '修改失败');
            }
            
            await loadAndRenderAll();
        } catch (error) {
            log.error(`Update error: ${error}`);
            notification.error(`错误: ${error.message}`);
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }
    
    // === 渲染模型选择列表 ===
    function renderModelSelection(providers) {
        modelListContainer.innerHTML = '';
        
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

    // === 渲染 OCR 模型下拉 ===
    function renderOcrModelOptions(providers) {
        if (!ocrModelSelect) return;
        const options = ['<option value="">选择OCR模型</option>'];
        providers.forEach(provider => {
            const models = (provider.original_models || '').split(',').map(m => m.trim()).filter(Boolean);
            models.forEach(modelName => {
                const id = `${provider.name}::${modelName}`;
                options.push(`<option value="${escapeHtml(id)}">${escapeHtml(provider.name)} - ${escapeHtml(modelName)}</option>`);
            });
        });
        ocrModelSelect.innerHTML = options.join('');
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
                log.error(`Add provider error: ${error}`);
                notification.error(`错误: ${error.message}`);
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
            renderOcrModelOptions(providers);
        } catch (error) {
            log.error(`Load error: ${error}`);
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
            log.info('Already generating, ignoring submit');
            return;
        }
        
        const question = questionInput.value.trim();
        if (!question) return;
        
        const selectedModels = getSelectedModels();
        if (selectedModels.length === 0) {
            notification.warning('请至少选择一个模型！');
            return;
        }
        
        const userBubble = createUserBubble(question);
        const assistantBubble = createAssistantBubble();
        
        setupSubmission(question);
        
        try {
            await processQuery(question, selectedModels, assistantBubble, userBubble);
        } catch (error) {
            handleSubmissionError(error, assistantBubble);
        } finally {
            cleanupSubmission();
        }
    }
    
    function getSelectedModels() {
        return Array.from(document.querySelectorAll('.model-checkbox:checked'))
            .map(cb => cb.value);
    }
    
    function createUserBubble(question) {
        const userBubble = document.createElement('div');
        userBubble.className = 'chat-bubble user-bubble mt-8';
        userBubble.textContent = question;
        chatLog.appendChild(userBubble);
        return userBubble;
    }
    
    function createAssistantBubble() {
        const assistantBubble = document.createElement('div');
        assistantBubble.className = 'chat-bubble assistant-bubble mt-4';
        assistantBubble.innerHTML = '<span class="italic text-gray-400">正在连接服务器...</span>';
        chatLog.appendChild(assistantBubble);
        chatLog.scrollTop = chatLog.scrollHeight;
        return assistantBubble;
    }
    
    function setupSubmission(question) {
        conversationHistory.push({ role: 'user', content: question });
        questionInput.value = '';
        toggleLoading(true);
    }
    
    async function processQuery(question, selectedModels, assistantBubble, userBubble) {
            const response = await fetch(`${API_BASE_URL}/api/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    selected_models: selectedModels,
                    history: conversationHistory.slice(0, -1),
                    ocr_text: pendingOcrText || null
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
        await processStream(response, assistantBubble, userBubble, question);
    }
    
    async function processStream(response, assistantBubble, userBubble, question) {
            currentReader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalAnswer = '';
            let finalDetails = [];
            
            try {
                while (isGenerating) {
                    const { value, done } = await currentReader.read();
                    
                    if (done) {
                    log.info('Stream complete');
                        break;
                    }
                    
                const result = processStreamChunk(value, decoder, buffer, assistantBubble);
                buffer = result.buffer;
                if (result.finalAnswer) finalAnswer = result.finalAnswer;
                if (result.finalDetails) finalDetails = result.finalDetails;
                
                chatLog.scrollTop = chatLog.scrollHeight;
            }
        } catch (error) {
            if (error.name === 'AbortError' || error.message.includes('cancel')) {
                log.info('Stream was cancelled');
                return;
            }
            throw error;
        }
        
        if (isGenerating && finalAnswer) {
            displayFinalResult(assistantBubble, finalAnswer, finalDetails, userBubble, question);
        }
    }
    
    function processStreamChunk(value, decoder, buffer, assistantBubble) {
                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
        const newBuffer = parts.pop() || '';
        let finalAnswer = '';
        let finalDetails = [];
                    
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
                log.error(`Parse error: ${e}`);
            }
        }
        
        return { buffer: newBuffer, finalAnswer, finalDetails };
    }
    
    function displayFinalResult(assistantBubble, finalAnswer, finalDetails, userBubble, question) {
                assistantBubble.innerHTML = markdownToHtml(finalAnswer);
                conversationHistory.push({ role: 'assistant', content: finalAnswer });
                
                if (finalDetails.length > 0) {
            createActionButtons(finalDetails, assistantBubble, userBubble, question);
        }
    }
    
    function createActionButtons(finalDetails, assistantBubble, userBubble, question) {
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
            
    function handleSubmissionError(error, assistantBubble) {
        log.error(`Submission error: ${error}`);
            if (isGenerating) {
                assistantBubble.innerHTML = `<span class="text-red-400">错误: ${error.message}</span>`;
            }
    }
    
    function cleanupSubmission() {
            currentReader = null;
            toggleLoading(false);
            chatLog.scrollTop = chatLog.scrollHeight;
            pendingOcrText = null;
            clearImageSelection();
    }

    // === 图片处理函数 ===
    function handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            notification.warning('请选择一个图片文件。');
            return;
        }
        selectedImageFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.classList.remove('hidden');
            uploadLabel.classList.add('hidden'); // 隐藏上传按钮
        };
        reader.readAsDataURL(file);
        
        log.info(`选中图片: ${file.name}, ${file.type}, ${file.size}`);
    }

    function clearImageSelection() {
        selectedImageFile = null;
        imageInput.value = ''; // 重置 file input
        imagePreview.src = '';
        imagePreviewContainer.classList.add('hidden');
        uploadLabel.classList.remove('hidden'); // 恢复上传按钮
        log.info('图片已清除');
    }

    // === OCR 处理逻辑 ===
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                handleImageFile(file);
            }
        });
    }

    if (deleteImageBtn) {
        deleteImageBtn.addEventListener('click', clearImageSelection);
    }

    // 粘贴图片逻辑
    if (questionInput) {
        questionInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || window.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        handleImageFile(blob);
                        e.preventDefault(); // 阻止默认的粘贴行为
                        break;
                    }
                }
            }
        });
    }

    async function uploadAndRecognizeImage() {
        if (!selectedImageFile) {
            notification.warning('请先选择一张图片');
            return;
        }
        const ocrModel = ocrModelSelect ? ocrModelSelect.value : '';
        if (!ocrModel) {
            notification.warning('请选择一个OCR模型');
            return;
        }
        try {
            ocrBtn && (ocrBtn.disabled = true);
            ocrBtn && (ocrBtn.textContent = '识别中...');
            const form = new FormData();
            form.append('file', selectedImageFile);
            form.append('ocr_model', ocrModel);
            const resp = await fetch(`${API_BASE_URL}/api/ocr`, { method: 'POST', body: form });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${resp.status}`);
            }
            const data = await resp.json();
            pendingOcrText = (data && data.ocr_text) ? String(data.ocr_text) : '';
            if (pendingOcrText) {
                notification.success('图片识别完成，结果已加入上下文');
            } else {
                notification.warning('未识别到文字或结果为空');
            }
        } catch (e) {
            log.error(`OCR error: ${e}`);
            notification.error(`OCR 失败: ${e.message}`);
        } finally {
            if (ocrBtn) {
                ocrBtn.disabled = false;
                ocrBtn.textContent = '识别图片';
            }
        }
    }

    if (ocrBtn) {
        ocrBtn.addEventListener('click', (e) => {
            e.preventDefault();
            uploadAndRecognizeImage();
        });
    }
    
    // === 渲染详情 ===
    function renderProcessDetails(details) {
        processDetailsContainer.innerHTML = '';
        
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
    
    newChatBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog.show('确定要开始新对话吗？当前对话记录将被清除。', '新对话');
        if (confirmed) {
            conversationHistory = [];
            chatLog.innerHTML = '';
            log.info('New chat started');
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

    // === 侧边栏和主题切换 ===
    function applyTheme(theme) {
        const isDark = theme === 'dark';
        // 同步设置到 <html> 和 <body>，确保 Tailwind 和自定义样式都能匹配到 .dark 祖先
        document.documentElement.classList.toggle('dark', isDark);
        if (document.body) document.body.classList.toggle('dark', isDark);
        if (themeIconSun) themeIconSun.classList.toggle('hidden', isDark);
        if (themeIconMoon) themeIconMoon.classList.toggle('hidden', !isDark);
    // 显示当前主题文字（暗色/亮色）
    if (themeText) themeText.textContent = isDark ? '暗色' : '亮色';
        // 诊断日志（可帮助排查主题未变化的问题）
        log.info(`[theme] applied: ${theme}, htmlHasDark: ${document.documentElement.classList.contains('dark')}, bodyHasDark: ${document.body ? document.body.classList.contains('dark') : false}`);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    function updateSidebarTogglePosition() {
        if (!sidebar || !sidebarToggle) return;
        const collapsed = sidebar.classList.contains('collapsed');
        if (collapsed) {
            sidebarToggle.style.left = '0.75rem';
            if (sidebarToggleIcon) {
                sidebarToggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
            }
        } else {
            const width = sidebar.getBoundingClientRect().width;
            const offset = Math.max(width - 24, 16);
            sidebarToggle.style.left = `${offset}px`;
            if (sidebarToggleIcon) {
                sidebarToggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>';
            }
        }
    }

    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            updateSidebarTogglePosition();
        });
        updateSidebarTogglePosition();
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => updateSidebarTogglePosition());
            observer.observe(sidebar);
        } else {
            window.addEventListener('resize', updateSidebarTogglePosition);
        }
    } else if (sidebarToggle) {
        sidebarToggle.classList.add('hidden');
    }
    
    // === 初始化 ===
    // 主题初始化
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    
    loadAndRenderAll();
    log.info('Initialization complete v17.0.0');
});


