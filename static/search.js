/*
 * static/search.js
 * SearXNG 搜索功能模块
 * 提供隐私友好的网络搜索功能
 */

(function() {
    'use strict';

    let currentSearchResults = [];
    let currentPage = 1;
    let currentQuery = '';

    // 执行搜索
    async function performSearch(query, page = 1) {
        if (!query || !query.trim()) {
            showError('请输入搜索关键词');
            return;
        }

        const searchBtn = document.getElementById('search-btn');
        const searchResults = document.getElementById('search-results');
        const searchLoading = document.getElementById('search-loading');

        try {
            // 显示加载状态
            if (searchBtn) searchBtn.disabled = true;
            if (searchLoading) searchLoading.classList.remove('hidden');
            if (searchResults) searchResults.classList.add('hidden');

            currentQuery = query.trim();
            currentPage = page;

            // 调用搜索 API
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: currentQuery,
                    language: window.currentLang === 'en' ? 'en-US' : 'zh-CN',
                    page: currentPage
                })
            });

            if (!response.ok) {
                throw new Error(`搜索失败: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '搜索失败');
            }

            currentSearchResults = data.results || [];
            displayResults(data);

        } catch (error) {
            console.error('搜索错误:', error);
            showError(error.message || '搜索失败，请稍后重试');
        } finally {
            if (searchBtn) searchBtn.disabled = false;
            if (searchLoading) searchLoading.classList.add('hidden');
        }
    }

    // 显示搜索结果
    function displayResults(data) {
        const searchResults = document.getElementById('search-results');
        const resultsContainer = document.getElementById('results-container');
        const resultsCount = document.getElementById('results-count');

        if (!searchResults || !resultsContainer) return;

        // 清空之前的结果
        resultsContainer.innerHTML = '';

        // 显示结果数量
        if (resultsCount) {
            const count = data.number_of_results || data.results.length;
            resultsCount.textContent = `找到约 ${count} 条结果`;
        }

        // 显示结果
        if (data.results && data.results.length > 0) {
            data.results.forEach(result => {
                const resultDiv = createResultElement(result);
                resultsContainer.appendChild(resultDiv);
            });

            searchResults.classList.remove('hidden');
        } else {
            showError('未找到相关结果');
        }

        // 显示搜索建议
        if (data.suggestions && data.suggestions.length > 0) {
            displaySuggestions(data.suggestions);
        }
    }

    // 创建单个搜索结果元素
    function createResultElement(result) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="flex items-start gap-3 p-4 rounded-lg hover:bg-gray-700/30 transition-colors">
                <div class="flex-1 min-w-0">
                    <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer"
                       class="text-blue-400 hover:text-blue-300 text-lg font-medium block mb-1">
                        ${escapeHtml(result.title || result.url)}
                    </a>
                    <div class="text-sm text-green-400 mb-2 truncate">
                        ${escapeHtml(result.url)}
                    </div>
                    ${result.content ? `<p class="text-sm text-gray-300 line-clamp-3">${escapeHtml(result.content)}</p>` : ''}
                    <div class="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        ${result.engine ? `<span class="bg-gray-700 px-2 py-0.5 rounded">${escapeHtml(result.engine)}</span>` : ''}
                        ${result.publishedDate ? `<span>${new Date(result.publishedDate).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        return div;
    }

    // 显示搜索建议
    function displaySuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (!suggestionsContainer) return;

        suggestionsContainer.innerHTML = '';

        if (suggestions.length > 0) {
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'flex flex-wrap gap-2 mb-4';
            suggestionsDiv.innerHTML = '<span class="text-sm text-gray-400">相关搜索:</span>';

            suggestions.forEach(suggestion => {
                const btn = document.createElement('button');
                btn.className = 'text-sm bg-gray-700 hover:bg-gray-600 text-blue-300 px-3 py-1 rounded-full transition-colors';
                btn.textContent = suggestion;
                btn.onclick = () => {
                    document.getElementById('search-input').value = suggestion;
                    performSearch(suggestion);
                };
                suggestionsDiv.appendChild(btn);
            });

            suggestionsContainer.appendChild(suggestionsDiv);
        }
    }

    // 显示错误
    function showError(message) {
        const searchResults = document.getElementById('search-results');
        const resultsContainer = document.getElementById('results-container');

        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="flex items-center justify-center p-8 text-gray-400">
                    <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>${escapeHtml(message)}</span>
                </div>
            `;
        }

        if (searchResults) {
            searchResults.classList.remove('hidden');
        }
    }

    // HTML 转义
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 切换搜索面板
    function toggleSearchPanel() {
        const panel = document.getElementById('search-panel');
        const searchInput = document.getElementById('search-input');

        if (panel) {
            panel.classList.toggle('hidden');

            // 如果打开面板，聚焦到搜索框
            if (!panel.classList.contains('hidden') && searchInput) {
                setTimeout(() => searchInput.focus(), 100);
            }
        }
    }

    // 初始化搜索功能
    function init() {
        // 搜索按钮
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = document.getElementById('search-input').value;
                performSearch(query);
            });
        }

        // 搜索输入框 - 回车触发搜索
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch(searchInput.value);
                }
            });
        }

        // 打开搜索面板按钮
        const openSearchBtn = document.getElementById('open-search-btn');
        if (openSearchBtn) {
            openSearchBtn.addEventListener('click', toggleSearchPanel);
        }

        // 关闭搜索面板按钮
        const closeSearchBtn = document.getElementById('close-search-btn');
        if (closeSearchBtn) {
            closeSearchBtn.addEventListener('click', () => {
                const panel = document.getElementById('search-panel');
                if (panel) panel.classList.add('hidden');
            });
        }

        console.log('[Search] 搜索模块已初始化');
    }

    // 导出到全局
    window.Search = {
        init,
        performSearch,
        toggleSearchPanel
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
