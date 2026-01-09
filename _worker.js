

export default {
    async fetch(request, env, ctx) {
        const 面板管理员密码 = env.ADMIN || env.admin || env.PASSWORD || env.password || env.pswd;
        if (!面板管理员密码) {
            return new Response('请先在变量中设置面板管理员密码', { status: 500 });
        }
        if (env.KV && typeof env.KV.get === 'function') {
            const url = new URL(request.url);
            const UA = request.headers.get('User-Agent') || 'null';
            const 访问路径 = url.pathname.slice(1).toLowerCase();
            const 区分大小写访问路径 = url.pathname.slice(1);

            const 管理员TOKEN = await MD5MD5(面板管理员密码);
            const 临时TOKEN = await MD5MD5(url.hostname + 管理员TOKEN + UA);
            if (区分大小写访问路径 == 'usage.json') {
                let usage_json = usage_json_default;
                if (url.searchParams.get('token') === 临时TOKEN || url.searchParams.get('token') === 管理员TOKEN) {
                    usage_json = await env.KV.get('usage.json', { type: 'json' }) || usage_json;
                    usage_json.success = true;
                    usage_json.total = (usage_json.pages || 0) + (usage_json.workers || 0);
                    usage_json.msg = '成功加载请求数使用数据';
                }
                return new Response(JSON.stringify(usage_json, null, 2), { headers: { 'Content-Type': 'application/json;charset=UTF-8' } });
            } else if (访问路径 == 'admin' || 访问路径.startsWith('admin/')) {
                // 管理面板
            } else if (访问路径.startsWith('api/')) {
                // API接口
                if (访问路径 === 'api/login') {

                }
            } else if (访问路径 === 'robots.txt') return new Response('User-agent: *\nDisallow: /', { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });


            return UsagePanel主页(临时TOKEN);
        } else {
            return new Response('请先绑定一个KV命名空间到变量KV', { status: 500 });
        }
    }
};

////////////////////////////////功能函数//////////////////////////////////
const usage_json_default = {
    success: false, // 是否成功获取使用情况
    pages: 0, // cf的已使用的pages请求数
    workers: 0, // cf的已使用的workers请求数
    total: 0, // cf的已使用的总请求数
    max: 100000, // cf的请求数上限
    msg: '无效TOKEN' // 备注信息
}

async function MD5MD5(文本) {
    const 编码器 = new TextEncoder();

    const 第一次哈希 = await crypto.subtle.digest('MD5', 编码器.encode(文本));
    const 第一次哈希数组 = Array.from(new Uint8Array(第一次哈希));
    const 第一次十六进制 = 第一次哈希数组.map(字节 => 字节.toString(16).padStart(2, '0')).join('');

    const 第二次哈希 = await crypto.subtle.digest('MD5', 编码器.encode(第一次十六进制.slice(7, 27)));
    const 第二次哈希数组 = Array.from(new Uint8Array(第二次哈希));
    const 第二次十六进制 = 第二次哈希数组.map(字节 => 字节.toString(16).padStart(2, '0')).join('');

    return 第二次十六进制.toLowerCase();
}

////////////////////////////////HTML页面//////////////////////////////////

