import { useCallback, useEffect, useState } from 'react'
import './DangerPage.css'
// import SafetyMap from './components/SafetyMap' // 暫時隱藏地圖
import { useFlutterBridge } from './hooks/useFlutterBridge'

const API_BASE_URL = 'https://ws10.csie.ntu.edu.tw:54443'

// API 返回格式接口
interface RoutePoint {
  id: number
  lat: number
  lng: number
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
}

function DangerPage({ onBack }: DangerPageProps) {
  const { sendMessage, lastReply, isAvailable } = useFlutterBridge()
  // const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null) // 暫時未使用
  const [loading, setLoading] = useState(false)
  // 用於顯示的數據
  const [convertedRoutePoints, setConvertedRoutePoints] = useState<RoutePoint[]>([])
  // 內部使用的狀態（保留以備將來使用，但不在頁面上顯示）
  const [, setBackendSearchResponse] = useState<RouteSearchResponse | null>(null)
  const [, setBackendPlanResponse] = useState<RoutePlanResponse | null>(null)
  const [, setRoutePoints] = useState<RoutePoint[]>([])
  const [, setSafePlaces] = useState<SafePlace[]>([])
  const [, setCctvPlaces] = useState<CctvPlace[]>([])
  const [, setProcessedPoints] = useState<ProcessedPoint[]>([])
  // safePlace 目前未使用，但保留以備將來使用
  // const [safePlace, setSafePlace] = useState<{
  //   id: number
  //   name: string
  //   lat: number
  //   lng: number
  //   type: string
  //   foundAtPointIndex: number
  // } | null>(null)

  // 暫時註釋掉用戶位置獲取（地圖已隱藏）
  // useEffect(() => {
  //   // 獲取用戶位置
  //   if (navigator.geolocation) {
  //     navigator.geolocation.getCurrentPosition(
  //       (position) => {
  //         setUserLocation({
  //           lat: position.coords.latitude,
  //           lng: position.coords.longitude,
  //         })
  //       },
  //       () => {
  //         // 如果無法獲取位置，使用預設位置（台北市政府）
  //         setUserLocation({
  //           lat: 25.0375,
  //           lng: 121.5645,
  //         })
  //       }
  //     )
  //   } else {
  //     // 瀏覽器不支持定位，使用預設位置
  //     setUserLocation({
  //       lat: 25.0375,
  //       lng: 121.5645,
  //     })
  //   }
  // }, [])

  /**
   * 將 Flutter 傳來的定位歷史轉換成後端要求的格式
   */
  const convertLocationHistoryToRoutePoints = (
    locationHistory: LocationHistoryEntry[]
  ): RoutePoint[] => {
    // 按時間排序（從舊到新）
    const sorted = [...locationHistory].sort((a, b) => {
      const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0
      const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0
      return timeA - timeB
    })

    // 只取最後十筆
    const lastTen = sorted.slice(-10)

    // 轉換成 RoutePoint 格式（時間格式直接使用 capturedAt，不需要轉換）
    return lastTen.map((entry, index) => ({
      id: index,
      lat: entry.latitude,
      lng: entry.longitude,
      time: entry.capturedAt || new Date().toISOString().replace('Z', '').replace(/\.\d{3}$/, '000000'),
    }))
  }

  const handleGoToSafePlace = async () => {
    console.log('='.repeat(60))
    console.log('[DangerPage] 🚀 開始執行「前往安全處」')
    console.log('='.repeat(60))
    console.log('Flutter Bridge 可用:', isAvailable)
    console.log('當前 lastReply:', lastReply)

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
        await callBackendAPI([])
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
   */
  const callBackendAPI = useCallback(async (points: RoutePoint[]) => {
    // 如果沒有點位數據，使用空數組
    const requestData = points.length > 0 ? { points } : { points: [] }

    console.log('='.repeat(60))
    console.log('[DangerPage] 📤 發送到後端的請求數據')
    console.log('='.repeat(60))
    console.log('請求 URL (route/search):', `${API_BASE_URL}/api/route/search`)
    console.log('請求 URL (route/plan):', `${API_BASE_URL}/api/route/plan`)
    console.log('請求 Body:', JSON.stringify(requestData, null, 2))
    console.log('請求數據中的 points 數量:', requestData.points.length)

    try {
      // 同時調用兩個 API
      const [searchResponse, planResponse] = await Promise.all([
        // 調用 route/search API
        fetch(`${API_BASE_URL}/api/route/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        }),
        // 調用 route/plan API
        fetch(`${API_BASE_URL}/api/route/plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        }),
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
        // 保存後端回傳的數據用於顯示
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
        // 保存後端回傳的數據用於顯示
        setBackendPlanResponse(planData)
        if (planData.success && planData.data) {
          // 提取路線折線（暫時未使用，但保留數據）
          if (planData.data.route?.routes?.[0]?.overview_polyline?.points) {
            // setRoutePolyline(planData.data.route.routes[0].overview_polyline.points)
            console.log('提取的路線 polyline 長度:', planData.data.route.routes[0].overview_polyline.points.length)
          }
          // 提取處理過的點位
          if (planData.data.processedPoints) {
            setProcessedPoints(planData.data.processedPoints)
            console.log('提取的 processedPoints 數量:', planData.data.processedPoints.length)
          }
          // 提取安全點位（目前未使用，但保留以備將來使用）
          // if (planData.data.safePlace) {
          //   setSafePlace(planData.data.safePlace)
          // }
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
        // route/plan 可能因為 API key 問題失敗，但不影響顯示其他數據
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

      // 轉換成後端要求的格式
      const routePoints = convertLocationHistoryToRoutePoints(locationHistory)

      // 保存轉換後的數據用於顯示
      setConvertedRoutePoints(routePoints)

      console.log('='.repeat(60))
      console.log('[DangerPage] 🔄 轉換後的 routePoints')
      console.log('='.repeat(60))
      console.log('轉換後的 routePoints:', JSON.stringify(routePoints, null, 2))
      console.log('routePoints 數量:', routePoints.length)
      console.log('routePoints 範例（前3筆）:', routePoints.slice(0, 3))

      // 調用後端 API
      callBackendAPI(routePoints).catch((error) => {
        console.error('[DangerPage] ❌ 調用後端 API 失敗:', error)
        setLoading(false)
      })
    }
  }, [lastReply, callBackendAPI])

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
            <path d="M15 6L9 12L15 18" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="danger-page__headline">我有危險</span>
        <div className="danger-page__header-spacer" />
      </header>

      <main className="danger-page__content" aria-label="我有危險操作">
        {/* 暫時隱藏地圖以便測試 */}
        {/* <div className="danger-page__map-container">
          <SafetyMap
            userLat={userLocation?.lat}
            userLng={userLocation?.lng}
            routePoints={routePoints}
            safePlaces={safePlaces}
            cctvPlaces={cctvPlaces}
            routePolyline={routePolyline}
            processedPoints={processedPoints}
          />
        </div> */}
        <div className="danger-page__map-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {/* Flutter 原始數據 */}
          <div style={{ background: 'var(--tp-surface)', padding: '1rem', borderRadius: '0.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Flutter 原始數據</h3>
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--tp-text-muted)' }}>
              Flutter Bridge 狀態: {isAvailable ? '✅ 可用' : '❌ 不可用'}
            </p>
            {lastReply ? (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--tp-layer)', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                {JSON.stringify(lastReply, null, 2)}
              </div>
            ) : (
              <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: 'var(--tp-text-muted)' }}>
                尚未收到 Flutter 數據，請點擊「前往安全處」按鈕
              </p>
            )}
          </div>

          {/* 轉換後的格式 */}
          <div style={{ background: 'var(--tp-surface)', padding: '1rem', borderRadius: '0.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>轉換後的格式 (RoutePoint[])</h3>
            {convertedRoutePoints.length > 0 ? (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--tp-layer)', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                {JSON.stringify(convertedRoutePoints, null, 2)}
              </div>
            ) : (
              <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: 'var(--tp-text-muted)' }}>
                尚未轉換數據，請點擊「前往安全處」按鈕
              </p>
            )}
          </div>
        </div>
      </main>

      <div className="danger-page__actions">
        <button type="button" className="danger-page__action-btn">
          匯出資訊
        </button>
        <button
          type="button"
          className="danger-page__action-btn danger-page__action-btn--primary"
          onClick={handleGoToSafePlace}
          disabled={loading}
        >
          {loading ? '載入中...' : '前往安全處'}
        </button>
      </div>

      <footer className="danger-page__footer">撥打 1999 專線 · SafeTrace 測試版</footer>
    </div>
  )
}

export default DangerPage

