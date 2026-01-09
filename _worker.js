

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
            const 管理员COOKIE = await MD5MD5(管理员TOKEN + UA);

            // 验证管理员Cookie的函数
            const 验证管理员Cookie = () => {
                const cookies = request.headers.get('Cookie') || '';
                const cookieMatch = cookies.match(/admin_token=([^;]+)/);
                return cookieMatch && cookieMatch[1] === 管理员COOKIE;
            };

            if (访问路径 == 'usage.json') {// 请求数使用数据接口 Usage.json
                let usage_json = usage_json_default;
                if (url.searchParams.get('token') === 临时TOKEN || url.searchParams.get('token') === 管理员TOKEN) {
                    usage_json = await env.KV.get('usage.json', { type: 'json' }) || usage_json;
                    usage_json.success = true;
                    usage_json.total = (usage_json.pages || 0) + (usage_json.workers || 0);
                    usage_json.msg = '✅ 成功加载请求数使用数据';
                }
                return new Response(JSON.stringify(usage_json, null, 2), { headers: { 'Content-Type': 'application/json;charset=UTF-8' } });
            } else if (访问路径 == 'admin' || 访问路径.startsWith('admin/') || 区分大小写访问路径 === 'config.json') {// 管理员面板
                // 管理面板 - 验证Cookie
                if (!验证管理员Cookie()) {
                    return new Response(null, {
                        status: 302,
                        headers: { 'Location': '/' }
                    });
                }

                if (区分大小写访问路径 === 'admin/config.json') {
                    const usage_config_json = await env.KV.get('usage_config.json', { type: 'json' }) || [];
                    return new Response(JSON.stringify(usage_config_json, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' } });
                }

                return new Response('管理面板（开发中）', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
                });
            } else if (区分大小写访问路径.startsWith('api/') && request.method === 'POST') {// API接口
                if (区分大小写访问路径 === 'api/login') {
                    try {
                        const body = await request.json();
                        const 输入密码 = body.password || '';
                        if (输入密码 === 面板管理员密码) {
                            // 密码正确，设置Cookie
                            return new Response(JSON.stringify({ success: true, msg: '登录成功' }), {
                                status: 200,
                                headers: {
                                    'Content-Type': 'application/json;charset=UTF-8',
                                    'Set-Cookie': `admin_token=${管理员COOKIE}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
                                }
                            });
                        } else {
                            return new Response(JSON.stringify({ success: false, msg: '密码错误' }), {
                                status: 401,
                                headers: { 'Content-Type': 'application/json;charset=UTF-8' }
                            });
                        }
                    } catch (e) {
                        return new Response(JSON.stringify({ success: false, msg: '请求格式错误' }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
                        });
                    }
                }

                if (!验证管理员Cookie()) {
                    return new Response(null, {
                        status: 302,
                        headers: { 'Location': '/' }
                    });
                }

                if (区分大小写访问路径 === 'api/add') {
                    // 增加CF账号（开发中）
                } else if (区分大小写访问路径 === 'api/del') {
                    // 删除CF账号（开发中）
                } else if (区分大小写访问路径 === 'api/check') {
                    try {
                        const Usage_JSON = await getCloudflareUsage(url.searchParams.get('Email'), url.searchParams.get('GlobalAPIKey'), url.searchParams.get('AccountID'), url.searchParams.get('APIToken'));
                        return new Response(JSON.stringify(Usage_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    } catch (err) {
                        const errorResponse = { msg: '查询请求量失败，失败原因：' + err.message, error: err.message };
                        return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
                    }
                }
            } else if (访问路径 === 'robots.txt') {
                return new Response('User-agent: *\nDisallow: /', { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
            }
            
            /*
            if (访问路径 === 'test') {
                const usage = await 更新请求数(env);
                return new Response(JSON.stringify(usage, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' } });
            }
            */

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
    max: 0, // cf的请求数上限
    msg: '❌ 无效TOKEN' // 备注信息
}

async function 更新请求数(env) {
    let usage_config_json = await env.KV.get('usage_config.json', { type: 'json' });
    let usage_json = { ...usage_json_default };
    
    if (!usage_config_json) {
        // 不存在则创建一个空的配置文件
        usage_config_json = [];
        await env.KV.put('usage_config.json', JSON.stringify(usage_config_json));
        usage_json.success = true;
        usage_json.msg = '⚠️ 尚未添加任何Cloudflare账号';
        await env.KV.put('usage.json', JSON.stringify(usage_json));
    } else if (Array.isArray(usage_config_json) && usage_config_json.length > 0) {
        // 如果存在则遍历配置文件中的每个账号，获取使用情况
        // 累加所有账号的使用数据
        let total_pages = 0;
        let total_workers = 0;
        let total_max = 0;
        
        for (let i = 0; i < usage_config_json.length; i++) {
            const account = usage_config_json[i];
            const { Email, GlobalAPIKey, AccountID, APIToken } = account;
            
            // 获取该账号的使用情况
            const usage = await getCloudflareUsage(Email, GlobalAPIKey, AccountID, APIToken);
            
            // 更新到该账号的 Usage 中
            usage_config_json[i].Usage = usage;
            usage_config_json[i].最后更新时间 = Date.now();
            
            // 累加使用数据
            if (usage.success) {
                total_pages += usage.pages || 0;
                total_workers += usage.workers || 0;
                total_max += usage.max || 100000;
            }
        }
        
        // 遍历完成后保存 usage_config_json 回 KV
        await env.KV.put('usage_config.json', JSON.stringify(usage_config_json));
        
        // 将所有账号的数据累加到 usage_json 中并保存回 KV
        usage_json.success = true;
        usage_json.pages = total_pages;
        usage_json.workers = total_workers;
        usage_json.total = total_pages + total_workers;
        usage_json.max = total_max;
        usage_json.msg = '✅ 成功更新请求数使用数据';
        await env.KV.put('usage.json', JSON.stringify(usage_json));
    } else {
        // 配置文件存在但为空数组或无效格式
        usage_json.success = true;
        usage_json.msg = '⚠️ 尚未添加任何Cloudflare账号';
        await env.KV.put('usage.json', JSON.stringify(usage_json));
    }
    
    return usage_json;
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

async function getCloudflareUsage(Email, GlobalAPIKey, AccountID, APIToken) {
    const API = "https://api.cloudflare.com/client/v4";
    const sum = (a) => a?.reduce((t, i) => t + (i?.sum?.requests || 0), 0) || 0;
    const cfg = { "Content-Type": "application/json" };

    try {
        if (!AccountID && (!Email || !GlobalAPIKey)) return { success: false, pages: 0, workers: 0, total: 0, max: 100000 };

        if (!AccountID) {
            const r = await fetch(`${API}/accounts`, {
                method: "GET",
                headers: { ...cfg, "X-AUTH-EMAIL": Email, "X-AUTH-KEY": GlobalAPIKey }
            });
            if (!r.ok) throw new Error(`账户获取失败: ${r.status}`);
            const d = await r.json();
            if (!d?.result?.length) throw new Error("未找到账户");
            const idx = d.result.findIndex(a => a.name?.toLowerCase().startsWith(Email.toLowerCase()));
            AccountID = d.result[idx >= 0 ? idx : 0]?.id;
        }

        const now = new Date();
        now.setUTCHours(0, 0, 0, 0);
        const hdr = APIToken ? { ...cfg, "Authorization": `Bearer ${APIToken}` } : { ...cfg, "X-AUTH-EMAIL": Email, "X-AUTH-KEY": GlobalAPIKey };

        const res = await fetch(`${API}/graphql`, {
            method: "POST",
            headers: hdr,
            body: JSON.stringify({
                query: `query getBillingMetrics($AccountID: String!, $filter: AccountWorkersInvocationsAdaptiveFilter_InputObject) {
                    viewer { accounts(filter: {accountTag: $AccountID}) {
                        pagesFunctionsInvocationsAdaptiveGroups(limit: 1000, filter: $filter) { sum { requests } }
                        workersInvocationsAdaptive(limit: 10000, filter: $filter) { sum { requests } }
                    } }
                }`,
                variables: { AccountID, filter: { datetime_geq: now.toISOString(), datetime_leq: new Date().toISOString() } }
            })
        });

        if (!res.ok) throw new Error(`查询失败: ${res.status}`);
        const result = await res.json();
        if (result.errors?.length) throw new Error(result.errors[0].message);

        const acc = result?.data?.viewer?.accounts?.[0];
        if (!acc) throw new Error("未找到账户数据");

        const pages = sum(acc.pagesFunctionsInvocationsAdaptiveGroups);
        const workers = sum(acc.workersInvocationsAdaptive);
        const total = pages + workers;
        const max = 100000;
        console.log(`统计结果 - Pages: ${pages}, Workers: ${workers}, 总计: ${total}, 上限: 100000`);
        return { success: true, pages, workers, total, max };

    } catch (error) {
        console.error('获取使用量错误:', error.message);
        return { success: false, pages: 0, workers: 0, total: 0, max: 100000 };
    }
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

        /* 管理员登录气泡 */
        .admin-bubble {
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
            transition: all 0.3s ease;
            z-index: 1001;
        }

        .admin-bubble:hover {
            transform: scale(1.1);
            box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
        }

        .admin-bubble svg {
            width: 24px;
            height: 24px;
            fill: white;
        }

        /* 登录模态框 */
        .login-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            animation: fadeIn 0.3s ease;
        }

        .login-modal-overlay.active {
            display: flex;
        }

        .login-modal {
            background: var(--card-bg);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--stroke);
            border-radius: 20px;
            padding: 2rem;
            width: 90%;
            max-width: 360px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(30px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-modal h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            text-align: center;
            background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .login-input {
            width: 100%;
            padding: 0.875rem 1rem;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: var(--text-main);
            font-size: 1rem;
            font-family: 'Outfit', sans-serif;
            outline: none;
            transition: all 0.3s ease;
            margin-bottom: 1rem;
        }

        .login-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .login-input::placeholder {
            color: var(--text-muted);
        }

        .login-btn {
            width: 100%;
            padding: 0.875rem;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            border: none;
            border-radius: 12px;
            color: white;
            font-size: 1rem;
            font-weight: 600;
            font-family: 'Outfit', sans-serif;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        }

        .login-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .login-error {
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            padding: 0.75rem 1rem;
            border-radius: 10px;
            font-size: 0.85rem;
            margin-bottom: 1rem;
            border: 1px solid rgba(239, 68, 68, 0.2);
            text-align: center;
            display: none;
        }

        .login-error.show {
            display: block;
            animation: shake 0.4s ease;
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
        }

        .close-modal {
            position: absolute;
            top: 1rem;
            right: 1rem;
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            color: var(--text-muted);
            font-size: 1.25rem;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s ease;
        }

        .close-modal:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }

        .login-modal-wrapper {
            position: relative;
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
    <!-- 管理员登录气泡 -->
    <div class="admin-bubble" onclick="openLoginModal()" title="管理员登录">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
    </div>

    <!-- 登录模态框 -->
    <div class="login-modal-overlay" id="loginModal">
        <div class="login-modal-wrapper">
            <div class="login-modal">
                <button class="close-modal" onclick="closeLoginModal()">&times;</button>
                <h2>🔐 管理员登录</h2>
                <div class="login-error" id="loginError"></div>
                <input type="password" class="login-input" id="adminPassword" placeholder="请输入管理员密码" onkeydown="if(event.key==='Enter')handleLogin()">
                <button class="login-btn" id="loginBtn" onclick="handleLogin()">登 录</button>
            </div>
        </div>
    </div>

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

        // 管理员登录相关函数
        function openLoginModal() {
            document.getElementById('loginModal').classList.add('active');
            document.getElementById('adminPassword').focus();
        }

        function closeLoginModal() {
            document.getElementById('loginModal').classList.remove('active');
            document.getElementById('adminPassword').value = '';
            document.getElementById('loginError').classList.remove('show');
        }

        // 点击模态框外部关闭
        document.getElementById('loginModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeLoginModal();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeLoginModal();
            }
        });

        async function handleLogin() {
            const password = document.getElementById('adminPassword').value;
            const loginBtn = document.getElementById('loginBtn');
            const errorDiv = document.getElementById('loginError');

            if (!password) {
                errorDiv.textContent = '请输入密码';
                errorDiv.classList.add('show');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = '登录中...';
            errorDiv.classList.remove('show');

            try {
                const response = await fetch('./api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await response.json();

                if (data.success) {
                    // 登录成功，跳转到管理面板
                    window.location.href = './admin';
                } else {
                    errorDiv.textContent = data.msg || '登录失败';
                    errorDiv.classList.add('show');
                    document.getElementById('adminPassword').select();
                }
            } catch (err) {
                errorDiv.textContent = '网络错误，请重试';
                errorDiv.classList.add('show');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = '登 录';
            }
        }

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