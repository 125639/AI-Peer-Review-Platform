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
        if (typeof document !== 'undefined') {
            const logElement = document.getElementById('debug-log') || createDebugLogElement();
            const timestamp = new Date().toISOString();
            logElement.innerHTML += `<div class="log-entry error">[${timestamp}] [ERROR] ${message}</div>`;
            logElement.scrollTop = logElement.scrollHeight;
        }
    },
    warn: (message) => {
        // 警告日志总是显示
        if (typeof document !== 'undefined') {
            const logElement = document.getElementById('debug-log') || createDebugLogElement();
            const timestamp = new Date().toISOString();
            logElement.innerHTML += `<div class="log-entry warn">[${timestamp}] [WARN] ${message}</div>`;
            logElement.scrollTop = logElement.scrollHeight;
        }
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

// 确认对话框
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
                    <button class="cancel-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors">取消</button>
                    <button class="confirm-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">确认</button>
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

// 输入对话框
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
                    <button class="cancel-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors">取消</button>
                    <button class="confirm-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">确认</button>
                </div>
            `;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const inputField = dialog.querySelector('.input-field');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const confirmBtn = dialog.querySelector('.confirm-btn');
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

// 1. 改写多语言字典并加入全部UI文本
const i18nDict = {
    zh: {
        settings_title: "界面设置",
        lang_title: "语言设置",
        lang_zh: "简体中文",
        lang_en: "English",
        ocr_model_title: "图片文字识别模型",
        ocr_model_tip: "选择用于识别图片文字的模型（仅显示支持图片的模型）",
        wallpaper_title: "壁纸设置",
        upload_wallpaper_btn: "上传壁纸",
        wallpaper_opacity: "透明度",
        wallpaper_brightness: "亮度",
        reset_wallpaper_btn: "重置壁纸",
        tab_models: "模型配置",
        tab_prompts: "提示词管理",
        tab_settings: "设置",
        add: "添加",
        save: "保存",
        delete: "删除",
        edit: "编辑",
        enable: "启用",
        current_in_use: "✓ 当前使用",
        review_prompt_list: "提示词模板",
        add_new_prompt: "添加新提示词",
        prompt_name: "提示词名称",
        review_instruction: "评审提示词（使用{question}、{target}、{answer}作为占位符）",
        review_placeholder: "评审提示词...",
        revise_instruction: "修订提示词（使用{original}、{feedback}作为占位符）",
        revise_placeholder: "修订提示词...",
        add_provider: "添加新服务商",
        provider_list: "服务商列表",
        select_provider_type: "选择服务商类型",
        openai_compatible: "OpenAI 兼容型",
        gemini: "Google Gemini",
        add_btn: "添加",
        api_key: "API Key",
        api_base: "API Base URL (OpenAI型必填)",
        model_list: "模型列表 (逗号分隔)",
        model_select_label: "选择参战模型",
        select_ocr_model: "选择OCR模型",
        upload_image: "上传图片",
        recognize: "识别图片",
        input_placeholder: "输入您的问题，或粘贴图片...",
        stop: "停止",
        new_chat: "开始新对话",
        loading: "正在连接服务器...",
        view_detail: "查看详情",
        regen: "重新生成",
        enable_success: "提示词已激活！",
        enable_failed: "激活失败",
        update_success: "更新成功！",
        update_failed: "更新失败",
        delete_confirm: "确定要删除这个提示词吗？",
        delete_provider_confirm: "确定要删除服务商 '{name}' 吗？",
        delete_success: "删除成功！",
        delete_failed: "删除失败",
        prompt_add_success: "提示词添加成功！",
        prompt_add_failed: "添加失败",
        network_failed: "添加失败，请检查网络连接",
        load_failed: "无法从服务器获取数据",
        processing: "处理中...",
        bulk_ocr_title: "批量图片文字识别",
        bulk_ocr_btn: "识别所选图片",
        bulk_ocr_clear: "清空结果",
        bulk_ocr_tip: "将使用已配置的第一个模型，对多张图片批量识别并汇总到下方文本框。",
        bulk_ocr_placeholder: "批量OCR结果会出现在这里……",
        // ...更多如有
    },
    en: {
        settings_title: "UI Settings",
        lang_title: "Language",
        lang_zh: "简体中文",
        lang_en: "English",
        ocr_model_title: "OCR Model",
        ocr_model_tip: "Select the model for image text recognition (only vision models shown)",
        wallpaper_title: "Wallpaper",
        upload_wallpaper_btn: "Upload Wallpaper",
        wallpaper_opacity: "Opacity",
        wallpaper_brightness: "Brightness",
        reset_wallpaper_btn: "Reset Wallpaper",
        tab_models: "Models",
        tab_prompts: "Prompts",
        tab_settings: "Settings",
        add: "Add",
        save: "Save",
        delete: "Delete",
        edit: "Edit",
        enable: "Enable",
        current_in_use: "✓ In Use",
        review_prompt_list: "Prompt List",
        add_new_prompt: "Add Prompt",
        prompt_name: "Prompt Name",
        review_instruction: "Review instruction (use {question}, {target}, {answer} as placeholders)",
        review_placeholder: "Review prompt...",
        revise_instruction: "Revise instruction (use {original}, {feedback} as placeholders)",
        revise_placeholder: "Revise prompt...",
        add_provider: "Add Provider",
        provider_list: "Provider List",
        select_provider_type: "Provider Type",
        openai_compatible: "OpenAI Compatible",
        gemini: "Google Gemini",
        add_btn: "Add",
        api_key: "API Key",
        api_base: "API Base URL (Required for OpenAI)",
        model_list: "Model List (comma-separated)",
        model_select_label: "Select Models",
        select_ocr_model: "Select OCR Model",
        upload_image: "Upload Image",
        recognize: "Recognize",
        input_placeholder: "Type your question, or paste an image...",
        stop: "Stop",
        new_chat: "New Chat",
        loading: "Connecting to server...",
        view_detail: "Details",
        regen: "Regenerate",
        enable_success: "Prompt enabled!",
        enable_failed: "Enable failed",
        update_success: "Updated successfully!",
        update_failed: "Update failed",
        delete_confirm: "Are you sure to delete this prompt?",
        delete_provider_confirm: "Are you sure to delete provider '{name}'?",
        delete_success: "Deleted!",
        delete_failed: "Delete failed",
        prompt_add_success: "Prompt added successfully!",
        prompt_add_failed: "Add failed",
        network_failed: "Add failed, please check network connection",
        load_failed: "Unable to fetch data from server",
        processing: "Processing...",
        bulk_ocr_title: "Batch Image OCR",
        bulk_ocr_btn: "Recognize Selected Images",
        bulk_ocr_clear: "Clear",
        bulk_ocr_tip: "Use the first configured model to recognize multiple images, and append results here.",
        bulk_ocr_placeholder: "Batch OCR results will appear here...",
        // ...more as needed
    }
};

function getLang() {
    return window.currentLang || localStorage.getItem('ui-lang') || 'zh';
}

function getI18n(key, params) {
    const lang = getLang();
    let text = (i18nDict[lang] && i18nDict[lang][key]) || key;
    if(params) {
        Object.keys(params).forEach(k=>{
            text = text.replace(new RegExp(`\{${k}\}`,'g'), params[k]);
        });
    }
    return text;
}

// 2. 增加刷新所有 i18n 标签/placeholder/option 的辅助函数
function refreshAllI18n() {
    const lang = window.currentLang || localStorage.getItem('ui-lang') || 'zh';
    // 通用文本
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && i18nDict[lang][key]) el.textContent = i18nDict[lang][key];
    });
    // placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && i18nDict[lang][key]) el.setAttribute('placeholder', i18nDict[lang][key]);
    });
    // 按钮
    document.querySelectorAll('[data-i18n-btn]').forEach(el => {
        const key = el.getAttribute('data-i18n-btn');
        if (key && i18nDict[lang][key]) el.textContent = i18nDict[lang][key];
    });
    // option
    document.querySelectorAll('[data-i18n-option]').forEach(el => {
        const key = el.getAttribute('data-i18n-option');
        if (key && i18nDict[lang][key]) el.textContent = i18nDict[lang][key];
    });
}

// 3. setLang里调用 refreshAllI18n 同步刷新
function setLang(lang) {
    window.currentLang = lang;
    localStorage.setItem('ui-lang', lang);
    refreshAllI18n();
    // 选中
    const radios = document.querySelectorAll('input[name="ui-lang"]');
    radios.forEach(r => { r.checked = (r.value === lang); });
    // 占位符/option特殊刷新
    const placeholders = [
        ['add-provider-form input[name="name"]', 'prompt_name'],
        ['add-provider-form input[name="api_key"]', 'api_key'],
        ['add-provider-form input[name="api_base"]', 'api_base'],
        ['add-provider-form input[name="models"]', 'model_list'],
        ['add-prompt-form input[name="name"]', 'prompt_name'],
        ['add-prompt-form textarea[name="critique_prompt"]', 'review_placeholder'],
        ['add-prompt-form textarea[name="revision_prompt"]', 'revise_placeholder'],
        ['#question-input', 'input_placeholder'],
    ];
    placeholders.forEach(([sel, key]) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute('placeholder', getI18n(key));
    });
    // select/option表单
    const sel = document.querySelector('select[name="type"]');
    if (sel) {
        sel.options[0].text = getI18n('select_provider_type');
        sel.options[1].text = getI18n('openai_compatible');
        sel.options[2].text = getI18n('gemini');
    }
    // 按钮
    const btns = [
        ['add-provider-form button[type="submit"]', 'add_btn'],
        ['add-prompt-form button[type="submit"]', 'add_btn'],
        ['#wallpaper-upload-btn', 'upload_wallpaper_btn'],
        ['#wallpaper-reset-btn', 'reset_wallpaper_btn']
    ];
    btns.forEach(([sel,key])=>{
        const el = document.querySelector(sel);
        if(el) el.textContent=getI18n(key);
    });
    // 其它如label等
    // ...可以继续完善
}

// ===== 设置页面语言切换事件监听 =====
document.addEventListener('DOMContentLoaded', () => {
    try {
        log.info('DOM loaded, initializing v17.0.0...');

        // 隐藏调试状态栏，表示JavaScript正常加载
        const debugStatus = document.getElementById('debug-status');
        if (debugStatus) {
            debugStatus.classList.add('hidden');
        }
    
    const API_BASE_URL = window.location.origin;
    let conversationHistory = [];
    let currentReader = null;
    let isGenerating = false;
    let pendingOcrText = null;
    
    // === DOM元素引用（带错误检查）===
    const addProviderForm = document.getElementById('add-provider-form');
    const providerListDiv = document.getElementById('provider-list') || document.getElementById('provider-list-settings');
    const modelListContainer = document.getElementById('model-list-container') || document.getElementById('model-list-settings');
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
    const promptListDiv = document.getElementById('prompt-list') || document.getElementById('prompt-list-settings');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleSettings = document.getElementById('theme-toggle-settings');
    const themeIconSun = document.getElementById('theme-icon-sun');
    const themeIconMoon = document.getElementById('theme-icon-moon');
    const themeText = document.getElementById('theme-text');
    
    // 检查关键元素是否存在
    const criticalElements = [
        'sidebar', 'questionInput', 'submitBtn', 'chatLog'
    ];
    
    const missingElements = criticalElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        log.error(`Critical elements missing: ${missingElements.join(', ')}`);
    }
    
    log.info('Elements loaded:', { 
        submitBtn: !!submitBtn,
        stopBtn: !!stopBtn,
        questionInput: !!questionInput,
        promptListDiv: !!promptListDiv,
        addPromptForm: !!addPromptForm
    });

    // 导出若干关键 DOM 引用到全局，供内联脚本或其他模块访问
    // 这样可以避免 index.html 中的内联脚本在不同作用域下引用未定义变量导致的错误
    try {
        window.chatLog = chatLog;
        window.questionInput = questionInput;
        window.submitBtn = submitBtn;
        window.stopBtn = stopBtn;
        window.newChatBtn = newChatBtn;
    } catch (e) {
        log.warn('Failed to attach globals: ' + e.message);
    }

    log.info('Initialization completed successfully');

    } catch (error) {
        log.error('Critical initialization error: ' + error.message);
        console.error('Critical initialization error:', error);

        // 显示错误状态
        const debugStatus = document.getElementById('debug-status');
        if (debugStatus) {
            debugStatus.textContent = 'JavaScript初始化失败: ' + error.message + ' - 请检查控制台获取详细信息';
            debugStatus.classList.remove('hidden');
            debugStatus.classList.remove('bg-red-600');
            debugStatus.classList.add('bg-red-800');
        }
        // 即使有错误也继续执行，不return
    }
    
    try {
    // === 标签页切换 ===
    const tabButtons = document.querySelectorAll('.tab-btn');
    log.info(`Found ${tabButtons.length} tab buttons`);
    tabButtons.forEach((btn, index) => {
        log.info(`Tab button ${index}: ${btn.dataset.tab} - ${btn.textContent.trim()}`);
    });
    
    if (tabButtons.length === 0) {
        log.error('No tab buttons found! Check HTML structure.');
        return;
    }
    
    tabButtons.forEach((btn, index) => {
        const tabName = btn.dataset.tab;
        log.info(`Adding click listener to tab ${index + 1}: ${tabName}`);
        
        if (!tabName) {
            log.error(`Tab button ${index + 1} missing data-tab attribute`);
            return;
        }
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            log.info(`Tab clicked: ${tabName}`);
            
            try {
                // 移除所有按钮的active类
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 移除所有内容的active类
                document.querySelectorAll('.tab-content').forEach(content => {
                    log.info(`Removing active from: ${content.id}`);
                    content.classList.remove('active');
                });
            
                // 激活目标标签页
                const targetTab = document.getElementById(`${tabName}-tab`);
                if (targetTab) {
                    targetTab.classList.add('active');
                    log.info(`Tab activated: ${tabName}, Display: ${window.getComputedStyle(targetTab).display}`);
                    
                    // 特殊处理设置标签页
                    if (tabName === 'settings') {
                        log.info('Settings tab activated, checking OCR elements...');
                        setTimeout(() => {
                            const ocrSetting = document.getElementById('ocr-model-setting');
                            const ocrSelect = document.getElementById('ocr-model-select');
                            log.info(`OCR setting element: ${!!ocrSetting}, OCR select: ${!!ocrSelect}`);
                        }, 100);
                    }
                } else {
                    log.error(`Tab not found: ${tabName}-tab`);
                }
            } catch (error) {
                log.error(`Error switching tabs: ${error.message}`);
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
        const lang = getLang();
        promptListDiv.innerHTML = prompts.map(prompt => `
            <div class="prompt-item${prompt.is_active ? ' active' : ''}" data-id="${prompt.id}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-lg">${escapeHtml(prompt[`name_${lang}`])}</h4>
                        ${prompt.is_active ? `<span class="text-xs text-green-400">${getI18n('current_in_use')}</span>` : ''}
                    </div>
                    <div class="flex gap-2">
                        ${!prompt.is_active ? `<button onclick="activatePrompt(${prompt.id})" class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded">${getI18n('enable')}</button>` : ''}
                        <button onclick="editPrompt(${prompt.id})" class="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded">${getI18n('edit')}</button>
                        <button onclick="deletePrompt(${prompt.id})" class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded">${getI18n('delete')}</button>
                    </div>
                </div>
                <details class="text-sm">
                    <summary class="cursor-pointer text-gray-400 hover:text-gray-300">${getI18n('view_detail')}</summary>
                    <div class="mt-2 space-y-2">
                        <div>
                            <p class="text-gray-400 text-xs mb-1">${getI18n('review_instruction')}</p>
                            <pre class="bg-gray-900 p-2 rounded text-xs overflow-x-auto">${escapeHtml(prompt[`critique_prompt_${lang}`])}</pre>
                        </div>
                        <div>
                            <p class="text-gray-400 text-xs mb-1">${getI18n('revise_instruction')}</p>
                            <pre class="bg-gray-900 p-2 rounded text-xs overflow-x-auto">${escapeHtml(prompt[`revision_prompt_${lang}`])}</pre>
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
                notification.success(getI18n('enable_success'));
            }
        } catch (error) {
            log.error(`Failed to activate prompt: ${error}`);
            notification.error(getI18n('enable_failed'));
        }
    };
    
    window.editPrompt = async function(promptId) {
        const prompts = await (await fetch(`${API_BASE_URL}/api/prompts`)).json();
        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt) return;
        let activeTab = getLang();
        let zh = {
          name: prompt.name_zh,
          critique: prompt.critique_prompt_zh,
          revision: prompt.revision_prompt_zh,
        };
        let en = {
          name: prompt.name_en,
          critique: prompt.critique_prompt_en,
          revision: prompt.revision_prompt_en,
        };
        async function showEditDialog() {
          // tab页
          let tabBtn = `<button type='button' style='margin-bottom:10px' id='promptTabZh'>中文</button><button type='button' id='promptTabEn'>English</button>`;
          let fields = (activeTab==='zh'? zh : en);
          let title = (activeTab==='zh'? '编辑中文提示词' : 'Edit English Prompt');
          const name = await inputDialog.show(`${tabBtn}<br>${getI18n('prompt_name')}:`, fields.name, title);
          if (name === null) return;
          fields.name = name;
          const c = await inputDialog.show((activeTab==='zh'? getI18n('review_instruction'): getI18n('review_instruction','en')), fields.critique, title);
          if (c===null) return;
          fields.critique = c;
          const r = await inputDialog.show((activeTab==='zh'? getI18n('revise_instruction'): getI18n('revise_instruction','en')), fields.revision, title);
          if (r===null) return;
          fields.revision = r;
          // Tab切换事件
          setTimeout(()=>{
            document.getElementById('promptTabZh').onclick = ()=>{ activeTab='zh'; showEditDialog(); };
            document.getElementById('promptTabEn').onclick = ()=>{ activeTab='en'; showEditDialog(); };
          },10);
          // 提交所有字段
          if (activeTab==='zh') {
            // 切换到en再提交，否则先edit英文
            await showEditDialog();
          } else {
            // 提交保存
        try {
              const resp = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name_zh: zh.name, critique_prompt_zh: zh.critique, revision_prompt_zh: zh.revision,
                  name_en: en.name, critique_prompt_en: en.critique, revision_prompt_en: en.revision
                })
            });
              if (resp.ok) {
                await loadPrompts();
                notification.success(getI18n('update_success'));
            }
            } catch {
              notification.error(getI18n('update_failed'));
        }
          }
        }
        await showEditDialog();
    };
    
    window.deletePrompt = async function(promptId) {
        const confirmed = await confirmDialog.show(getI18n('delete_confirm'), getI18n('delete'));
        if (!confirmed) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/prompts/${promptId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                await loadPrompts();
                notification.success(getI18n('delete_success'));
            } else {
                const error = await response.json();
                notification.error(error.detail || getI18n('delete_failed'));
            }
        } catch (error) {
            log.error(`Failed to delete prompt: ${error}`);
            notification.error(getI18n('delete_failed'));
        }
    };
    
    addPromptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let activeTab = getLang();
        let zh = { name:'',critique:'',revision:'' };
        let en = { name:'',critique:'',revision:'' };
        async function showAddDialog() {
          let tabBtn = `<button type='button' style='margin-bottom:10px' id='promptTabZh'>中文</button><button type='button' id='promptTabEn'>English</button>`;
          let fields = (activeTab==='zh'? zh:en);
          let title = (activeTab==='zh'? '新建中文提示词':'New English Prompt');
          const name = await inputDialog.show(`${tabBtn}<br>${getI18n('prompt_name')}:`, fields.name, title);
          if (name===null) return;
          fields.name = name;
          const c = await inputDialog.show((activeTab==='zh'? getI18n('review_instruction'): getI18n('review_instruction','en')), fields.critique, title);
          if (c===null) return;
          fields.critique=c;
          const r = await inputDialog.show((activeTab==='zh'? getI18n('revise_instruction'): getI18n('revise_instruction','en')), fields.revision, title);
          if (r===null) return;
          fields.revision=r;
          // Tab事件
          setTimeout(()=>{
            document.getElementById('promptTabZh').onclick = ()=>{ activeTab='zh'; showAddDialog(); };
            document.getElementById('promptTabEn').onclick = ()=>{ activeTab='en'; showAddDialog(); };
          },10);
          if (activeTab==='zh') {
            await showAddDialog();
          } else {
            // 提交
        try {
              const resp = await fetch(`${API_BASE_URL}/api/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name_zh: zh.name, critique_prompt_zh: zh.critique, revision_prompt_zh: zh.revision,
                  name_en: en.name, critique_prompt_en: en.critique, revision_prompt_en: en.revision
                })
            });
              if (resp.ok) {
                notification.success(getI18n('prompt_add_success'));
                await loadPrompts();
            }
            } catch {
              notification.error(getI18n('prompt_add_failed'));
        }
          }
        }
        await showAddDialog();
    });
    
    // === 渲染服务商列表（可展开编辑） ===
    function renderProviderList(providers) {
        log.info(`Rendering provider list, count: ${providers.length}`);
        providerListDiv.innerHTML = '';
        
        if (providers.length === 0) {
            providerListDiv.innerHTML = '<p class="text-xs text-gray-500 p-2">尚未添加任何服务商</p>';
            return;
        }
        
        providers.forEach((p, index) => {
            log.info(`Creating provider card ${index + 1}: ${p.name}`);
            
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
                <input name="api_key" type="password" value="" class="form-input text-sm" placeholder="${getI18n('api_key')}">
                <input name="api_base" value="${escapeHtml(p.api_base || '')}" class="form-input text-sm" placeholder="${getI18n('api_base')}">
                <input name="models" required value="${escapeHtml(p.original_models)}" class="form-input text-sm" placeholder="${getI18n('model_list')}">
                <div class="flex space-x-2 pt-1">
                    <button type="submit" class="font-bold py-1 px-3 text-sm rounded-md bg-blue-600 hover:bg-blue-700 flex-1 transition-colors">${getI18n('save')}</button>
                    <button type="button" class="delete-btn font-bold py-1 px-3 text-sm rounded-md bg-red-700 hover:bg-red-600">${getI18n('delete')}</button>
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
                const confirmed = await confirmDialog.show(getI18n('delete_provider_confirm', { name: p.name }), getI18n('delete'));
                if (!confirmed) return;
                
                try {
                    const response = await fetch(`${API_BASE_URL}/api/providers/${encodeURIComponent(p.name)}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || getI18n('delete_failed'));
                    }
                    
                    await loadAndRenderAll();
                } catch (error) {
                    log.error(`Delete error: ${error}`);
                    let errorMsg = error.message;
                    try {
                        const parsed = JSON.parse(errorMsg);
                        if(parsed && parsed.detail) errorMsg = parsed.detail;
                    } catch(e) { /* not a json string */ }
                    notification.error(`错误: ${errorMsg}`);
                }
            });
            
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const submitButton = this.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.textContent = getI18n('processing');
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
                        throw new Error(errorData.detail || getI18n('update_failed'));
                    }
                    
                    await loadAndRenderAll();
                } catch (error) {
                    log.error(`Update error: ${error}`);
                    let errorMsg = error.message;
                    try {
                        const parsed = JSON.parse(errorMsg);
                        if(parsed && parsed.detail) errorMsg = parsed.detail;
                    } catch(e) { /* not a json string */ }
                    notification.error(`错误: ${errorMsg}`);
                } finally {
                    submitButton.textContent = originalText;
                    submitButton.disabled = false;
                }
            });
            
            providerListDiv.appendChild(wrapper);
        });
    }
    
    // === OCR模型选择相关函数 ===
    // 更新OCR模型选择下拉框
    function updateOCRModelSelect() {
        log.info('updateOCRModelSelect called');
        if (!ocrModelSelect) {
            log.error('ocrModelSelect element not found');
            return;
        }
        
        // 保存当前选择
        const currentSelection = ocrModelSelect.value;
        
        // 清空选项（保留第一个"自动选择"）
        ocrModelSelect.innerHTML = '<option value="">自动选择（使用第一个支持图片的模型）</option>';
        
        // 获取所有支持图片的模型
        const checkboxes = document.querySelectorAll('.model-checkbox:checked');
        log.info(`Found ${checkboxes.length} checked model checkboxes`);
        const visionModels = [];
        
        checkboxes.forEach(cb => {
            const modelValue = cb.value; // 格式: provider::model
            const modelName = modelValue.split('::')[1] || modelValue;
            
            // 判断是否支持图片识别
            if (modelValue.includes('vision') || 
                modelValue.includes('gemini') || 
                modelValue.includes('gpt-4o') ||
                modelValue.includes('claude-3')) {
                visionModels.push({
                    value: modelValue,
                    label: modelValue
                });
            }
        });
        
        // 添加到下拉框
        log.info(`Adding ${visionModels.length} vision models to OCR selector`);
        visionModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            ocrModelSelect.appendChild(option);
        });
        
        // 恢复之前的选择（如果该模型仍然存在）
        if (currentSelection) {
            const optionExists = Array.from(ocrModelSelect.options).some(opt => opt.value === currentSelection);
            if (optionExists) {
                ocrModelSelect.value = currentSelection;
            }
        }
        
        // 如果没有可用模型，禁用选择框
        if (visionModels.length === 0) {
            ocrModelSelect.disabled = true;
            ocrModelSelect.innerHTML = '<option value="">无可用的图片识别模型</option>';
        } else {
            ocrModelSelect.disabled = false;
        }
    }
    
    // 获取用户选择的OCR模型
    function getSelectedOCRModel() {
        // 如果用户手动选择了模型，使用用户选择
        if (ocrModelSelect && ocrModelSelect.value) {
            log.info(`使用用户手动选择的OCR模型: ${ocrModelSelect.value}`);
            return ocrModelSelect.value;
        }
        
        // 否则自动选择第一个支持OCR的模型
        const checkboxes = document.querySelectorAll('.model-checkbox:checked');
        if (checkboxes.length === 0) {
            log.warn('没有选中任何模型');
            return null;
        }
        
        log.info(`当前选中 ${checkboxes.length} 个模型`);
        
        // 优先使用vision模型
        for (const cb of checkboxes) {
            const modelValue = cb.value; // 格式: provider::model
            log.info(`检查模型: ${modelValue}`);
            
            // 验证格式
            if (!modelValue || !modelValue.includes('::')) {
                log.warn(`模型格式无效: ${modelValue}`);
                continue;
            }
            
            // 检查是否为vision模型
            const lowerValue = modelValue.toLowerCase();
            if (lowerValue.includes('vision') || 
                lowerValue.includes('gemini') ||
                lowerValue.includes('gpt-4o') ||
                lowerValue.includes('gpt-4-turbo') ||
                lowerValue.includes('claude-3')) {
                log.info(`自动选择vision模型: ${modelValue}`);
                return modelValue;
            }
        }
        
        // 如果没有vision模型，返回null（不使用非vision模型）
        log.warn('没有找到支持图片识别的vision模型');
        return null;
    }
    
    // 恢复保存的OCR模型选择
    function restoreOCRModelSelection() {
        if (!ocrModelSelect) return;
        
        const savedOCRModel = localStorage.getItem('selected_ocr_model');
        if (savedOCRModel) {
            // 检查保存的模型是否在当前选项中
            const optionExists = Array.from(ocrModelSelect.options).some(opt => opt.value === savedOCRModel);
            if (optionExists) {
                ocrModelSelect.value = savedOCRModel;
                log.info(`已恢复OCR模型选择: ${savedOCRModel}`);
            } else {
                // 如果保存的模型不存在，清除保存的值
                localStorage.removeItem('selected_ocr_model');
                log.warn(`保存的OCR模型 ${savedOCRModel} 不存在，已重置`);
            }
        }
    }
    
    // 自动识别图片文字（添加图片时自动触发）
    async function autoRecognizeImages(files) {
        if (!files || files.length === 0) return;
        
        // 防止并发识别
        if (isRecognizing) {
            notification.warning('正在识别中，请等待当前识别完成');
            return;
        }
        
        const ocrModel = getSelectedOCRModel();
        if (!ocrModel) {
            log.warn('OCR模型未配置，跳过自动识别');
            notification.warning('请先在"模型配置"中勾选至少一个支持图片的模型（如gpt-4o、gemini、vision等）');
            return;
        }
        
        // 验证模型格式
        if (!ocrModel.includes('::')) {
            log.error(`OCR模型格式错误: ${ocrModel}`);
            notification.error('OCR模型格式错误，请重新配置模型');
            return;
        }
        
        isRecognizing = true;
        log.info(`🔍 开始OCR识别，使用模型: ${ocrModel}`);
        log.info(`📁 待识别文件数: ${files.length}`);
        
        let recognizedText = '';
        let successCount = 0;
        notification.info(`开始识别 ${files.length} 张图片...`);
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                log.info(`📸 正在识别第 ${i + 1}/${files.length} 张: ${file.name}`);
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('ocr_model', ocrModel);
                    
                    log.info(`🌐 发送OCR请求: ${API_BASE_URL}/api/ocr`);
                    log.info(`📦 FormData - file: ${file.name}, ocr_model: ${ocrModel}`);
                    
                    const response = await fetch(`${API_BASE_URL}/api/ocr`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    log.info(`📡 OCR响应状态: ${response.status} ${response.statusText}`);
                    
                    if (response.ok) {
                        const data = await response.json();
                        log.info(`📄 OCR返回数据:`, data);
                        
                        if (data.ocr_text) {
                            const ocrContent = data.ocr_text.trim();
                            recognizedText += `\n--- ${file.name} ---\n${ocrContent}\n`;
                            successCount++;
                            log.info(`✅ 图片 ${file.name} 识别成功，内容长度: ${ocrContent.length} 字符`);
                            log.info(`📝 识别内容预览: ${ocrContent.substring(0, 100)}...`);
                        } else {
                            log.warn(`⚠️ 图片 ${file.name} OCR返回空内容`);
                        }
                    } else {
                        const errorText = await response.text();
                        log.error(`❌ 图片 ${file.name} 识别失败: ${response.status} - ${errorText}`);
                    }
                } catch (error) {
                    log.error(`❌ 图片 ${file.name} 识别异常:`, error);
                }
            }
            
            // ⚠️ 重要：清空之前的OCR文本，使用新识别的内容
            if (recognizedText) {
                pendingOcrText = recognizedText.trim();
                log.info(`✅ OCR识别完成，设置 pendingOcrText，总长度: ${pendingOcrText.length} 字符`);
                log.info(`📝 完整OCR内容:\n${pendingOcrText}`);
                notification.success(`成功识别 ${successCount}/${files.length} 张图片的文字，将在下次提问时使用`);
            } else {
                pendingOcrText = null;
                log.warn(`⚠️ 未识别到任何文字内容，清空 pendingOcrText`);
                notification.warning('未能识别到文字内容');
            }
        } catch (error) {
            log.error(`OCR处理异常:`, error);
            notification.error(`OCR处理失败: ${error.message}`);
        } finally {
            isRecognizing = false;
            log.info(`🏁 OCR识别流程结束`);
        }
    }
    
    // === 渲染模型选择列表 ===
    function renderModelSelection(providers) {
        modelListContainer.innerHTML = '';
        
        if (providers.length === 0) {
            modelListContainer.innerHTML = '<p class="text-xs text-gray-500 p-2">无可用模型</p>';
            // 更新OCR模型选择器
            updateOCRModelSelect();
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
                
                // 添加复选框变化事件监听
                const checkbox = label.querySelector('.model-checkbox');
                if (checkbox) {
                    checkbox.addEventListener('change', () => {
                        updateOCRModelSelect();
                    });
                }
                
                modelListContainer.appendChild(label);
            });
        });
        
        // 初始更新OCR模型选择器
        updateOCRModelSelect();
        
        // 恢复保存的OCR模型选择
        restoreOCRModelSelection();
    }
    
    // === 添加服务商表单 ===
    if (addProviderForm) {
        addProviderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const submitButton = addProviderForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = getI18n('processing');
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
                    throw new Error(errorData.detail || getI18n('prompt_add_failed'));
                }
                
                addProviderForm.reset();
                await loadAndRenderAll();
            } catch (error) {
                log.error(`Add provider error: ${error}`);
                let errorMsg = error.message;
                try {
                    const parsed = JSON.parse(errorMsg);
                    if(parsed && parsed.detail) errorMsg = parsed.detail;
                } catch(e) { /* not a json string */ }
                notification.error(`错误: ${errorMsg}`);
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
            if (!response.ok) throw new Error(getI18n('load_failed'));
            
            const providers = await response.json();
            renderProviderList(providers);
            renderModelSelection(providers);
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
            notification.warning(getI18n('prompt_add_failed'));
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
        assistantBubble.innerHTML = getI18n('loading');
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
            console.log('=== [processQuery] 发送请求信息 ===');
            console.log('[processQuery] question:', question);
            console.log('[processQuery] selectedModels:', selectedModels);
            console.log('[processQuery] pendingOcrText 长度:', pendingOcrText ? pendingOcrText.length : 'null');
            console.log('[processQuery] pendingOcrText 内容:', pendingOcrText ? pendingOcrText.substring(0, 200) : 'null');
            
            // 检查是否启用AI互评模式
            // Linus 风格：明确的判断逻辑，避免隐式转换
            const peerReviewSetting = localStorage.getItem('sw_peer-review-mode');
            const isPeerReviewMode = peerReviewSetting !== '0'; // 只有明确设置为 '0' 时才禁用
            console.log(
                "%c[processQuery] 关键检查点\n- localStorage (sw_peer-review-mode): '%s' (typeof %s)\n- 是否启用互评: %s\n- 原始选中模型: %s",
                'color:#ff4444;font-weight:bold;',
                peerReviewSetting,
                typeof peerReviewSetting,
                isPeerReviewMode ? '是' : '否',
                selectedModels.join(', ')
            );

            const modelsToUse = isPeerReviewMode ? selectedModels : [selectedModels[0]];
            console.log(
                "%c[processQuery] 最终使用模型: %s (数量: %d)",
                'color:#ff4444;font-weight:bold;',
                modelsToUse.join(', '),
                modelsToUse.length
            );
            
            const requestBody = {
                question: question,
                selected_models: modelsToUse,
                history: conversationHistory.slice(0, -1),
                ocr_text: pendingOcrText || null
            };
            console.log('[processQuery] 完整请求体:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(`${API_BASE_URL}/api/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
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
                
                // 添加答案操作按钮
                if (typeof createAnswerActions === 'function') {
                    createAnswerActions(assistantBubble, finalAnswer, question);
                }
                
                if (finalDetails.length > 0) {
                    createActionButtons(finalDetails, assistantBubble, userBubble, question);
                }
    }
    
    function createActionButtons(finalDetails, assistantBubble, userBubble, question) {
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'action-buttons';
                    actionsDiv.innerHTML = `
                        <button class="action-btn view-details-btn">${getI18n('view_detail')}</button>
                        <button class="action-btn regen-btn">${getI18n('regen')}</button>
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
            // 修复：在提交后清除所有文件和OCR文本
            clearFileSelection();
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
    
    // ===== 壁纸功能由 index.html 中的内联脚本处理 =====
    // 移除了冲突的 setWallpaper() 和 loadWallpaperSetting() 函数
    // 图片选择元素
    const bulkImageInput = document.getElementById('bulk-image-input');
    // OCR模型选择
    const ocrModelSelect = document.getElementById('ocr-model-select');

    // 累积选中的文件（支持多次选择）
    let accumulatedFiles = [];
    
    // OCR识别状态标志（防止并发识别）
    let isRecognizing = false;
    
    // 图片预览相关函数
    function showImagePreview(file) {
        console.log('[DEBUG showImagePreview] 被调用, 文件:', file.name);
        const modal = document.getElementById('image-preview-modal');
        const img = document.getElementById('preview-image');
        const filename = document.getElementById('preview-filename');
        
        console.log('[DEBUG showImagePreview] modal:', modal);
        console.log('[DEBUG showImagePreview] img:', img);
        console.log('[DEBUG showImagePreview] filename:', filename);
        
        if (!modal || !img || !filename) {
            console.error('[DEBUG showImagePreview] 缺少必要元素！');
            return;
        }
        
        // 设置文件名
        filename.textContent = file.name;
        console.log('[DEBUG showImagePreview] 已设置文件名');
        
        // 读取文件并显示
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('[DEBUG showImagePreview] 文件读取完成');
            img.src = e.target.result;
            modal.style.display = 'flex';
            console.log('[DEBUG showImagePreview] 模态框已显示');
            
            // 添加键盘和点击事件监听器
            addPreviewCloseListeners();
        };
        reader.onerror = (e) => {
            console.error('[DEBUG showImagePreview] 文件读取失败:', e);
        };
        reader.readAsDataURL(file);
        console.log('[DEBUG showImagePreview] 开始读取文件...');
    }
    
    function hideImagePreview() {
        const modal = document.getElementById('image-preview-modal');
        if (modal) {
            modal.style.display = 'none';
            // 移除事件监听器
            removePreviewCloseListeners();
        }
    }
    
    // 添加关闭预览的事件监听器
    function addPreviewCloseListeners() {
        document.addEventListener('keydown', handlePreviewClose);
        document.addEventListener('click', handlePreviewClose);
    }
    
    // 移除关闭预览的事件监听器
    function removePreviewCloseListeners() {
        document.removeEventListener('keydown', handlePreviewClose);
        document.removeEventListener('click', handlePreviewClose);
    }
    
    // 处理预览关闭事件
    function handlePreviewClose() {
        hideImagePreview();
    }

    // 显示累积选中的文件名
    function displaySelectedFiles() {
        console.log('[DEBUG displaySelectedFiles] 被调用');
        console.log('[DEBUG displaySelectedFiles] accumulatedFiles数量:', accumulatedFiles.length);
        console.log('[DEBUG displaySelectedFiles] accumulatedFiles内容:', accumulatedFiles.map(f => f.name));
        
        const displayArea = document.getElementById('selected-files-display');
        const fileNamesList = document.getElementById('file-names-list');
        
        console.log('[DEBUG displaySelectedFiles] displayArea:', displayArea);
        console.log('[DEBUG displaySelectedFiles] fileNamesList:', fileNamesList);
        
        if (!accumulatedFiles || accumulatedFiles.length === 0) {
            if (displayArea) displayArea.style.display = 'none';
            console.log('[DEBUG displaySelectedFiles] 隐藏显示区域（无文件）');
            return;
        }
        
        console.log('[DEBUG displaySelectedFiles] 开始显示文件...');
        if (displayArea) displayArea.style.display = 'block';
        if (fileNamesList) {
            fileNamesList.innerHTML = '';
            console.log('[DEBUG displaySelectedFiles] 清空了fileNamesList');
            
            accumulatedFiles.forEach((file, index) => {
                console.log(`[DEBUG displaySelectedFiles] 添加第${index + 1}个文件:`, file.name);
                const fileTag = document.createElement('div');
                fileTag.className = 'inline-flex items-center gap-2 px-3 py-2 rounded-md bg-teal-600 dark:bg-teal-700 text-white cursor-pointer hover:bg-teal-700 dark:hover:bg-teal-600 transition-all shadow-sm';
                
                // 文件图标
                const iconSpan = document.createElement('span');
                iconSpan.innerHTML = '📄';
                iconSpan.className = 'text-sm';
                
                // 创建文件名部分（可点击预览）
                const nameSpan = document.createElement('span');
                nameSpan.textContent = file.name;
                nameSpan.className = 'text-sm font-medium max-w-[200px] truncate';
                nameSpan.title = `点击预览: ${file.name}`;
                
                // 创建删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '×';
                deleteBtn.className = 'ml-1 hover:bg-teal-800 dark:hover:bg-teal-500 rounded-full w-5 h-5 flex items-center justify-center text-lg font-bold transition-colors';
                deleteBtn.title = '删除此图片';
                
                fileTag.appendChild(iconSpan);
                fileTag.appendChild(nameSpan);
                fileTag.appendChild(deleteBtn);
                fileNamesList.appendChild(fileTag);
                
                // 为文件名添加预览事件
                nameSpan.addEventListener('click', (e) => {
                    console.log(`[DEBUG] 点击了文件名: ${file.name}`);
                    e.stopPropagation();
                    console.log('[DEBUG] 准备调用showImagePreview');
                    showImagePreview(file);
                    console.log('[DEBUG] showImagePreview已调用');
                });
                
                // 为删除按钮添加事件
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeFileAtIndex(index);
                });
                
                console.log(`[DEBUG displaySelectedFiles] 第${index + 1}个文件已添加到DOM`);
            });
            
            console.log('[DEBUG displaySelectedFiles] fileNamesList.children.length:', fileNamesList.children.length);
            console.log('[DEBUG displaySelectedFiles] 预览和删除事件已绑定');
        }
        console.log('[DEBUG displaySelectedFiles] 函数执行完毕');
    }
    
    // 监听OCR模型选择变化
    if (ocrModelSelect) {
        ocrModelSelect.addEventListener('change', () => {
            const selectedModel = ocrModelSelect.value;
            if (selectedModel) {
                localStorage.setItem('selected_ocr_model', selectedModel);
                notification.success(`已设置OCR模型: ${selectedModel}`);
                log.info(`OCR模型已设置为: ${selectedModel}`);
            } else {
                localStorage.removeItem('selected_ocr_model');
                notification.info('已设置为自动选择OCR模型');
                log.info('OCR模型已设置为自动选择');
            }
        });
    }
    
    // 添加文件到累积列表
    function addFilesToAccumulated(files) {
        console.log('[DEBUG addFilesToAccumulated] 被调用');
        console.log('[DEBUG addFilesToAccumulated] files参数:', files);
        console.log('[DEBUG addFilesToAccumulated] files.length:', files ? files.length : 0);
        
        if (!files || files.length === 0) {
            console.log('[DEBUG addFilesToAccumulated] 没有文件，退出');
            return;
        }
        
        // ⚠️ Bug修复：不再清空之前的文件，实现多次追加
        // accumulatedFiles = [];
        // pendingOcrText = null;
        // log.info('🔄 清空之前的文件，准备添加新文件');
        
        console.log('[DEBUG addFilesToAccumulated] 添加前accumulatedFiles数量:', accumulatedFiles.length);
        
        const fileArray = Array.from(files);
        console.log('[DEBUG addFilesToAccumulated] fileArray:', fileArray.map(f => f.name));
        
        let actuallyAdded = 0;
        const newFiles = [];
        fileArray.forEach(newFile => {
            console.log(`[DEBUG addFilesToAccumulated] 处理文件: ${newFile.name}, 大小: ${newFile.size}`);
            // 检查重复
            if (!accumulatedFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)) {
                accumulatedFiles.push(newFile);
                newFiles.push(newFile);
                actuallyAdded++;
                console.log(`[DEBUG addFilesToAccumulated] ✓ 已添加: ${newFile.name}`);
            } else {
                console.log(`[DEBUG addFilesToAccumulated] ✗ 已跳过重复文件: ${newFile.name}`);
            }
        });
        
        console.log('[DEBUG addFilesToAccumulated] 添加后accumulatedFiles数量:', accumulatedFiles.length);
        console.log('[DEBUG addFilesToAccumulated] 添加后accumulatedFiles内容:', accumulatedFiles.map(f => f.name));
        console.log(`[DEBUG addFilesToAccumulated] 实际新增: ${actuallyAdded} 个文件`);
        
        displaySelectedFiles();
        
        // 显示提示
        const addedCount = actuallyAdded;
        const totalCount = accumulatedFiles.length;
        console.log(`[DEBUG addFilesToAccumulated] 显示通知: 已添加 ${addedCount} 张，当前共 ${totalCount} 张`);
        notification.info(`已选择 ${totalCount} 张图片，即将开始识别`);
        
        // 自动识别新添加的图片
        if (newFiles.length > 0) {
            autoRecognizeImages(newFiles);
        }
    }
    
    // 移除指定索引的文件
    function removeFileAtIndex(index) {
        if (index >= 0 && index < accumulatedFiles.length) {
            const removed = accumulatedFiles.splice(index, 1);
            displaySelectedFiles();
            notification.info(`已移除：${removed[0].name}`);
        }
    }
    
    // 清除所有累积的文件选择
    function clearFileSelection() {
        accumulatedFiles = [];
        pendingOcrText = null;  // ⚠️ 清空OCR缓存
        if (bulkImageInput) {
            bulkImageInput.value = '';
        }
        displaySelectedFiles();
        log.info('🗑️ 已清除所有文件和OCR缓存');
        notification.info('已清除所有待识别图片');
    }
    
    
    // 监听文件选择变化 - 累积模式
    if (bulkImageInput) {
        bulkImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                addFilesToAccumulated(e.target.files);
                // 不重置input值，以保持选择状态
            }
        });
    }

    // ===== 壁纸功能由 index.html 中的内联脚本处理，避免重复绑定事件 =====
    
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
        const confirmed = await confirmDialog.show(getI18n('new_chat'), getI18n('new_chat'));
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
    if (themeText) themeText.textContent = isDark ? getI18n('dark') : getI18n('light');
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

    if (themeToggleSettings) {
        themeToggleSettings.addEventListener('click', () => {
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
    
    // 多语言切换初始化
    const savedLang = localStorage.getItem('ui-lang') || 'zh';
    setLang(savedLang);
    // 绑定监听
    document.querySelectorAll('input[name="ui-lang"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                setLang(this.value);
            }
        });
    });
    
    loadAndRenderAll();
    log.info('Initialization complete v17.0.0');
    
    } catch (error) {
        console.error('Error in tab/language initialization:', error);
        log.error('Tab/language initialization error: ' + error.message);
    }
});


