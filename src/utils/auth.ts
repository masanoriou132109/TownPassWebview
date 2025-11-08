/**
 * 认证相关工具函数
 */

import { setToken, API_BASE } from './api'

/**
 * 登录并获取 JWT token
 * @param id 用户 ID (UUID)
 * @param idNo 用户身份证号
 */
export async function login(id?: string, idNo?: string): Promise<boolean> {
  try {
    // 如果没有提供参数，使用固定值（fallback）
    const userId = id || '7f3562f4-bb3f-4ec7-89b9-da3b4b5ff250'
    const userIdNo = idNo || 'A123456789'
    
    console.log('[Auth] 开始自动登录获取 JWT token...')
    console.log('[Auth] UUID:', userId)
    
    // 调用登录 API（注意：登录时可能还没有 token，所以使用原生 fetch）
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uuid: userId,
        idNo: userIdNo,
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Auth] 登录失败:', response.status, errorText)
      return false
    }
    
    const data = await response.json()
    
    // 提取 token
    if (data.success && data.data && data.data.token) {
      const token = data.data.token
      setToken(token)
      console.log('[Auth] ✅ 登录成功，token 已保存')
      console.log('[Auth] Token (前50字符):', token.substring(0, 50) + '...')
      
      return true
    } else {
      console.error('[Auth] 登录响应格式错误:', data)
      return false
    }
  } catch (error) {
    console.error('[Auth] 登录过程出错:', error)
    return false
  }
}

/**
 * 检查是否已有 token
 */
export function hasToken(): boolean {
  try {
    const token = localStorage.getItem('token')
    return !!token
  } catch {
    return false
  }
}

