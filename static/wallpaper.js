/*
 * static/wallpaper.js
 * 壁纸功能模块 - 苹果风格重构
 * 目标：显示清晰壁纸而非模糊背景
 * 
 * 优化说明：
 * - backdrop-filter模糊值从8-10px降低到2px，让壁纸更清晰
 * - 增加UI组件不透明度以保持文字可读性
 * - 优化壁纸图像渲染质量（crisp-edges, high-quality）
 * - 使用GPU加速确保渲染性能（translateZ(0)）
 */

(function() {
    'use strict';

    // 确保S对象存在
    function getS() {
        if (window.S) return window.S;
        // 如果S不存在，创建一个临时的
        return {
            get: (k, d) => localStorage.getItem(k) || d,
            set: (k, v) => localStorage.setItem(k, v)
        };
    }

    // 应用背景图片 - 确保壁纸清晰显示
    function applyBgImage() {
        const S = getS();
        const bgImage = S.get('bgImage');
        const opacity = parseInt(S.get('bgOpacity', '100')) / 100;
        const brightness = S.get('bgBrightness', '100');
        const blur = S.get('bgBlur', '0');

        // 移除旧样式
        const oldStyle = document.getElementById('bg-filter-style');
        if (oldStyle) oldStyle.remove();

        // 清理背景状态
        document.documentElement.classList.remove('has-wallpaper');
        document.body.classList.remove('has-wallpaper');

        if (!bgImage) {
            // 无壁纸：无需添加样式
            return;
        }

        const style = document.createElement('style');
        style.id = 'bg-filter-style';

        const safeBgImage = bgImage.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

        // 核心逻辑：
        // - 壁纸层：全屏固定显示清晰壁纸（默认不模糊）
        // - 内容层：半透明毛玻璃效果确保文字清晰可读

        document.body.classList.add('has-wallpaper');

        style.textContent = `
            /* 壁纸层 - 清晰显示壁纸（默认无模糊） */
            body.has-wallpaper::before {
                content: '' !important;
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background-image: url('${safeBgImage}') !important;
                background-size: cover !important;
                background-position: center center !important;
                background-attachment: fixed !important;
                background-repeat: no-repeat !important;
                filter: brightness(${brightness}%) !important;
                opacity: ${opacity} !important;
                z-index: -1 !important;
                pointer-events: none !important;
            }

            /* 确保html和body背景透明，让壁纸显示 */
            html.has-wallpaper,
            body.has-wallpaper {
                background: transparent !important;
                background-image: none !important;
            }

            /* 侧边栏 - 恢复原来的样式，确保内容清晰可见 */
            body.has-wallpaper .sidebar {
                background: rgba(37, 41, 50, 0.90) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .sidebar {
                background: rgba(237, 242, 247, 0.95) !important;
                backdrop-filter: blur(2px) !important;
            }

            /* 主内容区 - 适度透明，保持壁纸可见但确保文字可读 */
            body.has-wallpaper .main-content {
                background: rgba(26, 29, 35, 0.75) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .main-content {
                background: rgba(247, 250, 252, 0.85) !important;
                backdrop-filter: blur(2px) !important;
            }

            /* 输入区域 - 更不透明以确保输入框清晰可见 */
            body.has-wallpaper .input-area {
                background: rgba(37, 41, 50, 0.90) !important;
                backdrop-filter: blur(2px) !important;
            }

            body.has-wallpaper .input-container {
                background: rgba(50, 58, 70, 0.92) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .input-area {
                background: rgba(237, 242, 247, 0.95) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .input-container {
                background: rgba(255, 255, 255, 0.96) !important;
                backdrop-filter: blur(2px) !important;
            }

            /* 聊天消息区域 - 增加背景不透明度，确保文字清晰可读 */
            body.has-wallpaper .chat-message {
                background: rgba(37, 41, 50, 0.80) !important;
                backdrop-filter: blur(2px) !important;
            }

            body.has-wallpaper .chat-message.user {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.88), rgba(147, 51, 234, 0.80)) !important;
                backdrop-filter: blur(2px) !important;
            }

            body.has-wallpaper .chat-message.assistant {
                background: linear-gradient(135deg, rgba(147, 51, 234, 0.85), rgba(59, 130, 246, 0.80)) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .chat-message {
                background: rgba(255, 255, 255, 0.88) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .chat-message.user {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.85), rgba(147, 51, 234, 0.75)) !important;
                backdrop-filter: blur(2px) !important;
            }

            html:not(.dark) body.has-wallpaper .chat-message.assistant {
                background: linear-gradient(135deg, rgba(147, 51, 234, 0.80), rgba(59, 130, 246, 0.75)) !important;
                backdrop-filter: blur(2px) !important;
            }

            /* 确保壁纸以最高质量渲染，无任何模糊 */
            body.has-wallpaper::before {
                image-rendering: -webkit-optimize-contrast !important;
                image-rendering: crisp-edges !important;
                image-rendering: high-quality !important;
                -webkit-backface-visibility: hidden !important;
                -webkit-transform: translateZ(0) !important;
                transform: translateZ(0) !important;
            }
        `;

        document.head.appendChild(style);
    }

    // 设置壁纸状态提示
    function setStatus(message, isError = false) {
        const statusEl = document.getElementById('wallpaper-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.style.color = isError ? '#f87171' : '#9ca3af';
    }

    // 初始化壁纸功能
    function init() {
        // 上传壁纸
        const uploadBtn = document.getElementById('wallpaper-upload-btn');
        const uploadInput = document.getElementById('wallpaper-upload');

        if (uploadBtn && uploadInput) {
            uploadBtn.onclick = (e) => {
                e.preventDefault();
                uploadInput.click();
            };

            uploadInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > 4 * 1024 * 1024) {
                    setStatus('图片大于 4MB，请压缩后再试。', true);
                    e.target.value = '';
                    return;
                }

                if (!file.type.startsWith('image/')) {
                    setStatus('请选择图片文件', true);
                    e.target.value = '';
                    return;
                }

                setStatus('正在处理壁纸...');

                const reader = new FileReader();
                reader.onerror = () => setStatus('文件读取失败。', true);
                reader.onload = (ev) => {
                    try {
                        const imageData = ev.target.result;
                        if (!imageData || !imageData.startsWith('data:image/')) {
                            throw new Error('无效的图片格式');
                        }

                        const S = getS();
                        S.set('bgImage', imageData);
                        applyBgImage();
                        setStatus('✓ 壁纸已更新。可通过下方滑块调整效果。');
                        e.target.value = '';
                    } catch (err) {
                        console.error('壁纸上传错误:', err);
                        setStatus('保存失败：' + err.message, true);
                    }
                };
                reader.readAsDataURL(file);
            };
        }

        // 重置壁纸
        const resetBtn = document.getElementById('reset-wallpaper-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('确定恢复默认壁纸？')) {
                    const S = getS();
                    S.set('bgImage', '');
                    S.set('bgOpacity', '100');
                    S.set('bgBrightness', '100');

                    const opacitySlider = document.getElementById('wallpaper-opacity');
                    const brightnessSlider = document.getElementById('wallpaper-brightness');
                    const opacityLabel = document.getElementById('wallpaper-opacity-label');
                    const brightnessLabel = document.getElementById('wallpaper-brightness-label');

                    if (opacitySlider) opacitySlider.value = 100;
                    if (brightnessSlider) brightnessSlider.value = 100;
                    if (opacityLabel) opacityLabel.textContent = '100%';
                    if (brightnessLabel) brightnessLabel.textContent = '100%';

                    applyBgImage();
                    setStatus('已恢复默认壁纸。');
                }
            };
        }

        // 透明度滑块
        const opacitySlider = document.getElementById('wallpaper-opacity');
        const opacityLabel = document.getElementById('wallpaper-opacity-label');
        if (opacitySlider && opacityLabel) {
            const S = getS();
            opacitySlider.value = S.get('bgOpacity', '100');
            opacityLabel.textContent = opacitySlider.value + '%';

            opacitySlider.oninput = (e) => {
                const value = e.target.value;
                opacityLabel.textContent = value + '%';
                const S = getS();
                S.set('bgOpacity', value);
                applyBgImage();
            };
        }

        // 亮度滑块
        const brightnessSlider = document.getElementById('wallpaper-brightness');
        const brightnessLabel = document.getElementById('wallpaper-brightness-label');

        if (brightnessSlider && brightnessLabel) {
            const S = getS();
            brightnessSlider.value = S.get('bgBrightness', '100');
            brightnessLabel.textContent = brightnessSlider.value + '%';

            brightnessSlider.oninput = (e) => {
                const value = e.target.value;
                brightnessLabel.textContent = value + '%';
                const S = getS();
                S.set('bgBrightness', value);
                applyBgImage();
            };
        }

        // 初始化壁纸
        applyBgImage();
        const S = getS();
        const hasBg = S.get('bgImage');
        setStatus(hasBg ? '✓ 已加载自定义壁纸（可通过下方滑块调整）' : '使用默认背景（点击上方按钮可上传壁纸）');
    }

    // 导出到全局
    window.Wallpaper = { init, applyBgImage, setStatus };

    // 自动初始化 - 延迟执行确保DOM和S对象都已准备好
    function delayedInit() {
        // 等待S对象定义
        if (!window.S && document.readyState === 'loading') {
            setTimeout(delayedInit, 100);
            return;
        }
        init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // 再延迟一点确保所有脚本都加载完成
            setTimeout(delayedInit, 200);
        });
    } else {
        setTimeout(delayedInit, 200);
    }

})();