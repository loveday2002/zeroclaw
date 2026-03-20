# ZeroClaw 子路径方案 一键部署执行文档

## 目标

用户在 `kavout.com` 点击按钮 → 自动在远程服务器 Docker 启动 ZeroClaw → 通过 `kavout.com/claw/{username}` 访问 → 自动完成认证进入主界面。

---

## 总览：需要改什么

| 改动位置 | 改什么 | 为什么 |
|----------|--------|--------|
| ZeroClaw `web/src/App.tsx` | BrowserRouter 加 basename | 让 React Router 在子路径下正常工作 |
| ZeroClaw `web/src/lib/api.ts` | fetch 请求路径加 basename 前缀 | 让 API 请求走正确的代理路径 |
| ZeroClaw `web/src/lib/ws.ts` | WebSocket URL 加 basename 前缀 | 让 WS 连接走正确的代理路径 |
| ZeroClaw `web/index.html` | 加 `<script>` 读取全局 basename | 让上述三个文件能拿到运行时的前缀 |
| Nginx 配置 | 反代 + sub_filter 注入 | 路由转发 + token 注入 + 设置 basename |
| 编排服务 (Python) | 容器生命周期 + 路径翻译 | 自动部署、配对、代理 |
| kavout.com 前端 | 启动/进入按钮 | 用户交互入口 |

---

## 第一部分：修改 ZeroClaw 源码

### 1.1 克隆仓库

```bash
git clone https://github.com/zeroclaw-labs/zeroclaw.git
cd zeroclaw
git checkout master
```

### 1.2 修改 `web/index.html`

在 `<head>` 中加一行，声明全局 basename 变量的默认值。这个值会被 Nginx 注入的脚本覆盖。

找到 `web/index.html`，在 `<head>` 内的**第一个** `<script>` 标签之前加入：

```html
<head>
  <meta charset="UTF-8" />
  <!-- ↓↓↓ 新增：子路径部署支持，默认为空（根路径部署） ↓↓↓ -->
  <script>window.__CLAW_BASE__ = "";</script>
  <!-- ↑↑↑ 新增 ↑↑↑ -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ...
</head>
```

### 1.3 修改 `web/src/App.tsx`

让 React Router 使用动态的 basename。

找到文件中的 `<Routes>` 外层，应该有一个 `BrowserRouter` 或者在更外层的组件中。根据你提供的代码，路由在 `AppContent` 中直接使用 `<Routes>`，说明 `BrowserRouter` 在入口文件（如 `main.tsx`）中。

**查找 `web/src/main.tsx`（或 `web/src/index.tsx`）中的 BrowserRouter：**

```tsx
// 原代码大致是:
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

**改为：**

```tsx
import { BrowserRouter } from 'react-router-dom';

// 从全局变量读取 basename，Nginx 注入时会设置这个值
const basename = (window as any).__CLAW_BASE__ || "";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>
);
```

**如果 BrowserRouter 在 App.tsx 本身中**（某些项目结构），同样的改法：

```tsx
const basename = (window as any).__CLAW_BASE__ || "";

// 在 JSX 中:
<BrowserRouter basename={basename}>
  <AppContent />
</BrowserRouter>
```

### 1.4 修改 `web/src/lib/api.ts`

ZeroClaw 前端的 API 请求路径需要加上 basename 前缀。

找到 `web/src/lib/api.ts`，它里面应该有一个 `BASE_URL` 或构造 fetch URL 的地方。

**方案 A：如果有统一的 BASE_URL 常量**

```ts
// 原代码可能是:
const BASE_URL = '';

// 改为:
const BASE_URL = (window as any).__CLAW_BASE__ || '';
```

**方案 B：如果用了 axios 或封装的 fetch**

找到创建 axios 实例或封装 fetch 的地方，加上 baseURL：

```ts
// 如果用了 axios:
const client = axios.create({
  baseURL: (window as any).__CLAW_BASE__ || '',
});

