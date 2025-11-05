/*
 * static/history.js
 * 历史记录功能模块 - Linus 风格重构
 * "Simplicity is prerequisite for reliability" - Edsger Dijkstra (but Linus agrees)
 */

(function() {
    'use strict';
    
    const S = window.S || {
        get: (k, d) => localStorage.getItem(k) || d,
        set: (k, v) => localStorage.setItem(k, v)
    };
    
    // 保存聊天历史
    function saveChatHistory() {
        try {
            const chatLog = document.getElementById('chat-log');
            if (!chatLog) return;
            
            const messages = [];
            chatLog.querySelectorAll('.chat-message').forEach(msg => {
                const isUser = msg.classList.contains('user');
                let contentEl = null;
                
                if (isUser) {
                    const divs = msg.querySelectorAll('div');
                    if (divs.length > 1) contentEl = divs[divs.length - 1];
                } else {
                    contentEl = msg.querySelector('.response-content') || 
                               msg.querySelector('.final-answer') || 
                               msg.querySelector('.process-text') ||
                               (() => {
                                   const divs = msg.querySelectorAll('div');
                                   return divs.length > 1 ? divs[divs.length - 1] : null;
                               })();
                }
                
                if (contentEl) {
                    const content = contentEl.textContent.trim();
                    // 跳过空内容和状态消息
                    if (content && !content.startsWith('✓') && !content.startsWith('❌') && 
                        !content.includes('正在初始化') && !content.includes('正在') && 
                        content.length > 3) {
                        const timestamp = msg.getAttribute('data-timestamp') || Date.now().toString();
                        messages.push({
                            type: isUser ? 'user' : 'assistant',
                            content: content,
                            timestamp: timestamp
                        });
                    }
                }
            });
            
            if (messages.length >= 2) {
                const historyKey = 'chat_history_' + Date.now();
                const firstUserMsg = messages.find(m => m.type === 'user');
                const title = firstUserMsg ? (firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')) : '对话记录';
                
                const historyItem = {
                    id: historyKey,
                    title: title,
                    messages: messages,
                    createdAt: Date.now()
                };
                
                let allHistory = JSON.parse(S.get('all_chat_history', '[]'));
                
                // 检查是否重复
                const isDuplicate = allHistory.some(h => {
                    if (h.messages.length !== messages.length) return false;
                    return h.messages.every((m, i) => 
                        m.type === messages[i].type && m.content === messages[i].content
                    );
                });
                
                if (!isDuplicate) {
                    allHistory.unshift(historyItem);
                    if (allHistory.length > 50) allHistory = allHistory.slice(0, 50);
                    S.set('all_chat_history', JSON.stringify(allHistory));
                    console.log('[历史记录] 已保存，共', messages.length, '条消息');
                }
            }
        } catch (e) {
            console.error('[历史记录] 保存失败:', e);
        }
    }
    
    // 加载聊天历史
    function loadChatHistory() {
        try {
            console.log('[历史记录] 开始加载...');
            const historyContainer = document.getElementById('chat-history');
            if (!historyContainer) {
                console.error('[历史记录] 容器不存在');
                return;
            }
            
            let allHistory = [];
            try {
                const historyStr = S.get('all_chat_history', '[]');
                allHistory = JSON.parse(historyStr);
                console.log('[历史记录] 成功解析，数量:', allHistory.length);
            } catch (e) {
                console.error('[历史记录] 解析失败:', e);
                allHistory = [];
            }
            
            if (!Array.isArray(allHistory) || allHistory.length === 0) {
                const t = window.i18n ? window.i18n[window.currentLang || 'zh'] : { noHistory: '暂无历史记录' };
                historyContainer.innerHTML = `<div class="text-sm text-gray-400 text-center py-4">${t.noHistory}</div>`;
                return;
            }
            
            console.log('[历史记录] 渲染', allHistory.length, '条记录');
            historyContainer.innerHTML = allHistory.map(item => {
                const date = new Date(item.createdAt || Date.now());
                const dateStr = date.toLocaleString(window.currentLang === 'en' ? 'en-US' : 'zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `
                    <div class="history-item p-2 hover:bg-gray-800 rounded cursor-pointer mb-1" data-id="${item.id || 'unknown'}">
                        <div class="text-sm text-gray-200 truncate">${item.title || '未命名对话'}</div>
                        <div class="text-xs text-gray-500 mt-1">${dateStr}</div>
                    </div>
                `;
            }).join('');
            
            // 绑定点击事件
            historyContainer.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.getAttribute('data-id');
                    const historyItem = allHistory.find(h => h.id === id);
                    if (historyItem) {
                        console.log('[历史记录] 加载:', historyItem.title);
                        loadHistoryToChat(historyItem);
                        const popup = document.getElementById('history-popup');
                        if (popup) popup.classList.add('hidden');
                    }
                });
            });
        } catch (e) {
            console.error('[历史记录] 加载失败:', e);
        }
    }
    
    // 加载历史到聊天框
    function loadHistoryToChat(historyItem) {
        const chatLog = document.getElementById('chat-log');
        if (!chatLog) return;
        
        chatLog.innerHTML = '';
        
        const t = window.i18n ? window.i18n[window.currentLang || 'zh'] : { user: '用户', aiAssistant: 'AI助手' };
        historyItem.messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${msg.type}`;
            msgDiv.setAttribute('data-timestamp', msg.timestamp);
            
            if (msg.type === 'user') {
                msgDiv.innerHTML = `<div class="font-medium mb-1">${t.user}</div><div>${msg.content}</div>`;
            } else {
                msgDiv.innerHTML = `<div class="font-medium mb-1 text-purple-400">${t.aiAssistant}</div><div class="response-content">${msg.content}</div>`;
            }
            
            // 如果时间戳功能开启，添加时间戳
            if (S.get('sw_timestamps') === '1') {
                const timeEl = document.createElement('div');
                timeEl.className = 'message-timestamp';
                timeEl.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-top: 4px;';
                const date = new Date(parseInt(msg.timestamp));
                const lang = window.currentLang || 'zh';
                timeEl.textContent = date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', { 
                    month: lang === 'en' ? 'short' : 'numeric', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                msgDiv.appendChild(timeEl);
            }
            
            chatLog.appendChild(msgDiv);
        });
        
        chatLog.scrollTop = chatLog.scrollHeight;
    }
    
    // 初始化历史记录功能
    function init() {
        const historyBtn = document.getElementById('history-btn');
        const historyPopup = document.getElementById('history-popup');
        
        if (historyBtn && historyPopup) {
            historyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                loadChatHistory();
                historyPopup.classList.toggle('hidden');
            });
            
            document.addEventListener('click', (e) => {
                if (!historyPopup.contains(e.target) && !historyBtn.contains(e.target)) {
                    historyPopup.classList.add('hidden');
                }
            });
        }
    }
    
    // 导出到全局
    window.ChatHistory = { init, saveChatHistory, loadChatHistory, loadHistoryToChat };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
