/**
 * 在浏览器控制台中执行此脚本来设置 JWT Token
 * 或者将此脚本保存为书签，点击即可自动设置
 */

(function() {
  const API_BASE = 'https://ws10.csie.ntu.edu.tw:54443';
  const ID = '7f3562f4-bb3f-4ec7-89b9-da3b4b5ff250';
  const ID_NO = 'A123456789';

  console.log('🔐 开始获取 JWT Token...');

  fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uuid: ID,
      idNo: ID_NO,
    }),
  })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.data && data.data.token) {
        const token = data.data.token;
        localStorage.setItem('token', token);
        localStorage.setItem('userId', ID);
        localStorage.setItem('idNo', ID_NO);
        
        console.log('✅ JWT Token 已设置到 localStorage');
        console.log('Token (前50字符):', token.substring(0, 50) + '...');
        console.log('用户信息:', data.data.user);
        console.log('');
        console.log('💡 Token 将在所有 API 调用中自动使用');
      } else {
        console.error('❌ 无法获取 Token:', data);
      }
    })
    .catch(error => {
      console.error('❌ 请求失败:', error);
    });
})();