// 如果是自己封装的 fetch:
function apiFetch(path: string, options?: RequestInit) {
  const base = (window as any).__CLAW_BASE__ || '';
  return fetch(base + path, options);
}
```

**方案 C：如果找不到统一的入口，用全局 fetch 拦截**

在 `web/src/main.tsx` 的顶部（import 之前）加入：

```ts
// 全局 fetch 拦截 — 自动给 /api 等路径加前缀
const _origFetch = window.fetch;
const _base = (window as any).__CLAW_BASE__ || '';
if (_base) {
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = _base + input;
    }
    return _origFetch.call(this, input, init);
  } as typeof fetch;
}
```

### 1.5 修改 `web/src/lib/ws.ts`

WebSocket 连接的 URL 也需要加前缀。

找到 `web/src/lib/ws.ts`，搜索 `new WebSocket` 或构造 ws URL 的地方：

```ts
// 原代码可能是:
const wsUrl = `${protocol}//${host}/ws/chat`;

// 改为:
const base = (window as any).__CLAW_BASE__ || '';
const wsUrl = `${protocol}//${host}${base}/ws/chat`;
```

### 1.6 修改 `web/src/lib/auth.ts`

加入 URL token 消费函数（配合 Nginx 注入，双保险）：

在文件末尾加入：

```ts
/**
 * 从 URL 参数中读取 token 并存储。
 * 用于外部系统跳转时自动传入认证信息。
 */
export function consumeTokenFromURL(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && token.length > 0) {
      setToken(token);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
      return token;
    }
    return null;
  } catch {
    return null;
  }
}
```

### 1.7 修改 `web/src/hooks/useAuth.ts`

在 AuthProvider 初始化时消费 URL token：

```ts
import {
  getToken as readToken,
  setToken as writeToken,
  clearToken as removeToken,
  isAuthenticated as checkAuth,
  consumeTokenFromURL,           // ← 新增
} from '../lib/auth';

