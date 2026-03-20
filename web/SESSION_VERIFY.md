# Session 功能验证方法

## 方法一：使用验证脚本（推荐）

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 复制粘贴以下代码并回车：

```javascript
// 快速验证 - 复制粘贴到控制台
const KEY = 'teleclaws_sessions';
const sessions = JSON.parse(localStorage.getItem(KEY) || '[]');
console.log('Sessions:', sessions.length);
sessions.forEach((s, i) => {
  console.log(`${i + 1}. ${s.title} - ${s.messages.length} 条消息`);
  console.log(`   ID: ${s.id}`);
  console.log(`   更新：${new Date(s.updated_at).toLocaleString()}`);
});
```

## 方法二：使用 Chrome DevTools

1. 打开开发者工具 (F12)
2. 切换到 **Application** 标签
3. 左侧选择 **Local Storage** → 你的域名
4. 查看 `teleclaws_sessions` 键的值
5. 点击值可以查看完整的 JSON 数据

## 方法三：使用验证脚本文件

1. 在页面中加载脚本：
```javascript
await import('/session-verify.js');
```

2. 使用提供的测试函数：
```javascript
// 查看所有 sessions
// (会自动打印到控制台)

// 清空所有数据
window.sessionTest.clearAll();

// 创建测试数据
window.sessionTest.createTestSession();

// 监听变化
window.sessionTest.watchChanges();
```

## 验证步骤

### 步骤 1：发送消息前
```javascript
// 控制台输入
JSON.parse(localStorage.getItem('teleclaws_sessions'))
// 应该返回 [] 或 null
```

### 步骤 2：发送一条消息
```
你好，测试 session 功能
```

### 步骤 3：检查存储
```javascript
// 控制台输入
const sessions = JSON.parse(localStorage.getItem('teleclaws_sessions'));
console.log(JSON.stringify(sessions, null, 2));
```

### 期望输出
```json
[
  {
    "id": "uuid-xxxx-xxxx-...",
    "title": "你好，测试 session 功能",
    "created_at": "2026-03-18T...",
    "updated_at": "2026-03-18T...",
    "messages": [
      {
        "id": "uuid-...",
        "role": "user",
        "content": "你好，测试 session 功能",
        "timestamp": "..."
      },
      {
        "id": "uuid-...",
        "role": "agent",
        "content": "回复内容...",
        "timestamp": "..."
      }
    ],
    "status": "active"
  }
]
```

## Session ID 验证（WebSocket）

```javascript
// 检查 sessionStorage 中的 session_id
sessionStorage.getItem('zeroclaw_session_id')
// 应该返回一个 UUID 格式的字符串
```

## 常见问题

### Q: localStorage 是空的？
A: 确保你已经发送了至少一条消息，session 会在第一次发送消息时创建。

### Q: 数据没有持久化？
A: 检查浏览器是否禁用了 localStorage，或者使用了隐私/无痕模式。

### Q: 如何清空测试数据？
```javascript
localStorage.removeItem('teleclaws_sessions');
sessionStorage.removeItem('zeroclaw_session_id');
location.reload();
```
