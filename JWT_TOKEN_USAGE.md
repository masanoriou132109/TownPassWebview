# JWT Token 使用情况总结

## ✅ 已确保所有后端 API 调用都包含 JWT Token

### 1. 统一的 API 工具函数 (`utils/api.ts`)
- ✅ `apiFetch()` - 自动添加 JWT token 到请求头
- ✅ `apiPost()` - POST 请求，自动添加 JWT token
- ✅ `apiGet()` - GET 请求，自动添加 JWT token
- ✅ `apiDelete()` - DELETE 请求，自动添加 JWT token

### 2. 所有使用后端 API 的组件

#### ✅ `DangerPage.tsx`
- 使用 `apiPost('/api/route/search', ...)` - ✅ 自动添加 JWT token
- 使用 `apiPost('/api/route/plan', ...)` - ✅ 自动添加 JWT token

#### ✅ `UnsafeReportPage.tsx`
- 使用 `apiPost('/api/points', ...)` - ✅ 自动添加 JWT token

#### ✅ `HomeMap.tsx`
- 使用 `apiPost('/api/danger-zones', ...)` - ✅ 自动添加 JWT token

#### ✅ `services/api.ts`
- 使用 `apiGet('/api/health')` - ✅ 自动添加 JWT token
- 使用 `apiGet('/api/places')` - ✅ 自动添加 JWT token
- 使用 `apiGet('/api/places/:id')` - ✅ 自动添加 JWT token

### 3. 特殊情况

#### ✅ `utils/auth.ts` - 登录 API
- 使用原生 `fetch()` 调用 `/api/auth/login` - ✅ **这是正确的**
- **原因**: 登录时还没有 token，所以不能使用 `apiPost`（会尝试添加不存在的 token）

## JWT Token 自动添加机制

所有通过 `apiPost`, `apiGet`, `apiFetch`, `apiDelete` 的请求都会：
1. 从 `localStorage.getItem('token')` 获取 token
2. 如果有 token，自动添加到请求头：`Authorization: Bearer ${token}`
3. 如果 token 过期（401 响应），自动清除本地 token

## 验证方法

所有后端 API 调用现在都会：
- ✅ 自动从 localStorage 获取 JWT token
- ✅ 自动添加到请求头的 `Authorization` 字段
- ✅ 如果 token 无效，自动清除并记录警告

## 总结

**所有需要 JWT token 的后端 API 调用都已确保包含 token！**

只有登录 API (`/api/auth/login`) 不使用 token，这是正确的行为。
