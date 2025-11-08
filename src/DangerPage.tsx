import { useEffect, useState } from 'react'
import './DangerPage.css'
import SafetyMap from './components/SafetyMap'
import routeData from './data/route-data.json'

const API_BASE_URL = 'https://ws10.csie.ntu.edu.tw:54443'

// API 返回格式接口
interface RoutePoint {
  id: number
  lat: number
  lng: number
  time: string
  searchRadius?: number
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([])
  const [cctvPlaces, setCctvPlaces] = useState<CctvPlace[]>([])
  const [routePolyline, setRoutePolyline] = useState<string | null>(null)
  const [processedPoints, setProcessedPoints] = useState<ProcessedPoint[]>([])
  const [safePlace, setSafePlace] = useState<{
    id: number
    name: string
    lat: number
    lng: number
    type: string
    foundAtPointIndex: number
  } | null>(null)

  useEffect(() => {
    // 獲取用戶位置
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

  const handleGoToSafePlace = async () => {
    setLoading(true)
    try {
      // 同時調用兩個 API
      const [searchResponse, planResponse] = await Promise.all([
        // 調用 route/search API
        fetch(`${API_BASE_URL}/api/route/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(routeData),
        }),
        // 調用 route/plan API
        fetch(`${API_BASE_URL}/api/route/plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(routeData),
        }),
      ])

      // 處理 route/search 回應
      if (searchResponse.ok) {
        const searchData: RouteSearchResponse = await searchResponse.json()
        if (searchData.success && searchData.data) {
          setRoutePoints(searchData.data.points || [])
          setSafePlaces(searchData.data.safePlaces || [])
          setCctvPlaces(searchData.data.cctv || [])
          console.log('Route Search 成功:', searchData.data)
        }
      } else {
        console.error('Route Search 失敗:', searchResponse.statusText)
      }

      // 處理 route/plan 回應
      if (planResponse.ok) {
        const planData: RoutePlanResponse = await planResponse.json()
        if (planData.success && planData.data) {
          // 提取路線折線
          if (planData.data.route?.routes?.[0]?.overview_polyline?.points) {
            setRoutePolyline(planData.data.route.routes[0].overview_polyline.points)
          }
          // 提取處理過的點位
          if (planData.data.processedPoints) {
            setProcessedPoints(planData.data.processedPoints)
          }
          // 提取安全點位
          if (planData.data.safePlace) {
            setSafePlace(planData.data.safePlace)
          }
          console.log('Route Plan 成功:', planData.data)
        }
      } else {
        const planError = await planResponse.json()
        console.warn('Route Plan 失敗:', planError)
        // route/plan 可能因為 API key 問題失敗，但不影響顯示其他數據
      }
    } catch (error) {
      console.error('API 調用失敗:', error)
    } finally {
      setLoading(false)
    }
  }

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
        <div className="danger-page__map-container">
          <SafetyMap
            userLat={userLocation?.lat}
            userLng={userLocation?.lng}
            routePoints={routePoints}
            safePlaces={safePlaces}
            cctvPlaces={cctvPlaces}
            routePolyline={routePolyline}
            processedPoints={processedPoints}
          />
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

