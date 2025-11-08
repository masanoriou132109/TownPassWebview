/**
 * API 工具函数
 * 自动添加 JWT token 到请求头
 */

const API_BASE = 'https://ws10.csie.ntu.edu.tw:54443'

/**
 * 获取 JWT token
 * 从 localStorage 获取 token（使用 'token' 作为 key）
 */
function getToken(): string | null {
  try {
    const token = localStorage.getItem('token')
    if (token) {
      console.log('[API] 从 localStorage 获取 token 成功')
    } else {
      console.warn('[API] localStorage 中没有 token')
    }
    return token
  } catch (error) {
    console.warn('[API] 从 localStorage 获取 token 失败:', error)
    return null
  }
}

/**
 * 设置 JWT token
 */
export function setToken(token: string): void {
  try {
    localStorage.setItem('token', token)
  } catch (error) {
    console.error('[API] 保存 token 失败:', error)
  }
}

/**
 * 清除 JWT token
 */
export function clearToken(): void {
  try {
    localStorage.removeItem('token')
  } catch (error) {
    console.error('[API] 清除 token 失败:', error)
  }
}

/**
 * 带 JWT token 的 fetch 请求
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken()

  // 创建新的 Headers 对象，确保不会覆盖已有的 headers
  const headers = new Headers()
  
  // 如果 options.headers 存在，先复制它们
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers.set(key, value)
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers.set(key, value)
      })
    } else {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (value) {
          headers.set(key, String(value))
        }
      })
    }
  }
  
  // 设置 Content-Type（如果还没有设置）
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // 如果有 token，添加到 Authorization header（覆盖可能存在的值）
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
    console.log('[API] ✅ 已添加 JWT token 到请求头:', url)
    console.log('[API] Token (前20字符):', token.substring(0, 20) + '...')
  } else {
    console.warn('[API] ⚠️ 警告: 没有找到 JWT token，请求可能失败:', url)
    console.warn('[API] localStorage.getItem("token"):', localStorage.getItem('token'))
  }

  // 打印所有 headers 用于调试
  console.log('[API] 请求 Headers:')
  headers.forEach((value, key) => {
    if (key === 'Authorization') {
      console.log(`  ${key}: Bearer ${value.substring(7, 27)}...`)
    } else {
      console.log(`  ${key}: ${value}`)
    }
  })

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // 如果 token 过期或无效，清除本地 token
  if (response.status === 401) {
    console.warn('[API] Token 无效或已过期，清除本地 token')
    clearToken()
  }

  return response
}

/**
 * POST 请求
 */
export async function apiPost(
  endpoint: string,
  data: any,
  options: RequestInit = {}
): Promise<Response> {
  return apiFetch(`${API_BASE}${endpoint}`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * GET 请求
 */
export async function apiGet(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return apiFetch(`${API_BASE}${endpoint}`, {
    ...options,
    method: 'GET',
  })
}

/**
 * DELETE 请求
 */
export async function apiDelete(
  endpoint: string,
  data?: any,
  options: RequestInit = {}
): Promise<Response> {
  const fetchOptions: RequestInit = {
    ...options,
    method: 'DELETE',
  }

  if (data) {
    fetchOptions.body = JSON.stringify(data)
  }

  return apiFetch(`${API_BASE}${endpoint}`, fetchOptions)
}

/**
 * API 基础 URL
 */
export { API_BASE }

