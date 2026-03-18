/**
 * Session 功能验证脚本
 * 在浏览器控制台中运行此脚本来验证 session 存储是否正常工作
 * 
 * 使用方法：
 * 1. 打开浏览器开发者工具 (F12)
 * 2. 切换到 Console 标签
 * 3. 复制粘贴此文件内容并回车
 * 4. 或者在控制台输入：await import('/session-verify.js')
 */

(function() {
  const STORAGE_KEY = 'teleclaws_sessions';
  const SESSION_ID_KEY = 'zeroclaw_session_id';

  console.log('=== ZeroClaw Session 验证工具 ===\n');

  // 1. 检查 localStorage 中的 sessions
  console.log('📦 1. 检查 localStorage 中的 sessions:');
  const sessionsRaw = localStorage.getItem(STORAGE_KEY);
  if (sessionsRaw) {
    try {
      const sessions = JSON.parse(sessionsRaw);
      console.log(`   ✓ 找到 ${sessions.length} 个 session(s)`);
      sessions.forEach((s, i) => {
        console.log(`   [${i + 1}] ${s.id}`);
        console.log(`       标题：${s.title}`);
        console.log(`       消息数：${s.messages.length}`);
        console.log(`       创建时间：${new Date(s.created_at).toLocaleString()}`);
        console.log(`       更新时间：${new Date(s.updated_at).toLocaleString()}`);
        if (s.messages.length > 0) {
          console.log(`       最近消息:`);
          s.messages.slice(-3).forEach(m => {
            console.log(`         - [${m.role}] ${m.content.slice(0, 50)}...`);
          });
        }
      });
    } catch (e) {
      console.error(`   ✗ 解析失败：${e.message}`);
    }
  } else {
    console.log('   ⚠ 没有找到任何 session 数据');
  }

  // 2. 检查 sessionStorage 中的 session_id
  console.log('\n🔑 2. 检查 sessionStorage 中的 session_id:');
  const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (sessionId) {
    console.log(`   ✓ session_id: ${sessionId}`);
  } else {
    console.log('   ⚠ 没有找到 session_id');
  }

  // 3. 验证数据结构
  console.log('\n📋 3. 数据结构验证:');
  if (sessionsRaw) {
    try {
      const sessions = JSON.parse(sessionsRaw);
      if (Array.isArray(sessions)) {
        console.log('   ✓ sessions 是数组');
      } else {
        console.error('   ✗ sessions 应该是数组');
      }

      const requiredFields = ['id', 'title', 'created_at', 'updated_at', 'messages', 'status'];
      sessions.forEach((s, i) => {
        const missing = requiredFields.filter(f => !(f in s));
        if (missing.length === 0) {
          console.log(`   ✓ Session[${i}] 字段完整`);
        } else {
          console.error(`   ✗ Session[${i}] 缺少字段：${missing.join(', ')}`);
        }
      });
    } catch (e) {
      console.error(`   ✗ 验证失败：${e.message}`);
    }
  }

  // 4. 提供测试函数
  console.log('\n🧪 4. 可用的测试函数:');
  console.log('   window.sessionTest.clearAll() - 清空所有 session 数据');
  console.log('   window.sessionTest.createTestSession() - 创建一个测试 session');
  console.log('   window.sessionTest.watchChanges() - 监听 localStorage 变化');

  // 暴露测试函数到全局
  window.sessionTest = {
    clearAll() {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_ID_KEY);
      console.log('✓ 已清空所有 session 数据');
      console.log('请刷新页面以查看效果');
    },

    createTestSession() {
      const now = new Date().toISOString();
      const testSession = {
        id: 'test-' + Date.now(),
        title: '测试会话',
        created_at: now,
        updated_at: now,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: '你好，这是一个测试消息',
            timestamp: now
          },
          {
            id: 'msg-2',
            role: 'agent',
            content: '你好！我是测试回复',
            timestamp: now
          }
        ],
        status: 'active'
      };

      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      sessions.push(testSession);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      console.log('✓ 已创建测试 session:', testSession.id);
      console.log('请刷新页面以查看效果');
      return testSession.id;
    },

    watchChanges() {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          console.log('📡 检测到 session 数据变化:');
          console.log('   旧值:', e.oldValue ? JSON.parse(e.oldValue).length : 0, '个 sessions');
          console.log('   新值:', e.newValue ? JSON.parse(e.newValue).length : 0, '个 sessions');
        }
      });
      console.log('✓ 已开始监听 localStorage 变化');
    }
  };

  console.log('\n=== 验证完成 ===');
})();