async function UsagePanel主页(TOKEN) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Workers/Pages 请求数使用统计</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.4);
            --accent: #a855f7;
            --background: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --stroke: rgba(255, 255, 255, 0.08);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--background);
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.15) 0px, transparent 50%);
            background-attachment: fixed;
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1.5rem;
        }

        .container {
            width: 100%;
            max-width: 440px;
            animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .glass-card {
            background: var(--card-bg);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--stroke);
            border-radius: 24px;
            padding: 2.5rem;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        header {
            text-align: center;
            margin-bottom: 2.5rem;
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            margin-bottom: 0.5rem;
            letter-spacing: -0.01em;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 99px;
            font-size: 0.75rem;
            color: #818cf8;
            font-weight: 500;
        }

        .status-dot {
            width: 6px;
            height: 6px;
            background: #818cf8;
            border-radius: 50%;
            box-shadow: 0 0 8px var(--primary);
            animation: statusPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes statusPulse {
            0%, 100% {
                box-shadow: 0 0 8px var(--primary), 0 0 0 0 rgba(129, 140, 248, 0.7);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 12px var(--primary), 0 0 0 6px rgba(129, 140, 248, 0);
                transform: scale(1.2);
            }
        }

        .usage-section {
            margin-bottom: 2rem;
            position: relative;
        }

        .usage-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 1rem;
        }

        .label {
            font-size: 0.9rem;
            color: var(--text-muted);
            font-weight: 500;
        }

        .percentage {
            font-family: 'Outfit', monospace;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-main);
            text-shadow: 0 0 20px var(--primary-glow);
        }

        .progress-track {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 999px;
            height: 14px;
            overflow: hidden;
            position: relative;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--accent));
            border-radius: 999px;
            width: 0%;
            transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
        }
        
        .progress-bar::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transform: translateX(-100%);
            animation: shimmer 2.5s infinite;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-top: 1.5rem;
        }

        .mini-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            transition: all 0.3s ease;
        }

        .mini-card:hover {
            background: rgba(255, 255, 255, 0.08);
            transform: translateY(-4px);
            border-color: rgba(255, 255, 255, 0.15);
        }

        .mini-icon {
            font-size: 1.5rem;
            margin-bottom: 0.75rem;
            filter: drop-shadow(0 0 10px rgba(255,255,255,0.1));
        }

        .mini-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-bottom: 0.25rem;
        }

        .mini-value {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-main);
        }

        .total-text {
            text-align: right;
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-top: 0.5rem;
            font-variant-numeric: tabular-nums;
        }

        .footer {
            margin-top: 2.5rem;
            text-align: center;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.2);
            transition: color 0.3s;
        }
        
        .footer:hover {
            color: rgba(255, 255, 255, 0.4);
        }

        .toast-notification {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(99, 102, 241, 0.95));
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(168, 85, 247, 0.5);
            border-radius: 12px;
            padding: 1.25rem 1.5rem;
            color: #fff;
            font-size: 0.95rem;
            font-weight: 500;
            box-shadow: 0 15px 35px rgba(168, 85, 247, 0.3), 0 0 1px rgba(255,255,255,0.1) inset;
            animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 1000;
            max-width: 300px;
            word-break: break-word;
        }

        @keyframes toastSlideIn {
            from { opacity: 0; transform: translateX(30px) translateY(30px); }
            to { opacity: 1; transform: translateX(0) translateY(0); }
        }

        .loading-container {
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 1rem;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top-color: var(--primary);
            animation: spin 1s ease-in-out infinite;
        }

        .error-msg {
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            padding: 1rem;
            border-radius: 12px;
            font-size: 0.9rem;
            border: 1px solid rgba(239, 68, 68, 0.2);
            text-align: center;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
            100% { transform: translateX(100%); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="glass-card">
            <header>
                <h1>CF Workers/Pages 请求数统计</h1>
                <div class="status-badge">
                    <div class="status-dot"></div>
                    <span>System Online</span>
                </div>
            </header>

            <div id="content">
                <div class="loading-container">
                    <div class="spinner"></div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">正在获取数据...</div>
                </div>
            </div>

            <div class="footer">
                由 CF-Workers-UsagePanel 强力驱动
            </div>
        </div>
    </div>

    <script>
        async function fetchUsage() {
            const content = document.getElementById('content');
            try {
                const start = Date.now();
                const response = await fetch('./usage.json?token=${TOKEN}&t=' + start);
                const data = await response.json();
                
                // Artificially wait a bit for smooth UX if too fast
                const elapsed = Date.now() - start;
                if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed));
                
                if (!data.success && typeof data.total === 'undefined') {
                    throw new Error('No Data Available');
                }

                const total = data.total || 0;
                const max = data.max || 100000;
                const percent = Math.min((total / max) * 100, 100).toFixed(1);
                
                content.innerHTML = \`
                    <div class="usage-section">
                        <div class="usage-header">
                            <span class="label">总配额</span>
                            <span class="percentage">\${percent}%</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-bar" style="width: 0%"></div>
                        </div>
                        <div class="total-text">
                            \${total.toLocaleString()} / \${max.toLocaleString()} 请求次数
                        </div>
                    </div>

                    <div class="stats-grid">
                        <div class="mini-card">
                            <div class="mini-icon">⚡️</div>
                            <div class="mini-label">Workers 请求</div>
                            <div class="mini-value">\${(data.workers || 0).toLocaleString()}</div>
                        </div>
                        <div class="mini-card">
                            <div class="mini-icon">📄</div>
                            <div class="mini-label">Pages 请求</div>
                            <div class="mini-value">\${(data.pages || 0).toLocaleString()}</div>
                        </div>
                    </div>
                \`;

                // Animate progress bar
                requestAnimationFrame(() => {
                    const bar = content.querySelector('.progress-bar');
                    if(bar) bar.style.width = percent + '%';
                });

            } catch (error) {
                console.error(error);
                content.innerHTML = \`
                    <div class="error-msg">
                        <div style="margin-bottom: 0.25rem; font-weight: 600;">数据获取失败</div>
                        <div style="font-size: 0.8rem; opacity: 0.8;">\${error.message || '未知错误'}</div>
                    </div>
                \`;
            }
        }
        
        fetchUsage();

        // 1秒后显示消息气泡
        setTimeout(() => {
            fetch('./usage.json?token=${TOKEN}&t=' + Date.now())
                .then(r => r.json())
                .then(data => {
                    const msgElement = document.createElement('div');
                    msgElement.className = 'toast-notification';
                    msgElement.textContent = data.msg || '加载成功';
                    document.body.appendChild(msgElement);
                    
                    // 3秒后自动消失
                    setTimeout(() => {
                        msgElement.style.opacity = '0';
                        msgElement.style.transition = 'opacity 0.4s ease';
                        setTimeout(() => msgElement.remove(), 400);
                    }, 3000);
                })
                .catch(err => {
                    console.error('无法获取消息:', err);
                });
        }, 1000);
    </script>
</body>
</html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
}