/*
 * static/i18n.js
 * 国际化模块 - Linus 风格重构
 * "Talk is cheap, show me the code" - Linus Torvalds
 */

(function() {
    'use strict';
    
    // 多语言字典
    const i18n = {
        zh: {
            newChat: '新对话',
            selectImage: '选择图片',
            placeholder: '在这里输入消息, 按 Enter 发送',
            chatHistory: '历史记录',
            noHistory: '暂无历史记录',
            settings: '设置',
            user: '用户',
            aiAssistant: 'AI助手',
            newChatStarted: '新对话已开始',
            selectModelFirst: '请先在侧边栏选择至少一个模型',
            imageUploaded: '已上传图片：',
            uploadWallpaper: '上传壁纸',
            resetWallpaper: '恢复默认',
            manageProviders: '管理服务商',
            managePrompts: '管理提示词',
            delete: '删除',
            activate: '激活',
            view: '查看',
            confirmDelete: '确定删除吗？',
            deleteSuccess: '删除成功',
            deleteFailed: '删除失败',
            activateSuccess: '激活成功',
            activateFailed: '激活失败',
            addSuccess: '添加成功',
            addFailed: '添加失败',
            updateSuccess: '更新成功',
            updateFailed: '更新失败'
        },
        en: {
            newChat: 'New Chat',
            selectImage: 'Select Image',
            placeholder: 'Enter your message here, press Enter to send',
            chatHistory: 'History',
            noHistory: 'No history yet',
            settings: 'Settings',
            user: 'User',
            aiAssistant: 'AI Assistant',
            newChatStarted: 'New chat started',
            selectModelFirst: 'Please select at least one model in the sidebar first',
            imageUploaded: 'Image uploaded:',
            uploadWallpaper: 'Upload Wallpaper',
            resetWallpaper: 'Reset Default',
            manageProviders: 'Manage Providers',
            managePrompts: 'Manage Prompts',
            delete: 'Delete',
            activate: 'Activate',
            view: 'View',
            confirmDelete: 'Are you sure to delete?',
            deleteSuccess: 'Deleted successfully',
            deleteFailed: 'Delete failed',
            activateSuccess: 'Activated successfully',
            activateFailed: 'Activation failed',
            addSuccess: 'Added successfully',
            addFailed: 'Add failed',
            updateSuccess: 'Updated successfully',
            updateFailed: 'Update failed'
        }
    };
    
    // 获取当前语言
    function getLang() {
        return window.currentLang || localStorage.getItem('ui-lang') || 'zh';
    }
    
    // 获取翻译文本
    function t(key, params) {
        const lang = getLang();
        let text = (i18n[lang] && i18n[lang][key]) || i18n.zh[key] || key;
        
        if (params) {
            Object.keys(params).forEach(k => {
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
            });
        }
        
        return text;
    }
    
    // 应用语言设置
    function applyLanguage(lang) {
        window.currentLang = lang;
        localStorage.setItem('ui-lang', lang);
        
        const translations = i18n[lang] || i18n.zh;
        
        // 更新所有带 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                el.textContent = translations[key];
            }
        });
        
        // 更新 placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (translations[key]) {
                el.setAttribute('placeholder', translations[key]);
            }
        });
        
        // 更新常用按钮文本
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim();
            if (text.includes('管理服务商') || text === 'Manage Providers') {
                btn.textContent = translations.manageProviders;
            } else if (text.includes('管理提示词') || text === 'Manage Prompts') {
                btn.textContent = translations.managePrompts;
            } else if (text.includes('上传壁纸') || text === 'Upload Wallpaper') {
                btn.textContent = translations.uploadWallpaper;
            } else if (text.includes('恢复默认') || text.includes('重置壁纸') || text === 'Reset Default') {
                btn.textContent = translations.resetWallpaper;
            }
        });
        
        console.log('[i18n] 已切换到:', lang);
    }
    
    // 初始化
    function init() {
        const savedLang = getLang();
        applyLanguage(savedLang);
        
        // 绑定语言选择器
        document.querySelectorAll('input[name="ui-lang"]').forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    applyLanguage(this.value);
                }
            });
            // 设置选中状态
            if (radio.value === savedLang) {
                radio.checked = true;
            }
        });
        
        // 绑定语言下拉框（如果有）
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = savedLang;
            langSelect.addEventListener('change', (e) => {
                applyLanguage(e.target.value);
            });
        }
    }
    
    // 导出到全局
    window.i18n = i18n;
    window.I18n = { init, applyLanguage, getLang, t };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
