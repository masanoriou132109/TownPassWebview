import { useCallback, useEffect, useState } from 'react'
import './DangerPage.css'
import SafetyMap from './components/SafetyMap'
import HamburgerMenu from './components/HamburgerMenu'
import { useFlutterBridge } from './hooks/useFlutterBridge'
import { apiPost } from './utils/api'

const API_BASE_URL = 'https://ws10.csie.ntu.edu.tw:54443'

// API 请求格式接口（后端使用 lng）
interface RoutePointRequest {
  id: number
  lat: number
  lng: number // 后端使用 lng
  time: string
  searchRadius?: number
}

// API 返回格式接口（后端可能返回 lng）
interface RoutePoint {
  id: number
  lat: number
  lng: number // 后端返回可能使用 lng
  time: string
  searchRadius?: number
}

interface LocationHistoryEntry {
  latitude: number
  longitude: number
  capturedAt?: string
}

interface SafePlace {
  id: number
  name: string
  lat: number
  lng: number
  type: string
  distance: number
  pointIndex: number
  radius: number
}

interface CctvPlace {
  id: number
  uuid: string
  lat: number
  lng: number
  owner: string
  distance: number
  type: string
  pointIndex: number
  radius: number
}

// 新的最近安全空間 API 返回格式
interface ForwardSafePlaceResponse {
  success: boolean
  data: {
    direction: {
      slope: number
      intercept: number
      vector: {
        x: number
        y: number
      }
    }
    reference_point: {
      lat: number
      lng: number
    }
    points: Array<{
      lat: number
      lng: number
      searchRadius: number
    }>
    safe_places: Array<{
      id: number
      name: string
      lat: number
      lng: number
      type: string
      distance: number
    }>
    nearest_safe_place: {
      id: number
      name: string
      lat: number
      lng: number
      type: string
      distance: number
    }
    route: {
      distance: string
      duration: string
      start_address: string
      end_address: string
      steps: Array<{
        distance: string
        duration: string
        instruction: string
        start_location: {
          lat: number
          lng: number
        }
        end_location: {
          lat: number
          lng: number
        }
        polyline: string
      }>
      overview_polyline: string
    }
  }
  message: string
}

// 保留旧的 RouteSearchResponse 用于兼容（如果需要）
interface RouteSearchResponse {
  success: boolean
  data: {
    points: RoutePoint[]
    safePlaces: SafePlace[]
    cctv: CctvPlace[]
    summary: {
      totalSafePlaces: number
      totalCctv: number
      pointsWithSafePlaces: number
      pointsWithCctv: number
    }
  }
  message: string
}

interface ProcessedPoint {
  lat: number
  lng: number
  originalId: number
  type: string
  relocatedToCctv: boolean
  cctvId?: number
}

// RoutePlanResponse 用于原路安全空間 API
interface RoutePlanResponse {
  success: boolean
  data?: {
    route?: {
      geocoded_waypoints?: Array<{
        geocoder_status: string
        place_id: string
        types: string[]
      }>
      routes?: Array<{
        bounds?: {
          northeast: { lat: number; lng: number }
          southwest: { lat: number; lng: number }
        }
        legs?: Array<{
          distance: { text: string; value: number }
          duration: { text: string; value: number }
          start_address: string
          end_address: string
          start_location: { lat: number; lng: number }
          end_location: { lat: number; lng: number }
          steps: Array<{
            distance: { text: string; value: number }
            duration: { text: string; value: number }
            html_instructions: string
            polyline: { points: string }
            start_location: { lat: number; lng: number }
            end_location: { lat: number; lng: number }
            travel_mode: string
            maneuver?: string
          }>
        }>
        overview_polyline?: {
          points: string
        }
        summary?: string
        warnings?: string[]
        waypoint_order?: number[]
      }>
      status: string
    }
    safePlace?: {
      id: number
      name: string
      lat: number
      lng: number
      type: string
      foundAtPointIndex: number
    }
    processedPoints?: ProcessedPoint[]
  }
  error?: string
  message?: string
}

interface DangerPageProps {
  onBack: () => void
  onNavigateToDangerMap?: () => void
  onNavigateToReportList?: () => void
  onNavigateToSettings?: () => void
}