export function AuthProvider({ children }: AuthProviderProps) {
  // ↓↓↓ 新增：在第一次渲染前同步消费 URL 中的 token ↓↓↓
  const [_ready] = useState(() => {
    consumeTokenFromURL();
    return true;
  });
  // ↑↑↑ 新增 ↑↑↑

  const [token, setTokenState] = useState<string | null>(readToken);
  const [authenticated, setAuthenticated] = useState<boolean>(checkAuth);
  // ... 后续代码不变
```

### 1.8 修改 `web/src/components/layout/Layout.tsx`（侧边栏导航）

如果侧边栏的导航链接是硬编码的路径如 `<Link to="/agent">`，因为 BrowserRouter 已经有了 basename，React Router 的 `<Link>` 和 `<NavLink>` 会**自动加上前缀**，所以**不需要改**。

同样 `<Navigate to="/" replace />` 也会自动加前缀。

### 1.9 构建前端

```bash
cd web
npm install
npm run build
# 输出到 web/dist/
cd ..
```

### 1.10 构建 Rust 二进制（包含新前端）

```bash
cargo build --release --locked
# 输出: target/release/zeroclaw
```

### 1.11 构建自定义 Docker 镜像

```dockerfile
# Dockerfile.kavout
# 基于官方 Dockerfile，只是确保用我们修改后的前端

FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM rust:1.77-bookworm AS rust-builder
WORKDIR /build
COPY . .
COPY --from=web-builder /web/dist ./web/dist
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=rust-builder /build/target/release/zeroclaw /usr/local/bin/
ENTRYPOINT ["zeroclaw"]
CMD ["gateway"]
```

```bash
docker build -f Dockerfile.kavout -t kavout/zeroclaw:latest .
```

---

## 第二部分：Nginx 配置

### 文件：`/etc/nginx/conf.d/zeroclaw-claw.conf`

```nginx
server {
    listen 443 ssl;
    server_name kavout.com;

    ssl_certificate     /etc/ssl/certs/kavout.com.pem;
    ssl_certificate_key /etc/ssl/private/kavout.com.key;

    # ─────────────────────────────────────────
    # kavout.com 主站（已有配置）
    # ─────────────────────────────────────────
    # location / { ... }

    # ─────────────────────────────────────────
    # kavout 编排服务 API
    # ─────────────────────────────────────────
    location /api/claw/ {
        proxy_pass http://127.0.0.1:9800;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ─────────────────────────────────────────
    # ZeroClaw 实例反向代理
    # 所有 /claw/{username}/* 请求
    # ─────────────────────────────────────────
    location ~ ^/claw/(?<claw_user>[a-zA-Z0-9_-]+)(?<claw_rest>/.*)?$ {

        proxy_pass http://127.0.0.1:9800;
        proxy_http_version 1.1;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 传递路由信息给编排服务
        proxy_set_header X-Claw-User $claw_user;
        proxy_set_header X-Claw-Path $claw_rest;

        # ★ 禁用上游 gzip，否则 sub_filter 无法匹配 ★
        proxy_set_header Accept-Encoding "";

        # ★ Token 注入 + basename 设置 ★
        sub_filter '</head>' '
<script>
(function(){
  // 设置 basename，供 React Router 和 API 使用
  window.__CLAW_BASE__ = "/claw/$claw_user";

  // Token 自动消费
  var p = new URLSearchParams(location.search);
  var t = p.get("token");
  if (t && t.length > 0) {
    localStorage.setItem("zeroclaw_token", t);
    var u = new URL(location.href);
    u.searchParams.delete("token");
    history.replaceState({}, "", u.toString());
    location.reload();
  }
})();
</script>
</head>';
        sub_filter_once on;
        sub_filter_types text/html;

        # 超时
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

**关键点说明：**

`sub_filter` 在 ZeroClaw 返回的 `index.html` 经过 Nginx 时，往 `</head>` 前注入一段 `<script>`。这段脚本做两件事：

1. 把 `window.__CLAW_BASE__` 从默认的 `""` 覆盖为 `"/claw/alice"`（Nginx 变量 `$claw_user` 会被替换为实际用户名）
2. 检查 URL 中的 `?token=xxx` 参数，有则存入 localStorage 并刷新

因为这段脚本在 `<head>` 中，它在所有其他 JS 之前执行。等 React 应用加载时，`window.__CLAW_BASE__` 已经有值了，BrowserRouter 的 basename、API 的 base URL、WebSocket 的路径前缀都能正确读到。

---

## 第三部分：编排服务

### 文件：`claw_service/requirements.txt`

```
fastapi==0.115.0
uvicorn==0.30.0
docker==7.1.0
httpx==0.27.0
websockets==13.0
```

### 文件：`claw_service/app.py`

```python
"""
Kavout ZeroClaw 编排服务
- 为每个用户管理 ZeroClaw Docker 容器
- 自动配对获取 token
- 反向代理请求到正确的容器（含路径翻译）
"""

import asyncio
import os
import re
import time
import logging

import docker
import httpx
from fastapi import FastAPI, Request, HTTPException, WebSocket
from fastapi.responses import RedirectResponse, Response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("claw-service")

app = FastAPI(title="Kavout ZeroClaw Orchestrator")
docker_client = docker.from_env()

# ============================================================
# 配置
# ============================================================

PORT_BASE = 43000
PORT_MAX = 43999
ZEROCLAW_IMAGE = "kavout/zeroclaw:latest"
DATA_ROOT = "/opt/kavout-claw/data/zeroclaw"
HEALTH_TIMEOUT = 60
HEALTH_INTERVAL = 2

# ============================================================
# 实例存储（生产环境用 Redis / DB）
# ============================================================

instances: dict = {}


def _next_port() -> int:
    used = {v["port"] for v in instances.values()}
    for port in range(PORT_BASE, PORT_MAX + 1):
        if port not in used:
            return port
    raise RuntimeError("No available ports")


def _extract_pairing_code(logs: str) -> str:
    match = re.search(r'│\s*(\d{6})\s*│', logs)
    if match:
        return match.group(1)
    match = re.search(r'(?:PAIRING|pairing|code)[^\d]*(\d{6})', logs, re.IGNORECASE)
    if match:
        return match.group(1)
    raise RuntimeError("Cannot extract pairing code from logs")


def _get_api_key(username: str) -> str:
    """从数据库/配置获取用户的 API key"""
    # TODO: 替换为你的实际实现
    return os.environ.get("DEFAULT_ANTHROPIC_API_KEY", "")


# ============================================================
# 部署 API
# ============================================================

@app.post("/api/claw/provision")
async def provision(request: Request):
    body = await request.json()
    username = body.get("username", "").strip()

    if not username or not re.match(r'^[a-zA-Z0-9_-]+$', username):
        raise HTTPException(400, "Invalid username")

    # 已有运行中实例
    if username in instances and instances[username]["status"] == "running":
        try:
            c = docker_client.containers.get(f"zeroclaw-{username}")
            if c.status == "running":
                return {"status": "ready", "url": f"/claw/{username}/"}
        except docker.errors.NotFound:
            instances.pop(username, None)

    port = _next_port()
    data_dir = os.path.join(DATA_ROOT, username)
    os.makedirs(data_dir, exist_ok=True)

    # ① 清理残留容器
    try:
        old = docker_client.containers.get(f"zeroclaw-{username}")
        old.remove(force=True)
    except docker.errors.NotFound:
        pass

    # ② 启动容器
    logger.info(f"Starting ZeroClaw for {username} on port {port}")
    container = docker_client.containers.run(
        ZEROCLAW_IMAGE,
        command=["gateway"],
        name=f"zeroclaw-{username}",
        ports={"42617/tcp": ("127.0.0.1", port)},
        volumes={data_dir: {"bind": "/root/.zeroclaw", "mode": "rw"}},
        environment={
            "ZEROCLAW_PROVIDER": "anthropic",
            "ANTHROPIC_API_KEY": _get_api_key(username),
        },
        detach=True,
        restart_policy={"Name": "unless-stopped"},
        mem_limit="512m",
        cpu_quota=50000,
        cpu_period=100000,
    )

    # ③ 等待就绪
    start_time = time.time()
    healthy = False
    async with httpx.AsyncClient() as client:
        while time.time() - start_time < HEALTH_TIMEOUT:
            try:
                resp = await client.get(f"http://127.0.0.1:{port}/health", timeout=3)
                if resp.status_code == 200 and resp.json().get("status") == "ok":
                    healthy = True
                    break
            except Exception:
                pass
            await asyncio.sleep(HEALTH_INTERVAL)

    if not healthy:
        container.remove(force=True)
        raise HTTPException(500, "ZeroClaw failed to start")

    # ④ 提取配对码
    logs = container.logs().decode("utf-8", errors="replace")
    try:
        pairing_code = _extract_pairing_code(logs)
    except RuntimeError as e:
        container.remove(force=True)
        raise HTTPException(500, str(e))

    # ⑤ 自动配对
    async with httpx.AsyncClient() as client:
        pair_resp = await client.post(
            f"http://127.0.0.1:{port}/pair",
            headers={"X-Pairing-Code": pairing_code},
        )
    if pair_resp.status_code != 200:
        container.remove(force=True)
        raise HTTPException(500, f"Pairing failed: {pair_resp.text}")

    token = pair_resp.json()["token"]

    # ⑥ 存储
    instances[username] = {
        "container_id": container.id,
        "port": port,
        "token": token,
        "status": "running",
        "created_at": time.time(),
    }

    logger.info(f"ZeroClaw for {username} ready on port {port}")
    return {"status": "ready", "url": f"/claw/{username}/"}


@app.get("/api/claw/{username}/enter")
async def enter_claw(username: str, request: Request):
    """点击进入 → 带 token 的 302 跳转"""
    # TODO: 验证当前登录用户身份
    if username not in instances:
        raise HTTPException(404, "Instance not found")
    token = instances[username]["token"]
    return RedirectResponse(
        url=f"/claw/{username}/?token={token}",
        status_code=302
    )


@app.get("/api/claw/{username}/status")
async def claw_status(username: str):
    if username not in instances:
        return {"status": "not_provisioned"}
    try:
        c = docker_client.containers.get(f"zeroclaw-{username}")
        return {"status": c.status, "port": instances[username]["port"]}
    except docker.errors.NotFound:
        return {"status": "removed"}


@app.post("/api/claw/{username}/stop")
async def stop_claw(username: str):
    if username not in instances:
        raise HTTPException(404, "Instance not found")
    try:
        c = docker_client.containers.get(f"zeroclaw-{username}")
        c.stop(timeout=10)
        c.remove()
    except docker.errors.NotFound:
        pass
    instances[username]["status"] = "stopped"
    return {"status": "stopped"}


# ============================================================
# 反向代理：路径翻译 + 转发
# ============================================================

# ZeroClaw 后端能处理的路径前缀
BACKEND_PREFIXES = (
    "assets/", "_app/", "api/", "health", "metrics",
    "pair", "webhook", "ws/", "favicon.ico", "logo.png",
    "sse/",
)


def _resolve_upstream_path(path: str) -> str:
    """
    将 /claw/{user}/{path} 中的 path 翻译为 ZeroClaw 容器内的路径。

    静态资源、API、WebSocket → 原样转发
    其他（SPA 前端路由）→ 返回 /（index.html）
    """
    if not path or path == "/":
        return "/"
    # 去掉开头的 /
    clean = path.lstrip("/")
    for prefix in BACKEND_PREFIXES:
        if clean.startswith(prefix) or clean == prefix.rstrip("/"):
            return "/" + clean
    # SPA 路由：/agent, /tools, /config 等 → 返回 index.html
    return "/"


@app.api_route(
    "/claw/{username}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
)
@app.api_route(
    "/claw/{username}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
)
async def proxy_to_claw(username: str, request: Request, path: str = ""):
    """反向代理到用户的 ZeroClaw 容器"""

    if username not in instances or instances[username]["status"] != "running":
        return Response("Instance not found or not running", status_code=404)

    port = instances[username]["port"]
    upstream_path = _resolve_upstream_path(path)
    target_url = f"http://127.0.0.1:{port}{upstream_path}"

    if request.query_params:
        target_url += f"?{request.query_params}"

    # 构造转发头
    skip = {"host", "connection", "transfer-encoding", "accept-encoding"}
    forward_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in skip
    }

    body = await request.body()

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                content=body,
                follow_redirects=False,
            )
        except httpx.ConnectError:
            return Response("Cannot connect to ZeroClaw instance", status_code=502)

    content = resp.content
    resp_headers = dict(resp.headers)

    # 清理冲突头
    for h in ["content-encoding", "content-length", "transfer-encoding"]:
        resp_headers.pop(h, None)

    content_type = resp_headers.get("content-type", "")

    # ── HTML 响应：重写资源路径 ──
    # 将 src="/assets/... 改为 src="/claw/{user}/assets/...
    # 这样浏览器请求静态资源时路径会带上前缀，
    # Nginx 再转回编排服务，编排服务再转到容器
    if "text/html" in content_type:
        html = content.decode("utf-8", errors="replace")
        base_prefix = f"/claw/{username}"
        html = re.sub(r'(src|href)="/', rf'\1="{base_prefix}/', html)
        content = html.encode("utf-8")

    resp_headers["content-length"] = str(len(content))

    return Response(
        content=content,
        status_code=resp.status_code,
        headers=resp_headers,
    )


# ============================================================
# WebSocket 代理
# ============================================================

import websockets as ws_lib

@app.websocket("/claw/{username}/ws/{ws_path:path}")
async def proxy_websocket(websocket: WebSocket, username: str, ws_path: str = "chat"):
    if username not in instances or instances[username]["status"] != "running":
        await websocket.close(code=4004, reason="Instance not found")
        return

    port = instances[username]["port"]
    target = f"ws://127.0.0.1:{port}/ws/{ws_path}"

    # 提取子协议（ZeroClaw 用 Sec-WebSocket-Protocol: bearer.TOKEN 认证）
    subprotocols = websocket.headers.get("sec-websocket-protocol", "").split(", ")
    subprotocols = [s.strip() for s in subprotocols if s.strip()]

    await websocket.accept(subprotocol=subprotocols[0] if subprotocols else None)

    try:
        async with ws_lib.connect(
            target,
            subprotocols=subprotocols if subprotocols else None,
        ) as upstream:
            async def client_to_upstream():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await upstream.send(data)
                except Exception:
                    pass

            async def upstream_to_client():
                try:
                    async for msg in upstream:
                        await websocket.send_text(msg)
                except Exception:
                    pass

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_to_upstream()),
                    asyncio.create_task(upstream_to_client()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception as e:
        logger.error(f"WebSocket proxy error for {username}: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ============================================================
# 启动
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9800)
```

---

## 第四部分：kavout.com 前端组件

```tsx
// components/ClawPanel.tsx
import { useState, useEffect } from 'react';

export default function ClawPanel({ username }: { username: string }) {
  const [status, setStatus] = useState<
    'checking' | 'idle' | 'provisioning' | 'running' | 'stopped'
  >('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/claw/${username}/status`)
      .then(r => r.json())
      .then(d => setStatus(d.status === 'running' ? 'running' : 'idle'))
      .catch(() => setStatus('idle'));
  }, [username]);

  const handleStart = async () => {
    setError('');
    setStatus('provisioning');
    try {
      const res = await fetch('/api/claw/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      setStatus('running');
    } catch (e: any) {
      setError(e.message);
      setStatus('idle');
    }
  };

  const handleEnter = () => {
    window.open(`/api/claw/${username}/enter`, '_blank');
  };

  const handleStop = async () => {
    await fetch(`/api/claw/${username}/stop`, { method: 'POST' });
    setStatus('stopped');
  };

  if (status === 'checking') return <p>检查实例状态...</p>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">ZeroClaw AI 助手</h2>

      {(status === 'idle' || status === 'stopped') && (
        <button onClick={handleStart}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {status === 'stopped' ? '重新启动' : '一键启动 ZeroClaw'}
        </button>
      )}

      {status === 'provisioning' && (
        <div className="flex items-center gap-3 text-gray-600">
          <span className="h-5 w-5 border-2 border-blue-500 border-t-transparent
                           rounded-full animate-spin" />
          正在部署，约需 10-30 秒...
        </div>
      )}

      {status === 'running' && (
        <div className="flex gap-3">
          <button onClick={handleEnter}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
            进入 ZeroClaw 控制台
          </button>
          <button onClick={handleStop}
            className="px-4 py-3 border border-red-300 text-red-600
                       rounded-lg hover:bg-red-50">
            停止
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
    </div>
  );
}
```

---

## 第五部分：部署步骤清单

### 5.1 服务器环境准备

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 创建目录
mkdir -p /opt/kavout-claw/{claw_service,data/zeroclaw,nginx}

# 安装 Python 依赖
cd /opt/kavout-claw/claw_service
pip install fastapi uvicorn docker httpx websockets

# 确保 Nginx 已安装
apt install nginx -y
```

### 5.2 构建自定义镜像

```bash
# 在修改后的 zeroclaw 源码目录下
docker build -f Dockerfile.kavout -t kavout/zeroclaw:latest .
```

### 5.3 部署编排服务

```bash
# 复制 app.py 到服务器
scp claw_service/app.py server:/opt/kavout-claw/claw_service/

# 创建 systemd 服务
cat > /etc/systemd/system/kavout-claw.service << 'EOF'
[Unit]
Description=Kavout ZeroClaw Orchestrator
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/kavout-claw/claw_service
ExecStart=/usr/bin/python3 -m uvicorn app:app --host 127.0.0.1 --port 9800
Restart=always
RestartSec=5
Environment=DEFAULT_ANTHROPIC_API_KEY=sk-ant-xxx

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now kavout-claw
```

### 5.4 配置 Nginx

```bash
# 复制配置
cp /opt/kavout-claw/nginx/zeroclaw-claw.conf /etc/nginx/conf.d/

# 测试 & 重载
nginx -t && systemctl reload nginx
```

### 5.5 端到端验证

```bash
# ① 部署实例
curl -s -X POST http://127.0.0.1:9800/api/claw/provision \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}' | python3 -m json.tool
# 预期: {"status": "ready", "url": "/claw/testuser/"}

# ② 查看状态
curl -s http://127.0.0.1:9800/api/claw/testuser/status | python3 -m json.tool
# 预期: {"status": "running", "port": 43000}

# ③ 获取带 token 的跳转链接
curl -sI http://127.0.0.1:9800/api/claw/testuser/enter
# 预期: HTTP 302, Location: /claw/testuser/?token=abc123...

# ④ 测试 HTML 中是否注入了脚本（通过 Nginx）
curl -s https://kavout.com/claw/testuser/ | grep '__CLAW_BASE__'
# 预期: 能看到 window.__CLAW_BASE__ = "/claw/testuser";

# ⑤ 测试静态资源路径是否被重写
curl -s https://kavout.com/claw/testuser/ | grep 'src="/claw/testuser/assets'
# 预期: 能看到重写后的路径

# ⑥ 浏览器中打开
# https://kavout.com/claw/testuser/?token=abc123
# 预期: 直接进入 ZeroClaw 主界面，地址栏显示 /claw/testuser/
# 点击侧边栏 "Agent" → 地址栏变为 /claw/testuser/agent
```

---

## 请求完整流程

```
用户点击"一键启动"
    │
    ▼
POST /api/claw/provision {"username":"alice"}
    │  编排服务：
    │  ├─ docker run kavout/zeroclaw --name zeroclaw-alice -p 127.0.0.1:43000:42617
    │  ├─ 轮询 GET http://127.0.0.1:43000/health → 等到 {"status":"ok"}
    │  ├─ 读 container.logs() → 正则提取 "485291"
    │  ├─ POST http://127.0.0.1:43000/pair  X-Pairing-Code: 485291
    │  │   → {"token":"a1b2c3d4e5f6"}
    │  └─ 存储 instances["alice"] = {port:43000, token:"a1b2c3..."}
    ▼
返回 {"status":"ready"}
前端按钮变为"进入 ZeroClaw 控制台"

用户点击"进入"
    │
    ▼
GET /api/claw/alice/enter
    │  编排服务：
    │  └─ 302 → /claw/alice/?token=a1b2c3d4e5f6
    ▼
浏览器跳转到 /claw/alice/?token=a1b2c3d4e5f6
    │
    ▼
Nginx 匹配 location /claw/alice/*
    │  ├─ proxy_pass → 编排服务 (9800)
    │  │   ├─ 路径翻译: /claw/alice/ → upstream / (index.html)
    │  │   ├─ 转发到 http://127.0.0.1:43000/
    │  │   ├─ ZeroClaw 返回 index.html
    │  │   └─ 编排服务重写 HTML: src="/assets → src="/claw/alice/assets
    │  │
    │  └─ sub_filter 注入:
    │      ├─ window.__CLAW_BASE__ = "/claw/alice"
    │      └─ token 消费脚本
    ▼
浏览器收到修改后的 HTML
    │
    ├─ 注入脚本执行（最先运行，在 <head> 中）:
    │   ├─ window.__CLAW_BASE__ = "/claw/alice"    ← basename 设置好了
    │   ├─ 读到 ?token=a1b2c3...
    │   ├─ localStorage.setItem("zeroclaw_token", "a1b2c3...")
    │   ├─ URL → /claw/alice/  (token 参数消失)
    │   └─ location.reload()
    │
    ▼
页面刷新，ZeroClaw React 应用加载
    │
    ├─ main.tsx: basename = window.__CLAW_BASE__ → "/claw/alice"
    ├─ <BrowserRouter basename="/claw/alice">
    │   React Router 看到 pathname=/claw/alice/ → 去掉 basename → 匹配 /
    │   → 渲染 <Dashboard />
    │
    ├─ useAuth: checkAuth() → localStorage 有 token → authenticated=true
    │   → 跳过 PairingDialog ✅
    │
    ├─ 用户点击侧边栏 "Agent"
    │   React Router: pushState("/agent")
    │   因为有 basename，实际 URL → /claw/alice/agent
    │
    ├─ API 请求: fetch("/api/status")
    │   api.ts 中: BASE_URL = window.__CLAW_BASE__ → "/claw/alice"
    │   实际请求 → /claw/alice/api/status
    │   Nginx → 编排服务 → 路径翻译 /api/status → http://127.0.0.1:43000/api/status
    │
    └─ WebSocket: connect("/ws/chat")
        ws.ts 中: base = window.__CLAW_BASE__ → "/claw/alice"
        实际连接 → wss://kavout.com/claw/alice/ws/chat
        Nginx (upgrade) → 编排服务 WS 代理 → ws://127.0.0.1:43000/ws/chat
```

---

## 常见问题排查

### Q: 页面空白，控制台报 404 加载 JS/CSS 失败

**原因**: HTML 中资源路径没有被正确重写。

**检查**: `curl -s https://kavout.com/claw/testuser/ | grep 'src='`，看路径是否以 `/claw/testuser/` 开头。

**修复**: 确认编排服务的 HTML 重写逻辑正确，确认 Nginx 的 `proxy_set_header Accept-Encoding ""` 已设置。

### Q: 进入后显示配对对话框，没有自动跳过

**原因**: token 没有成功写入 localStorage。

**检查**: 浏览器控制台看 `localStorage.getItem("zeroclaw_token")` 是否有值。查看页面源码确认注入脚本存在。

**修复**: 确认 `sub_filter` 配置正确，确认 `Accept-Encoding` 头已清除。

### Q: 点击侧边栏导航后页面空白

**原因**: BrowserRouter 的 basename 没有生效。

**检查**: 浏览器控制台输入 `window.__CLAW_BASE__`，应该返回 `"/claw/testuser"`。

**修复**: 确认 `main.tsx` 中已正确读取 `__CLAW_BASE__` 并传给 BrowserRouter。

### Q: API 请求 404

**原因**: fetch 路径没有加上前缀。

**检查**: 浏览器 Network 面板看请求的完整 URL。

**修复**: 确认 `api.ts` 中使用了 `__CLAW_BASE__` 作为前缀。如果用了全局 fetch 拦截方案，确认拦截代码在 `main.tsx` 最顶部。

### Q: WebSocket 连接失败

**原因**: WS URL 没有前缀，或 Nginx 没有转发 Upgrade 头。

**检查**: 浏览器 Network 面板 → WS 标签，看连接的 URL 和状态码。

**修复**: 确认 `ws.ts` 加了前缀；确认 Nginx 配置了 `proxy_set_header Upgrade` 和 `Connection "upgrade"`。
