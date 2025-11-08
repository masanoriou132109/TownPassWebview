# API JWT Token 检查报告

## ✅ 所有后端 API 请求都已包含 JWT Token

### 1. 统一的 API 工具函数 (`utils/api.ts`)

所有工具函数都会**自动添加 JWT token**：

```typescript
// apiFetch() - 核心函数，自动添加 token
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken() // 从 localStorage 获取 token
  
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  
  // ✅ 如果有 token，自动添加到 Authorization header
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
    console.log('[API] 已添加 JWT token 到请求头')
  }
  
  return fetch(url, { ...options, headers })
}

// apiPost() - 使用 apiFetch，自动包含 token
export async function apiPost(endpoint: string, data: any): Promise<Response> {
  return apiFetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// apiGet() - 使用 apiFetch，自动包含 token
export async function apiGet(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiFetch(`${API_BASE}${endpoint}`, { ...options, method: 'GET' })
}

// apiDelete() - 使用 apiFetch，自动包含 token
export async function apiDelete(endpoint: string, data?: any): Promise<Response> {
  return apiFetch(`${API_BASE}${endpoint}`, { method: 'DELETE', ... })
}
```

### 2. 所有 API 调用检查

#### ✅ `DangerPage.tsx`
```typescript
import { apiPost } from './utils/api'

// ✅ 使用 apiPost，自动包含 JWT token
apiPost('/api/route/search', requestData)
apiPost('/api/route/plan', requestData)
```

#### ✅ `UnsafeReportPage.tsx`
```typescript
import { apiPost } from './utils/api'

// ✅ 使用 apiPost，自动包含 JWT token
apiPost('/api/points', { uuid, time, lat, lon, type })
```

#### ✅ `HomeMap.tsx`
```typescript
import { apiPost } from '../utils/api'

// ✅ 使用 apiPost，自动包含 JWT token
apiPost('/api/danger-zones', { lat, lng, radius, eps, minpoints })
```

#### ✅ `services/api.ts`
```typescript
import { apiGet } from '../utils/api'

// ✅ 使用 apiGet，自动包含 JWT token
apiGet('/api/health')
apiGet('/api/places')
apiGet('/api/places/:id')
```

### 3. 特殊情况（正确行为）

#### ✅ `utils/auth.ts` - 登录 API
```typescript
// ✅ 使用原生 fetch，不包含 token（这是正确的）
// 原因：登录时还没有 token，所以不能使用 apiPost
const response = await fetch(`${API_BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uuid: userId, idNo: userIdNo }),
})
```

## JWT Token 添加流程

1. **获取 Token**: 从 `localStorage.getItem('token')` 获取
2. **添加到 Header**: `Authorization: Bearer ${token}`
3. **错误处理**: 如果收到 401 响应，自动清除本地 token

## 验证方法

所有通过 `apiPost`, `apiGet`, `apiFetch`, `apiDelete` 的请求都会：
- ✅ 自动从 localStorage 获取 JWT token
- ✅ 自动添加到请求头的 `Authorization` 字段
- ✅ 如果 token 无效（401），自动清除并记录警告

## 总结

**✅ 所有需要 JWT token 的后端 API 请求都已确保包含 token！**

- 所有 API 调用都使用统一的工具函数（`apiPost`, `apiGet`, `apiFetch`, `apiDelete`）
- 这些工具函数会自动添加 JWT token 到请求头
- 只有登录 API (`/api/auth/login`) 不使用 token，这是正确的行为

## 检查清单

- [x] `DangerPage.tsx` - 使用 `apiPost` ✅
- [x] `UnsafeReportPage.tsx` - 使用 `apiPost` ✅
- [x] `HomeMap.tsx` - 使用 `apiPost` ✅
- [x] `services/api.ts` - 使用 `apiGet` ✅
- [x] `utils/auth.ts` - 登录 API 使用原生 `fetch`（正确）✅
- [x] 没有其他直接使用 `fetch` 调用后端 API 的地方 ✅