function DangerPage({ onBack, onNavigateToDangerMap, onNavigateToReportList, onNavigateToSettings }: DangerPageProps) {
  const { sendMessage, lastReply, isAvailable } = useFlutterBridge()
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  // 用於地圖顯示的狀態
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([])
  const [cctvPlaces, setCctvPlaces] = useState<CctvPlace[]>([])
  const [processedPoints, setProcessedPoints] = useState<ProcessedPoint[]>([])
  const [routePolyline, setRoutePolyline] = useState<string | null>(null)
  // 用於顯示的數據（保留以備將來使用）
  const [, setFlutterRawData] = useState<any>(null)
  const [, setConvertedRoutePoints] = useState<RoutePointRequest[]>([])
  const [backendSearchResponse, setBackendSearchResponse] = useState<RouteSearchResponse | ForwardSafePlaceResponse | null>(null)
  const [backendPlanResponse, setBackendPlanResponse] = useState<RoutePlanResponse | null>(null)
  const [isForwardSafePlace, setIsForwardSafePlace] = useState(true) // 标记当前使用的是哪个 API
  // safePlace 目前未使用，但保留以備將來使用
  // const [safePlace, setSafePlace] = useState<{
  //   id: number
  //   name: string
  //   lat: number
  //   lng: number
  //   type: string
  //   foundAtPointIndex: number
  // } | null>(null)

  // 獲取用戶位置
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        () => {
          // 如果無法獲取位置，使用預設位置（台北市政府）
          setUserLocation({
            lat: 25.0375,
            lng: 121.5645,
          })
        }
      )
    } else {
      // 瀏覽器不支持定位，使用預設位置
      setUserLocation({
        lat: 25.0375,
        lng: 121.5645,
      })
    }
  }, [])

  /**
   * 將 Flutter 傳來的定位歷史轉換成後端要求的格式
   */
  const convertLocationHistoryToRoutePoints = (
    locationHistory: LocationHistoryEntry[]
  ): RoutePointRequest[] => {
    // 如果沒有數據，返回空數組
    if (!locationHistory || locationHistory.length === 0) {
      return []
    }

    // 按時間排序（從舊到新）
    const sorted = [...locationHistory].sort((a, b) => {
      const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0
      const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0
      return timeA - timeB
    })

    // 判斷數據筆數：超過十筆取最後十筆，小於等於十筆全取
    const selectedPoints = sorted.length > 10 ? sorted.slice(-10) : sorted

    // 轉換成 RoutePoint 格式
    // 時間格式：後端要求的格式為 2025-11-08T05:25:00:000000（微秒精度，使用冒號分隔，無 'Z' 後綴）
    return selectedPoints.map((entry, index) => {
      let timeStr = entry.capturedAt || new Date().toISOString()

      // 移除 'Z' 後綴（如果存在）
      if (timeStr.endsWith('Z')) {
        timeStr = timeStr.slice(0, -1)
      }

      // 解析時間字符串
      // Flutter 可能提供的格式：
      // - 2025-11-08T05:25:00.000000 (ISO 格式，點號分隔)
      // - 2025-11-08T05:25:00.123 (毫秒精度)
      // - 2025-11-08T05:25:00 (無小數部分)
      const timeMatch = timeStr.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?$/)

      if (timeMatch) {
        const baseTime = timeMatch[1] // 基礎時間部分：2025-11-08T05:25:00
        const fractionalPart = timeMatch[2] || '' // 小數部分（包含點號）：.123 或 .000000

        // 提取小數點後的數字，並確保為 6 位數（微秒精度）
        const microseconds = fractionalPart.slice(1).padEnd(6, '0').slice(0, 6)
        // 後端要求使用冒號分隔：2025-11-08T05:25:00:000000
        timeStr = `${baseTime}:${microseconds}`
      } else {
        // 如果格式不匹配，使用 Date 對象重新格式化
        const date = new Date(entry.capturedAt || new Date())
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        // 後端要求使用冒號分隔：2025-11-08T05:25:00:000000
        timeStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}:000000`
      }

      return {
        id: index, // ID 从 0 开始，范围 0~9
        lat: entry.latitude,
        lng: entry.longitude, // 后端使用 lng
        time: timeStr,
      }
    })
  }

  const handleGoToSafePlace = async () => {
    console.log('='.repeat(60))
    console.log('[DangerPage] 🚀 開始執行「最近安全空間」')
    console.log('='.repeat(60))
    console.log('Flutter Bridge 可用:', isAvailable)
    console.log('當前 lastReply:', lastReply)

    setIsForwardSafePlace(true) // 标记使用最近安全空間 API
    setLoading(true)
    try {
      // 先從 Flutter 獲取定位歷史
      if (isAvailable) {
        console.log('[DangerPage] 📤 向 Flutter 發送 location_history 請求...')
        console.log('請求參數: { minutes: 30, limit: 120 }')
        sendMessage('location_history', { minutes: 30, limit: 120 })
        console.log('[DangerPage] ⏳ 等待 Flutter 回傳數據...')
        // 等待 Flutter 回傳數據（通過 useEffect 監聽 lastReply）
        return // 先返回，等待數據回傳後再處理
      } else {
        console.warn('='.repeat(60))
        console.warn('[DangerPage] ⚠️ Flutter bridge 不可用')
        console.warn('='.repeat(60))
        console.warn('將使用空數組調用後端 API')
        // 如果 Flutter bridge 不可用，使用預設數據或直接調用 API
        await callBackendAPI([], true)
      }
    } catch (error) {
      console.error('='.repeat(60))
      console.error('[DangerPage] ❌ 處理失敗')
      console.error('='.repeat(60))
      console.error('錯誤:', error)
      setLoading(false)
    }
  }

  const handleGoToOriginalRouteSafePlace = async () => {
    console.log('='.repeat(60))
    console.log('[DangerPage] 🚀 開始執行「原路安全空間」')
    console.log('='.repeat(60))
    console.log('Flutter Bridge 可用:', isAvailable)
    console.log('當前 lastReply:', lastReply)

    setIsForwardSafePlace(false) // 标记使用原路安全空間 API
    setLoading(true)
    try {
      // 先從 Flutter 獲取定位歷史
      if (isAvailable) {
        console.log('[DangerPage] 📤 向 Flutter 發送 location_history 請求...')
        console.log('請求參數: { minutes: 30, limit: 120 }')
        sendMessage('location_history', { minutes: 30, limit: 120 })
        console.log('[DangerPage] ⏳ 等待 Flutter 回傳數據...')
        // 等待 Flutter 回傳數據（通過 useEffect 監聽 lastReply）
        return // 先返回，等待數據回傳後再處理
      } else {
        console.warn('='.repeat(60))
        console.warn('[DangerPage] ⚠️ Flutter bridge 不可用')
        console.warn('='.repeat(60))
        console.warn('將使用空數組調用後端 API')
        // 如果 Flutter bridge 不可用，使用預設數據或直接調用 API
        await callBackendAPI([], false)
      }
    } catch (error) {
      console.error('='.repeat(60))
      console.error('[DangerPage] ❌ 處理失敗')
      console.error('='.repeat(60))
      console.error('錯誤:', error)
      setLoading(false)
    }
  }

  /**
   * 調用後端 API
   * @param points 定位歷史點位
   * @param isForwardSafePlace true = 最近安全空間 (find-forward-safe-place), false = 原路安全空間 (route/search + route/plan)
   */
  const callBackendAPI = useCallback(async (points: RoutePointRequest[], isForwardSafePlace: boolean = true) => {
    if (isForwardSafePlace) {
      // 最近安全空間：調用 find-forward-safe-place API
      const apiPoints = points.map(p => ({ lat: p.lat, lng: p.lng }))
      const requestData = apiPoints.length > 0 
        ? { points: apiPoints, radius: 500 } 
        : { points: [], radius: 500 }

      console.log('='.repeat(60))
      console.log('[DangerPage] 📤 發送到後端的請求數據（最近安全空間）')
      console.log('='.repeat(60))
      console.log('請求 URL (route/find-forward-safe-place):', `${API_BASE_URL}/api/route/find-forward-safe-place`)
      console.log('請求 Body:', JSON.stringify(requestData, null, 2))
      console.log('請求數據中的 points 數量:', requestData.points.length)

      try {
        const response = await apiPost('/api/route/find-forward-safe-place', requestData)

      console.log('='.repeat(60))
      console.log('[DangerPage] 📥 後端 API 回應狀態')
      console.log('='.repeat(60))
      console.log('route/find-forward-safe-place 狀態:', response.status, response.statusText)

      // 處理回應
      if (response.ok) {
        const responseData: ForwardSafePlaceResponse = await response.json()
        console.log('='.repeat(60))
        console.log('[DangerPage] ✅ Forward Safe Place 回應數據')
        console.log('='.repeat(60))
        console.log('完整回應:', JSON.stringify(responseData, null, 2))
        
        // 保存後端回傳的數據用於顯示
        setBackendSearchResponse(responseData)
        
        if (responseData.success && responseData.data) {
          // 轉換 points 格式（用於顯示，但不顯示 Circle）
          const convertedPoints: RoutePoint[] = responseData.data.points.map((p, idx) => ({
            id: idx,
            lat: p.lat,
            lng: p.lng,
            time: '',
            searchRadius: p.searchRadius,
          }))
          setRoutePoints(convertedPoints)
          
          // 轉換 safe_places 格式
          const convertedSafePlaces: SafePlace[] = responseData.data.safe_places.map(sp => ({
            id: sp.id,
            name: sp.name,
            lat: sp.lat,
            lng: sp.lng,
            type: sp.type,
            distance: sp.distance,
            pointIndex: 0, // 新 API 沒有 pointIndex，使用 0
            radius: 0, // 新 API 沒有 radius，使用 0
          }))
          setSafePlaces(convertedSafePlaces)
          
          // 新 API 沒有 CCTV 數據，清空
          setCctvPlaces([])
          
          // 提取路線折線
          if (responseData.data.route?.overview_polyline) {
            setRoutePolyline(responseData.data.route.overview_polyline)
            console.log('提取的路線 polyline 長度:', responseData.data.route.overview_polyline.length)
          }
          
          // 新 API 沒有 processedPoints，清空
          setProcessedPoints([])
          
          console.log('提取的數據:')
          console.log('  - points 數量:', convertedPoints.length)
          console.log('  - safe_places 數量:', convertedSafePlaces.length)
          console.log('  - nearest_safe_place:', responseData.data.nearest_safe_place)
          console.log('  - route overview_polyline 長度:', responseData.data.route?.overview_polyline?.length || 0)
        }
      } else {
        const errorText = await response.text()
        console.error('='.repeat(60))
        console.error('[DangerPage] ❌ Forward Safe Place 失敗')
        console.error('='.repeat(60))
        console.error('狀態碼:', response.status)
        console.error('狀態文字:', response.statusText)
        console.error('錯誤內容:', errorText)
      }
      } catch (error) {
        console.error('='.repeat(60))
        console.error('[DangerPage] ❌ API 調用異常')
        console.error('='.repeat(60))
        console.error('錯誤:', error)
        if (error instanceof Error) {
          console.error('錯誤訊息:', error.message)
          console.error('錯誤堆疊:', error.stack)
        }
      } finally {
        setLoading(false)
        console.log('='.repeat(60))
        console.log('[DangerPage] ✅ 處理完成')
        console.log('='.repeat(60))
      }
    } else {
      // 原路安全空間：調用 route/search 和 route/plan API
      const requestData = points.length > 0 ? { points } : { points: [] }

      console.log('='.repeat(60))
      console.log('[DangerPage] 📤 發送到後端的請求數據（原路安全空間）')
      console.log('='.repeat(60))
      console.log('請求 URL (route/search):', `${API_BASE_URL}/api/route/search`)
      console.log('請求 URL (route/plan):', `${API_BASE_URL}/api/route/plan`)
      console.log('請求 Body:', JSON.stringify(requestData, null, 2))
      console.log('請求數據中的 points 數量:', requestData.points.length)

      try {
        // 同時調用兩個 API
        const [searchResponse, planResponse] = await Promise.all([
          apiPost('/api/route/search', requestData),
          apiPost('/api/route/plan', requestData),
        ])

        console.log('='.repeat(60))
        console.log('[DangerPage] 📥 後端 API 回應狀態')
        console.log('='.repeat(60))
        console.log('route/search 狀態:', searchResponse.status, searchResponse.statusText)
        console.log('route/plan 狀態:', planResponse.status, planResponse.statusText)

        // 處理 route/search 回應
        if (searchResponse.ok) {
          const searchData: RouteSearchResponse = await searchResponse.json()
          console.log('='.repeat(60))
          console.log('[DangerPage] ✅ Route Search 回應數據')
          console.log('='.repeat(60))
          console.log('完整回應:', JSON.stringify(searchData, null, 2))
          setBackendSearchResponse(searchData)
          if (searchData.success && searchData.data) {
            setRoutePoints(searchData.data.points || [])
            setSafePlaces(searchData.data.safePlaces || [])
            setCctvPlaces(searchData.data.cctv || [])
            console.log('提取的數據:')
            console.log('  - points 數量:', searchData.data.points?.length || 0)
            console.log('  - safePlaces 數量:', searchData.data.safePlaces?.length || 0)
            console.log('  - cctv 數量:', searchData.data.cctv?.length || 0)
            console.log('  - summary:', searchData.data.summary)
          }
        } else {
          const errorText = await searchResponse.text()
          console.error('='.repeat(60))
          console.error('[DangerPage] ❌ Route Search 失敗')
          console.error('='.repeat(60))
          console.error('狀態碼:', searchResponse.status)
          console.error('狀態文字:', searchResponse.statusText)
          console.error('錯誤內容:', errorText)
        }

        // 處理 route/plan 回應
        if (planResponse.ok) {
          const planData: RoutePlanResponse = await planResponse.json()
          console.log('='.repeat(60))
          console.log('[DangerPage] ✅ Route Plan 回應數據')
          console.log('='.repeat(60))
          console.log('完整回應:', JSON.stringify(planData, null, 2))
          setBackendPlanResponse(planData)
          if (planData.success && planData.data) {
            // 提取路線折線
            if (planData.data.route?.routes?.[0]?.overview_polyline?.points) {
              setRoutePolyline(planData.data.route.routes[0].overview_polyline.points)
              console.log('提取的路線 polyline 長度:', planData.data.route.routes[0].overview_polyline.points.length)
            }
            // 提取處理過的點位
            if (planData.data.processedPoints) {
              setProcessedPoints(planData.data.processedPoints)
              console.log('提取的 processedPoints 數量:', planData.data.processedPoints.length)
            }
            console.log('提取的數據:')
            console.log('  - route 狀態:', planData.data.route?.status)
            console.log('  - safePlace:', planData.data.safePlace)
            console.log('  - processedPoints 數量:', planData.data.processedPoints?.length || 0)
          }
        } else {
          const planError = await planResponse.json().catch(() => ({ error: '無法解析 JSON' }))
          console.warn('='.repeat(60))
          console.warn('[DangerPage] ⚠️ Route Plan 失敗')
          console.warn('='.repeat(60))
          console.warn('狀態碼:', planResponse.status)
          console.warn('錯誤內容:', JSON.stringify(planError, null, 2))
        }
      } catch (error) {
        console.error('='.repeat(60))
        console.error('[DangerPage] ❌ API 調用異常')
        console.error('='.repeat(60))
        console.error('錯誤:', error)
        if (error instanceof Error) {
          console.error('錯誤訊息:', error.message)
          console.error('錯誤堆疊:', error.stack)
        }
      } finally {
        setLoading(false)
        console.log('='.repeat(60))
        console.log('[DangerPage] ✅ 處理完成')
        console.log('='.repeat(60))
      }
    }
  }, [])

  /**
   * 監聽 Flutter 回傳的定位歷史數據
   */
  useEffect(() => {
    if (lastReply?.name === 'location_history' && Array.isArray(lastReply.data)) {
      console.log('='.repeat(60))
      console.log('[DangerPage] 📥 收到 Flutter 定位歷史數據')
      console.log('='.repeat(60))
      console.log('原始數據 (lastReply):', JSON.stringify(lastReply, null, 2))
      console.log('數據類型:', typeof lastReply.data, Array.isArray(lastReply.data))
      console.log('數據長度:', Array.isArray(lastReply.data) ? lastReply.data.length : 'N/A')

      const locationHistory = lastReply.data as LocationHistoryEntry[]
      console.log('解析後的 locationHistory:', locationHistory)
      console.log('locationHistory 範例（前3筆）:', locationHistory.slice(0, 3))

      // 保存 Flutter 原始數據
      setFlutterRawData(lastReply)

      // 轉換成後端要求的格式
      const routePoints = convertLocationHistoryToRoutePoints(locationHistory)

      // 保存轉換後的數據用於顯示
      setConvertedRoutePoints(routePoints)

      console.log('='.repeat(60))
      console.log('[DangerPage] 🔄 轉換後的 routePoints')
      console.log('='.repeat(60))
      console.log('原始數據數量:', locationHistory.length)
      console.log('轉換後 routePoints 數量:', routePoints.length)
      console.log('轉換後的 routePoints:', JSON.stringify(routePoints, null, 2))
      console.log('routePoints 範例（前3筆）:', routePoints.slice(0, 3))
      console.log('時間格式檢查:')
      routePoints.forEach((point, idx) => {
        // 檢查格式：2025-11-08T05:25:00:000000
        const isValidFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}:\d{6}$/.test(point.time)
        console.log(`  點位 ${idx}: ${point.time} (格式: ${isValidFormat ? '✅ 正確' : '❌ 錯誤'})`)
      })

      // 調用後端 API（使用當前選擇的模式）
      callBackendAPI(routePoints, isForwardSafePlace).catch((error) => {
        console.error('[DangerPage] ❌ 調用後端 API 失敗:', error)
        setLoading(false)
      })
    }
  }, [lastReply, callBackendAPI, isForwardSafePlace])

  return (
    <div className="danger-page">
      <header className="danger-page__header">
        <button
          type="button"
          className="danger-page__nav-btn"
          aria-label="返回"
          onClick={onBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="danger-page__headline">我有危險</span>
        <HamburgerMenu 
          onShowDangerMap={onNavigateToDangerMap}
          onShowReportList={onNavigateToReportList}
          onShowSettings={onNavigateToSettings}
        />
      </header>

      <main className="danger-page__content" aria-label="我有危險操作">
        <div className="danger-page__map-container">
          <SafetyMap
            userLat={userLocation?.lat}
            userLng={userLocation?.lng}
            routePoints={routePoints}
            safePlaces={safePlaces}
            cctvPlaces={cctvPlaces}
            routePolyline={routePolyline}
            processedPoints={processedPoints}
            showRoutePointCircles={!isForwardSafePlace} // 最近安全空間不顯示半徑圓，原路安全空間顯示
          />
        </div>
      </main>

      {/* 後端原始數據顯示區域 */}
      {(backendSearchResponse || backendPlanResponse) && (
        <div className="danger-page__backend-data">
          <div className="danger-page__backend-data-header">
            <span className="danger-page__backend-data-title">後端原始數據</span>
          </div>
          <div className="danger-page__backend-data-content">
            {backendSearchResponse && (
              <div className="danger-page__backend-data-section">
                <div className="danger-page__backend-data-section-title">
                  {isForwardSafePlace ? 'Forward Safe Place 回應:' : 'Route Search 回應:'}
                </div>
                <pre className="danger-page__backend-data-json">
                  {JSON.stringify(backendSearchResponse, null, 2)}
                </pre>
              </div>
            )}
            {backendPlanResponse && (
              <div className="danger-page__backend-data-section">
                <div className="danger-page__backend-data-section-title">Route Plan 回應:</div>
                <pre className="danger-page__backend-data-json">
                  {JSON.stringify(backendPlanResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="danger-page__actions">
        <button
          type="button"
          className="danger-page__action-btn danger-page__action-btn--primary"
          onClick={handleGoToSafePlace}
          disabled={loading}
        >
          {loading ? '載入中...' : '最近安全空間'}
        </button>
        <button
          type="button"
          className="danger-page__action-btn"
          onClick={handleGoToOriginalRouteSafePlace}
          disabled={loading}
        >
          {loading ? '載入中...' : '原路安全空間'}
        </button>
      </div>

      <footer className="danger-page__footer">本服務僅供非緊急事件使用，緊急狀態請撥打119</footer>
    </div>
  )
}

export default DangerPage

