import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'

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
    
    // 如果 window.google 已經存在，直接使用（避免重複加載）
    if (window.google && window.google.maps) {
      console.log('[HomeMap] window.google 已存在，直接使用')
      resolve()
      return
    }

    // 如果已經標記為加載中，等待加載完成
    if (window.__homeMapScriptLoaded === false) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
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
      // 等待現有腳本加載完成
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
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
      // 等待一小段時間確保 google 對象已初始化
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval)
          window.__homeMapScriptLoaded = true
          resolve()
        }
      }, 50)
      
      // 超時保護
      setTimeout(() => {
        clearInterval(checkInterval)
        if (window.google && window.google.maps) {
          window.__homeMapScriptLoaded = true
          resolve()
        } else {
          reject(new Error('Google Maps API loaded but google object not available'))
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

const HomeMap = forwardRef<HomeMapHandle>((_props, ref) => {
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

        console.log('[HomeMap] 開始創建地圖實例')
        console.log('[HomeMap] 容器尺寸:', mapRef.current.offsetWidth, 'x', mapRef.current.offsetHeight)

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
          const center = newMap.getCenter()
          if (center) {
            const centerCoords = {
              lat: center.lat(),
              lng: center.lng(),
            }
            setMapCenter(centerCoords)
            console.log('[HomeMap] 地圖中心點已更新:', centerCoords)
          }
        })

        // 監聽地圖縮放變化
        window.google.maps.event.addListener(newMap, 'zoom_changed', () => {
          const zoom = newMap.getZoom()
          if (zoom !== undefined) {
            setMapZoom(zoom)
            console.log('[HomeMap] 地圖縮放級別已更新:', zoom)
          }
          // 縮放變化時重新計算邊界距離
          calculateMapBounds(newMap)
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
   * 根據風險等級獲取顏色
   */
  const getRiskColor = (riskLevel: string): { fill: string; stroke: string } => {
    switch (riskLevel) {
      case 'critical':
        return { fill: '#d45251', stroke: '#b03d3c' } // 紅色 - 極高風險
      case 'high':
        return { fill: '#ff9343', stroke: '#e67e22' } // 橙色 - 高風險
      case 'medium':
        return { fill: '#F5BA4B', stroke: '#d4a03a' } // 黃色 - 中等風險
      case 'low':
        return { fill: '#5ab4c5', stroke: '#318ea0' } // 藍色 - 低風險
      default:
        return { fill: '#5ab4c5', stroke: '#318ea0' } // 預設藍色
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
      const colors = getRiskColor(cluster.risk_level)

      // 繪製群集中心點標記
      const marker = new window.google.maps.Marker({
        position: { lat: cluster.lat, lng: cluster.lng },
        map: mapInstance,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: colors.fill,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: `危險群集 #${cluster.cluster_id} (${cluster.risk_level})`,
      })

      // 添加資訊視窗
      const infoContent = `
        <div style="padding: 0.75rem; min-width: 220px;">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 16px; font-weight: 600; color: ${colors.fill};">危險群集 #${cluster.cluster_id}</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>風險等級:</strong> <span style="color: ${colors.fill};">${cluster.risk_level}</span>
          </p>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>點位數量:</strong> ${cluster.point_count}
          </p>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>Alpha 值:</strong> ${cluster.alpha.toFixed(2)}
          </p>
          <p style="margin: 4px 0; font-size: 12px; color: #475259;">
            位置: (${cluster.lat.toFixed(6)}, ${cluster.lng.toFixed(6)})
          </p>
        </div>
      `

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent)
          infoWindowRef.current.open(mapInstance, marker)
        }
      })

      dangerZoneMarkersRef.current.push(marker)

      // 根據 alpha 值繪製圓形範圍（alpha 越大，圓形越大）
      const radius = Math.max(100, Math.min(800, cluster.alpha * 150))
      const circle = new window.google.maps.Circle({
        center: { lat: cluster.lat, lng: cluster.lng },
        radius: radius,
        map: mapInstance,
        fillColor: colors.fill,
        fillOpacity: 0.2,
        strokeColor: colors.stroke,
        strokeOpacity: 0.6,
        strokeWeight: 2,
      })

      dangerZoneCirclesRef.current.push(circle)
    })

    // 繪製噪音點
    data.noise_points.forEach((noisePoint) => {
      const marker = new window.google.maps.Marker({
        position: { lat: noisePoint.lat, lng: noisePoint.lng },
        map: mapInstance,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#9ca3af', // 灰色 - 噪音點
          fillOpacity: 0.7,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        },
        title: `噪音點 #${noisePoint.id} (Alpha: ${noisePoint.alpha.toFixed(2)})`,
      })

      // 添加資訊視窗
      const infoContent = `
        <div style="padding: 0.75rem; min-width: 200px;">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 16px; font-weight: 600; color: #9ca3af;">噪音點 #${noisePoint.id}</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>Alpha 值:</strong> ${noisePoint.alpha.toFixed(2)}
          </p>
          <p style="margin: 4px 0; font-size: 12px; color: #475259;">
            位置: (${noisePoint.lat.toFixed(6)}, ${noisePoint.lng.toFixed(6)})
          </p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
            此點未形成群集，可能是偶發事件
          </p>
        </div>
      `

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent)
          infoWindowRef.current.open(mapInstance, marker)
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
      // 使用地圖中心點和邊界距離
      const lat = mapCenter.lat
      const lng = mapCenter.lng
      // 使用水平距離作為半徑（公尺）
      const radius = Math.round(mapBounds.distanceToEdge.horizontal)
      const eps = 500 // 固定值
      const minpoints = 3 // 固定值

      console.log('查詢危險區域參數:', { lat, lng, radius, eps, minpoints })

      const response = await fetch('https://ws10.csie.ntu.edu.tw:54443/api/danger-zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat,
          lng,
          radius,
          eps,
          minpoints,
        }),
      })

      if (!response.ok) {
        throw new Error(`API 回應錯誤: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('危險區域查詢結果:', result)

      if (result.success && result.data) {
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

