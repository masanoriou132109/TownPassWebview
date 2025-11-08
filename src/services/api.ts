// API 基礎 URL，根據實際後端地址調整
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ws10.csie.ntu.edu.tw:54443'
// API Key（如果需要）
const API_KEY = import.meta.env.VITE_API_KEY || ''

/**
 * 安全點位接口（匹配後端 API 回應格式）
 */
export interface Place {
  id: string
  name: string
  type: 'police' | 'fire' | 'shelter' | 'cctv'
  latitude: number // API 返回的字段名
  longitude: number // API 返回的字段名
  address?: string
  phone?: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
  distance?: number // 由後端計算或前端計算的距離
}

/**
 * 後端 API 回應格式
 */
export interface PlacesResponse {
  success: boolean
  data: Place[]
  message: string
}

/**
 * 單一點位回應格式
 */
export interface PlaceResponse {
  success: boolean
  data: Place
  message: string
}

/**
 * 構建請求頭
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY
  }
  return headers
}

/**
 * Health Check API
 * 
 * 請求範例：
 * ```bash
 * curl -k -X GET "https://ws10.csie.ntu.edu.tw:54443/api/health"
 * ```
 */
export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: getHeaders(),
  })
  if (!response.ok) {
    throw new Error('Health check failed')
  }
  return response.json()
}

/**
 * 獲取安全點位列表
 * 
 * @param lat 緯度（可選，用於過濾附近點位）
 * @param lng 經度（可選，用於過濾附近點位）
 * @param types 點位類型過濾（可選）
 * @param radius 搜尋半徑（公里，可選）
 * 
 * 請求範例：
 * ```bash
 * # 取得所有點位
 * curl -k -X GET "https://ws10.csie.ntu.edu.tw:54443/api/places"
 * 
 * # 取得附近點位（帶座標）
 * curl -k -X GET "https://ws10.csie.ntu.edu.tw:54443/api/places?lat=25.0330&lng=121.5654"
 * 
 * # 取得附近點位（帶半徑過濾）
 * curl -k -X GET "https://ws10.csie.ntu.edu.tw:54443/api/places?lat=25.0330&lng=121.5654&radius=5"
 * 
 * # 取得特定類型的點位
 * curl -k -X GET "https://ws10.csie.ntu.edu.tw:54443/api/places?type=police"
 * ```
 */
export async function getPlaces(
  lat?: number,
  lng?: number,
  types?: Place['type'][],
  radius?: number
): Promise<Place[]> {
  const params = new URLSearchParams()
  if (lat !== undefined) params.append('lat', lat.toString())
  if (lng !== undefined) params.append('lng', lng.toString())
  if (types && types.length > 0) {
    types.forEach((type) => params.append('type', type))
  }
  if (radius !== undefined) {
    params.append('radius', radius.toString())
  }

  const url = `${API_BASE_URL}/api/places${params.toString() ? `?${params.toString()}` : ''}`
  
  try {
    const response = await fetch(url, {
      headers: getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`後端 API 回應錯誤: ${response.statusText}`)
    }

    const data: PlacesResponse = await response.json()
    
    if (!data.success) {
      throw new Error(data.message || '獲取安全點位失敗')
    }

    return data.data || []
  } catch (err) {
    // 處理網路錯誤（後端未開啟）
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error('無法連接到後端伺服器，請確認後端服務是否已啟動')
    }
    throw err
  }
}

/**
 * 根據 ID 獲取單一安全點位
 * 
 * @param id 點位 UUID
 * 
 * 請求範例：
 * ```bash
 * curl -k -X GET "https://ws10.csie.ntu.edu.tw:54443/api/places/fd575ad0-f3c5-49f9-8b51-5344d25767c9"
 * ```
 */
export async function getPlaceById(id: string): Promise<Place> {
  const url = `${API_BASE_URL}/api/places/${id}`
  
  try {
    const response = await fetch(url, {
      headers: getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`後端 API 回應錯誤: ${response.statusText}`)
    }

    const data: PlaceResponse = await response.json()
    
    if (!data.success) {
      throw new Error(data.message || '獲取安全點位失敗')
    }

    return data.data
  } catch (err) {
    // 處理網路錯誤（後端未開啟）
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error('無法連接到後端伺服器，請確認後端服務是否已啟動')
    }
    throw err
  }
}

/**
 * Haversine 公式：計算兩點之間的距離（公里）
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // 地球半徑（公里）
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

