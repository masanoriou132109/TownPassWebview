import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { apiPost } from '../utils/api'
import poisonedIcon from '../assets/svgs/poisoned-svgrepo-com.svg'
import devilIcon from '../assets/svgs/devil-svgrepo-com.svg'
import deadpanIcon from '../assets/svgs/deadpan-1-svgrepo-com.svg'

// Google Maps API Key (首頁專用)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDu0788Su8S96hJ_MDkgfqYt_6Kbpa92wI'

// 使用 window 對象存儲首頁地圖的初始化標誌
declare global {
  interface Window {
    __homeMapScriptLoaded?: boolean
  }
}

// 預設位置（台北市政府）
const DEFAULT_CENTER = { lat: 25.0375, lng: 121.5645 }

/**
 * 使用傳統的 script 標籤方式加載 Google Maps API（避免與 @googlemaps/js-api-loader 衝突）
 * 如果 window.google 已經存在（由 SafetyMap 或其他組件加載），直接使用它
 */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[HomeMap] loadGoogleMapsScript 開始，API Key:', apiKey.substring(0, 10) + '...')

    // 如果 window.google 已經存在，檢查 Map 構造函數是否可用
    if (window.google && window.google.maps && window.google.maps.Map) {
      console.log('[HomeMap] window.google 已存在，Map 構造函數可用，直接使用')
      resolve()
      return
    }

    // 如果已經標記為加載中，等待加載完成
    if (window.__homeMapScriptLoaded === false) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          clearInterval(checkInterval)
          window.__homeMapScriptLoaded = true
          resolve()
        }
      }, 100)
      return
    }

    // 標記為正在加載
    window.__homeMapScriptLoaded = false

    // 檢查是否已經有相同 API key 的腳本
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`)
    if (existingScript) {
      // 等待現有腳本加載完成，確保 Map 構造函數可用
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          clearInterval(checkInterval)
          window.__homeMapScriptLoaded = true
          resolve()
        }
      }, 100)
      return
    }

    // 創建 script 標籤（不使用 callback，直接檢查 window.google）
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true

    script.onload = () => {
      // 等待一小段時間確保 google 對象和 Map 構造函數已初始化
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          clearInterval(checkInterval)
          window.__homeMapScriptLoaded = true
          console.log('[HomeMap] Google Maps API 完全加載完成，Map 構造函數可用')
          resolve()
        }
      }, 50)

      // 超時保護
      setTimeout(() => {
        clearInterval(checkInterval)
        if (window.google && window.google.maps && window.google.maps.Map) {
          window.__homeMapScriptLoaded = true
          console.log('[HomeMap] Google Maps API 完全加載完成（超時檢查）')
          resolve()
        } else {
          console.error('[HomeMap] Google Maps API 加載超時，Map 構造函數不可用')
          reject(new Error('Google Maps API loaded but Map constructor not available'))
        }
      }, 5000)
    }

    script.onerror = () => {
      window.__homeMapScriptLoaded = undefined
      reject(new Error('Failed to load Google Maps script'))
    }

    document.head.appendChild(script)
  })
}

export interface HomeMapHandle {
  queryDangerZones: () => Promise<void>
  canQuery: () => boolean
  isQuerying: () => boolean
}

interface ClusterInfo {
  cluster_id: number
  point_count: number
  alpha: number
  lat: number
  lng: number
  risk_level: string
  type_counts?: {
    light?: number
    few?: number
    monitor?: number
    dangerous?: number
  }
}

export interface NoisePointInfo {
  id: number
  lat: number
  lng: number
  alpha: number
}

interface HomeMapProps {
  onDangerZonesData?: (data: any) => void
  onClusterClick?: (cluster: ClusterInfo) => void
  onNoisePointClick?: (noisePoint: NoisePointInfo) => void
}

const HomeMap = forwardRef<HomeMapHandle, HomeMapProps>((props, ref) => {
  const { onDangerZonesData, onClusterClick, onNoisePointClick } = props || {}
  const mapRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [, setMapZoom] = useState<number | null>(null)
  const [mapBounds, setMapBounds] = useState<{
    north: number
    south: number
    east: number
    west: number
    distanceToEdge: { horizontal: number; vertical: number } // 單位：公尺
  } | null>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const userMarkerRef = useRef<google.maps.Marker | null>(null)
  const dangerZoneMarkersRef = useRef<google.maps.Marker[]>([]) // 危險區域標記（群集）
  const noisePointMarkersRef = useRef<google.maps.Marker[]>([]) // 噪音點標記
  const dangerZoneCirclesRef = useRef<google.maps.Circle[]>([]) // 危險區域圓形
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [queryingDanger, setQueryingDanger] = useState(false)

  // 初始化地圖
  useEffect(() => {
    if (!mapRef.current) {
      console.log('[HomeMap] mapRef.current is null')
      return
    }

    console.log('[HomeMap] 開始初始化地圖，mapRef.current:', mapRef.current)

    // 確保容器尺寸正確（CSS 已設置，這裡只是確認）
    if (mapRef.current) {
      const container = mapRef.current.closest('.app__map-container') as HTMLElement
      if (container) {
        // 確保容器尺寸為 378x378 (正方形)
        container.style.width = '378px'
        container.style.height = '378px'
        container.style.margin = '0 auto'
        console.log('[HomeMap] 容器設置完成，尺寸:', container.offsetWidth, 'x', container.offsetHeight)
      }
      // 也設置地圖容器本身的尺寸
      mapRef.current.style.width = '100%'
      mapRef.current.style.height = '100%'
    }

    console.log('[HomeMap] 容器尺寸:', mapRef.current?.offsetWidth, 'x', mapRef.current?.offsetHeight)

    // 使用傳統的 script 標籤方式加載（避免與 @googlemaps/js-api-loader 衝突）
    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      .then(() => {
        console.log('[HomeMap] Google Maps script 加載完成')

        if (!mapRef.current) {
          console.error('[HomeMap] mapRef.current 在加載後變為 null')
          setError('無法初始化地圖：容器不存在')
          setLoading(false)
          return
        }

        if (!window.google || !window.google.maps) {
          console.error('[HomeMap] window.google 不存在')
          setError('無法初始化地圖：Google Maps API 未加載')
          setLoading(false)
          return
        }

        // 檢查 Map 構造函數是否可用
        if (!window.google.maps.Map) {
          console.error('[HomeMap] window.google.maps.Map 構造函數不可用')
          setError('無法初始化地圖：Map 構造函數未準備好')
          setLoading(false)
          return
        }

        console.log('[HomeMap] 開始創建地圖實例')
        console.log('[HomeMap] 容器尺寸:', mapRef.current.offsetWidth, 'x', mapRef.current.offsetHeight)
        console.log('[HomeMap] Map 構造函數類型:', typeof window.google.maps.Map)

        // 創建地圖
        const newMap = new window.google.maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: 16,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        })

        mapInstanceRef.current = newMap
        console.log('[HomeMap] 地圖實例創建成功:', newMap)

        // 等待地圖完全初始化後再進行後續操作
        // 使用 idle 事件確保地圖完全加載
        window.google.maps.event.addListenerOnce(newMap, 'idle', () => {
          console.log('[HomeMap] 地圖完全加載完成，開始初始化其他組件')

          try {
            // 創建資訊視窗
            infoWindowRef.current = new window.google.maps.InfoWindow()

            // 獲取初始中心點
            const initialCenter = newMap.getCenter()
            if (initialCenter) {
              setMapCenter({
                lat: initialCenter.lat(),
                lng: initialCenter.lng(),
              })
              console.log('[HomeMap] 初始地圖中心點:', {
                lat: initialCenter.lat(),
                lng: initialCenter.lng(),
              })
            }

            // 獲取初始縮放級別
            const initialZoom = newMap.getZoom()
            if (initialZoom !== undefined) {
              setMapZoom(initialZoom)
              console.log('[HomeMap] 初始地圖縮放級別:', initialZoom)
            }

            // 監聽地圖中心變化
            window.google.maps.event.addListener(newMap, 'center_changed', () => {
              try {
                const center = newMap.getCenter()
                if (center) {
                  const centerCoords = {
                    lat: center.lat(),
                    lng: center.lng(),
                  }
                  setMapCenter(centerCoords)
                  console.log('[HomeMap] 地圖中心點已更新:', centerCoords)
                }
              } catch (error) {
                console.warn('[HomeMap] 獲取地圖中心點時出錯:', error)
              }
            })

            // 監聽地圖縮放變化
            window.google.maps.event.addListener(newMap, 'zoom_changed', () => {
              try {
                const zoom = newMap.getZoom()
                if (zoom !== undefined) {
                  setMapZoom(zoom)
                  console.log('[HomeMap] 地圖縮放級別已更新:', zoom)
                }
                // 縮放變化時重新計算邊界距離
                calculateMapBounds(newMap)
              } catch (error) {
                console.warn('[HomeMap] 處理縮放變化時出錯:', error)
              }
            })
          } catch (error) {
            console.error('[HomeMap] 初始化地圖組件時出錯:', error)
          }
        })

        // 計算地圖邊界和中心點到邊界的距離
        const calculateMapBounds = (map: google.maps.Map) => {
          const bounds = map.getBounds()
          if (!bounds) return

          const center = map.getCenter()
          if (!center) return

          const ne = bounds.getNorthEast()
          const sw = bounds.getSouthWest()

          // 計算中心點到邊界的距離（使用 Haversine 公式）
          const calculateDistance = (
            lat1: number,
            lng1: number,
            lat2: number,
            lng2: number
          ): number => {
            const R = 6371000 // 地球半徑（公尺）
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

          const centerLat = center.lat()
          const centerLng = center.lng()

          // 計算水平距離（中心點到東邊界或西邊界，取較小值）
          const distanceToEast = calculateDistance(centerLat, centerLng, centerLat, ne.lng())
          const distanceToWest = calculateDistance(centerLat, centerLng, centerLat, sw.lng())
          const horizontalDistance = Math.min(distanceToEast, distanceToWest)

          // 計算垂直距離（中心點到北邊界或南邊界，取較小值）
          const distanceToNorth = calculateDistance(centerLat, centerLng, ne.lat(), centerLng)
          const distanceToSouth = calculateDistance(centerLat, centerLng, sw.lat(), centerLng)
          const verticalDistance = Math.min(distanceToNorth, distanceToSouth)

          const boundsData = {
            north: ne.lat(),
            south: sw.lat(),
            east: ne.lng(),
            west: sw.lng(),
            distanceToEdge: {
              horizontal: horizontalDistance,
              vertical: verticalDistance,
            },
          }

          setMapBounds(boundsData)
          console.log('[HomeMap] 地圖邊界和距離:', boundsData)
        }

        // 監聽地圖拖動和縮放變化，更新邊界距離
        window.google.maps.event.addListener(newMap, 'bounds_changed', () => {
          calculateMapBounds(newMap)
        })

        // 初始計算邊界（等待地圖完全渲染）
        setTimeout(() => {
          calculateMapBounds(newMap)
        }, 500)

        // 先顯示地圖，不等待定位
        setLoading(false)

        // 觸發 resize 以確保地圖正確渲染
        setTimeout(() => {
          if (mapInstanceRef.current && mapRef.current) {
            console.log('[HomeMap] 觸發 resize 事件')
            console.log('[HomeMap] 當前容器尺寸:', mapRef.current.offsetWidth, 'x', mapRef.current.offsetHeight)
            window.google?.maps.event.trigger(mapInstanceRef.current, 'resize')

            // 如果容器尺寸為 0，強制設置一個最小高度
            if (mapRef.current.offsetHeight === 0) {
              console.warn('[HomeMap] 容器高度為 0，嘗試設置最小高度')
              mapRef.current.style.minHeight = '378px'
              setTimeout(() => {
                if (mapInstanceRef.current) {
                  window.google?.maps.event.trigger(mapInstanceRef.current, 'resize')
                }
              }, 100)
            }
          }
        }, 100)

        // 先添加預設位置的標記，讓地圖立即顯示
        if (mapInstanceRef.current) {
          addUserMarker(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, mapInstanceRef.current)
        }

        // 在背景執行獲取用戶位置（不阻塞地圖顯示）
        if (navigator.geolocation) {
          // 使用 watchPosition 可以更快獲取位置，並在獲取到後更新
          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }
              console.log('[HomeMap] 獲取到用戶位置:', location)
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setCenter(location)
                // 更新用戶位置標記
                addUserMarker(location.lat, location.lng, mapInstanceRef.current)
              }
              // 獲取到位置後停止監聽
              navigator.geolocation.clearWatch(watchId)
            },
            (error) => {
              console.warn('[HomeMap] 無法獲取用戶位置:', error)
              // 如果無法獲取位置，保持使用預設位置
              // 預設位置標記已經在之前添加了
              navigator.geolocation.clearWatch(watchId)
            },
            {
              enableHighAccuracy: true, // 啟用高精度定位
              timeout: 10000, // 10秒超時
              maximumAge: 0, // 不使用緩存的位置
            }
          )
        } else {
          // 瀏覽器不支持定位，使用預設位置（已經添加了）
          console.warn('[HomeMap] 瀏覽器不支持定位')
        }
      })
      .catch((err: unknown) => {
        setError('載入 Google Maps 失敗')
        console.error('Failed to load Google Maps:', err)
        setLoading(false)
      })
  }, [])

  /**
   * 清除危險區域標記
   */
  const clearDangerZones = () => {
    dangerZoneMarkersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    dangerZoneMarkersRef.current = []
    noisePointMarkersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    noisePointMarkersRef.current = []
    dangerZoneCirclesRef.current.forEach((circle) => {
      circle.setMap(null)
    })
    dangerZoneCirclesRef.current = []
  }

  /**
   * 根據 alpha 值獲取風險等級和對應的 SVG 圖標
   * alpha < 0.5 -> poisoned-svgrepo-com.svg
   * alpha >= 0.5 -> devil-svgrepo-com.svg
   */
  const getRiskLevelAndIcon = (alpha: number): { level: string; iconUrl: string } => {
    if (alpha < 0.5) {
      return {
        level: 'low',
        iconUrl: poisonedIcon
      }
    } else {
      return {
        level: 'high',
        iconUrl: devilIcon
      }
    }
  }


  /**
   * 繪製危險區域
   */
  const drawDangerZones = (data: {
    clusters: Array<{
      cluster_id: number
      point_count: number
      alpha: number
      lat: number
      lng: number
      risk_level: string
      type_counts?: {
        light?: number
        few?: number
        monitor?: number
        dangerous?: number
      }
    }>
    noise_points: Array<{
      id: number
      lat: number
      lng: number
      alpha: number
    }>
    geojson: {
      type: string
      features: Array<{
        type: string
        geometry: {
          type: string
          coordinates: number[]
        }
        properties: {
          type: string
          cluster_id?: number
          id?: number
          alpha: number
          risk_level?: string
          point_count?: number
        }
      }>
    }
  }) => {
    if (!mapInstanceRef.current || !window.google) return

    clearDangerZones()

    const mapInstance = mapInstanceRef.current

    // 繪製群集
    data.clusters.forEach((cluster) => {
      const { iconUrl } = getRiskLevelAndIcon(cluster.alpha)

      // 繪製群集中心點標記（使用 SVG 圖標）
      const marker = new window.google.maps.Marker({
        position: { lat: cluster.lat, lng: cluster.lng },
        map: mapInstance,
        icon: {
          url: iconUrl,
          scaledSize: new window.google.maps.Size(29, 29), // 縮小40%：48 * 0.6 = 28.8 ≈ 29
          anchor: new window.google.maps.Point(14.5, 14.5), // 調整anchor點
        },
        title: `危險群集 #${cluster.cluster_id} (Alpha: ${cluster.alpha.toFixed(2)})`,
      })

      // 添加點擊事件，將資訊傳遞給父組件顯示在下方資訊欄
      marker.addListener('click', () => {
        if (onClusterClick) {
          onClusterClick(cluster)
        }
      })

      dangerZoneMarkersRef.current.push(marker)
    })

    // 繪製噪音點
    data.noise_points.forEach((noisePoint) => {
      const marker = new window.google.maps.Marker({
        position: { lat: noisePoint.lat, lng: noisePoint.lng },
        map: mapInstance,
        icon: {
          url: deadpanIcon,
          scaledSize: new window.google.maps.Size(29, 29), // 與群集標記相同大小
          anchor: new window.google.maps.Point(14.5, 14.5),
        },
        title: `噪音點 #${noisePoint.id} (Alpha: ${noisePoint.alpha.toFixed(2)})`,
      })

      // 添加點擊事件，將資訊傳遞給父組件顯示在下方資訊欄
      marker.addListener('click', () => {
        if (onNoisePointClick) {
          onNoisePointClick({
            id: noisePoint.id,
            lat: noisePoint.lat,
            lng: noisePoint.lng,
            alpha: noisePoint.alpha,
          })
        }
      })

      noisePointMarkersRef.current.push(marker)
    })
  }

  /**
   * 查詢危險區域
   */
  const handleQueryDangerZones = async () => {
    if (!mapCenter || !mapBounds) {
      console.warn('地圖數據不完整，無法查詢危險區域')
      alert('地圖尚未載入完成，請稍候再試')
      return
    }

    setQueryingDanger(true)
    try {
      // 使用地圖中心點和到左右邊框的距離
      const lat = mapCenter.lat
      const lng = mapCenter.lng
      // 使用水平距離作為半徑（公尺）- 這是到左右邊框的距離
      const radius = Math.round(mapBounds.distanceToEdge.horizontal)
      const eps = 30 // 固定值
      const minpoints = 3 // 固定值

      console.log('查詢危險區域參數:', { lat, lng, radius, eps, minpoints })
      console.log('中心點座標:', { lat, lng })
      console.log('到左右邊框的距離:', radius, '公尺')

      const response = await apiPost('/api/danger-zones', {
        lat,
        lng,
        radius,
        eps,
        minpoints,
      })

      console.log('API 回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`API 回應錯誤: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('危險區域查詢結果:', result)

      if (result.success && result.data) {
        // 保存後端返回的數據
        if (onDangerZonesData) {
          onDangerZonesData(result.data)
        }

        // 繪製危險區域
        drawDangerZones(result.data)

        // 顯示統計資訊
        const stats = result.data.statistics
        console.log('統計資訊:', {
          總點數: stats.total_points_in_range,
          群集數量: stats.clusters_found,
          噪音點數: stats.noise_points,
          總Alpha: stats.total_alpha_sum,
          群集Alpha: stats.clusters_alpha_sum,
          噪音Alpha: stats.noise_alpha_sum,
        })
      }
    } catch (error) {
      console.error('查詢危險區域失敗:', error)
      alert('查詢危險區域失敗，請稍後再試')
    } finally {
      setQueryingDanger(false)
    }
  }

  // 暴露方法給父組件
  useImperativeHandle(ref, () => ({
    queryDangerZones: handleQueryDangerZones,
    canQuery: () => !!(mapCenter && mapBounds),
    isQuerying: () => queryingDanger,
  }))

  /**
   * 添加用戶位置標記
   */
  const addUserMarker = (lat: number, lng: number, mapInstance: google.maps.Map | null) => {
    if (!mapInstance || !window.google) return

    // 清除舊的用戶位置標記
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
    }

    // 添加用戶位置標記
    const userMarker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstance,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#5ab4c5',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      title: '您的位置',
    })
    userMarkerRef.current = userMarker
  }

  return (
    <div className="home-map">
      {loading && (
        <div className="home-map__loading">
          <p>正在載入地圖...</p>
        </div>
      )}
      {error && (
        <div className="home-map__error">
          <p>{error}</p>
        </div>
      )}
      <div ref={mapRef} className="home-map__container" />
    </div>
  )
})

HomeMap.displayName = 'HomeMap'

export default HomeMap

