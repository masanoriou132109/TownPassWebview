import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAje_mReHSVbVzSNsuO_WZaqM7Lz4ugO70'

// 使用 window 對象存儲全局標誌，確保 setOptions 只調用一次
declare global {
  interface Window {
    __googleMapsInitialized?: boolean
  }
}

/**
 * 安全點位（從 route/search API 返回）
 */
interface SafePlace {
  id: number
  name: string
  lat: number
  lng: number
  type: string
  distance: number
  pointIndex: number
  radius: number
  address?: string
  phone?: string
  description?: string
}

/**
 * CCTV 點位（從 route/search API 返回）
 */
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

/**
 * 路線點位（用於繪製路線點位標記）
 */
interface RoutePoint {
  id: number
  lat: number
  lng: number
  time: string
  searchRadius?: number
}

/**
 * 處理過的點位（從 route/plan API 返回）
 */
interface ProcessedPoint {
  lat: number
  lng: number
  originalId: number
  type: string
  relocatedToCctv: boolean
  cctvId?: number
}

interface SafetyMapProps {
  userLat?: number
  userLng?: number
  safePlaces?: SafePlace[]
  cctvPlaces?: CctvPlace[]
  routePoints?: RoutePoint[]
  routePolyline?: string | null
  processedPoints?: ProcessedPoint[]
}

// 預設位置（台北市政府）
const DEFAULT_CENTER = { lat: 25.0375, lng: 121.5645 }

export default function SafetyMap({
  userLat: _userLat,
  userLng: _userLng,
  safePlaces = [],
  cctvPlaces = [],
  routePoints = [],
  routePolyline = null,
  processedPoints = [],
}: SafetyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER)
  const userMarkerRef = useRef<google.maps.Marker | null>(null) // 用戶位置標記
  const safePlaceMarkersRef = useRef<google.maps.Marker[]>([]) // 安全點位標記
  const cctvMarkersRef = useRef<google.maps.Marker[]>([]) // CCTV 標記
  const routeCirclesRef = useRef<google.maps.Circle[]>([]) // 路線點位圓形
  const processedPointsMarkersRef = useRef<google.maps.Marker[]>([]) // 處理過的點位標記
  const routePolylineRef = useRef<google.maps.Polyline | null>(null) // 路線折線
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)

  // 初始化地圖
  useEffect(() => {
    if (!mapRef.current) return

    // 設置 API 選項（只調用一次，使用 window 對象存儲標誌）
    if (!window.__googleMapsInitialized) {
      setOptions({
        key: GOOGLE_MAPS_API_KEY,
        v: 'weekly',
      })
      window.__googleMapsInitialized = true
    }

    // 載入必要的庫
    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('geometry'),
    ])
      .then(async () => {
        if (!mapRef.current || !window.google) return

               // 創建地圖
               const newMap = new window.google.maps.Map(mapRef.current, {
                 center: currentLocation,
                 zoom: 16,
                 zoomControl: true,
                 streetViewControl: false,
                 mapTypeControl: false,
                 fullscreenControl: true,
               })

        mapInstanceRef.current = newMap

        // 創建資訊視窗
        infoWindowRef.current = new window.google.maps.InfoWindow()

        // 地圖已創建，先顯示地圖
        setLoading(false)

        // 獲取用戶位置
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }
              setCurrentLocation(location)
              newMap.setCenter(location)
              // 添加用戶位置標記
              addUserMarker(location.lat, location.lng, newMap)
            },
            () => {
              // 如果無法獲取位置，使用預設位置
              addUserMarker(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, newMap)
            }
          )
        } else {
          // 使用預設位置
          addUserMarker(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, newMap)
        }
      })
      .catch((err: unknown) => {
        setError('載入 Google Maps 失敗')
        console.error('Failed to load Google Maps:', err)
        setLoading(false)
      })
  }, [])

  // 當地圖容器顯示後，觸發 resize 以確保地圖正確渲染
  useEffect(() => {
    if (mapInstanceRef.current && !loading) {
      // 使用 setTimeout 確保 DOM 已經更新
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          window.google?.maps.event.trigger(mapInstanceRef.current, 'resize')
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [loading])

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

  /**
   * 根據類型獲取標記顏色
   */
  const getMarkerColor = (type?: string): string => {
    switch (type) {
      case 'police':
        return '#318ea0' // 深藍色 - 警察局
      case 'fire':
        return '#d45251' // 紅色 - 消防局
      case 'shelter':
        return '#ff9343' // 橙色 - 避難所
      default:
        return '#5ab4c5' // 預設藍色
    }
  }

  /**
   * 獲取類型標籤
   */
  const getTypeLabel = (type?: string): string => {
    switch (type) {
      case 'police':
        return '警察局'
      case 'fire':
        return '消防局'
      case 'shelter':
        return '避難所'
      default:
        return '安全點位'
    }
  }

  /**
   * 清除所有安全點位標記
   */
  const clearSafePlaceMarkers = () => {
    safePlaceMarkersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    safePlaceMarkersRef.current = []
  }

  /**
   * 清除所有 CCTV 標記
   */
  const clearCctvMarkers = () => {
    cctvMarkersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    cctvMarkersRef.current = []
  }

  /**
   * 添加安全點位標記
   */
  const addSafePlaceMarkers = (places: SafePlace[], mapInstance: google.maps.Map | null) => {
    if (!mapInstance || !window.google) return

    clearSafePlaceMarkers()

    places.forEach((place) => {
      // 如果沒有座標，跳過
      if (place.lat === undefined || place.lng === undefined) {
        console.warn('安全點位缺少座標:', place)
        return
      }

      const marker = new window.google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: mapInstance,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: getMarkerColor(place.type),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: place.name,
      })

      // 添加資訊視窗
      const infoContent = `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${place.name}</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>類型:</strong> ${getTypeLabel(place.type)}
          </p>
          ${place.address ? `<p style="margin: 4px 0; font-size: 14px; color: #475259;"><strong>地址:</strong> ${place.address}</p>` : ''}
          ${place.phone ? `<p style="margin: 4px 0; font-size: 14px; color: #475259;"><strong>電話:</strong> ${place.phone}</p>` : ''}
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>距離:</strong> ${place.distance.toFixed(0)} 公尺
          </p>
        </div>
      `

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent)
          infoWindowRef.current.open(mapInstance, marker)
        }
      })

      safePlaceMarkersRef.current.push(marker)
    })
  }

  /**
   * 添加 CCTV 標記
   */
  const addCctvMarkers = (places: CctvPlace[], mapInstance: google.maps.Map | null) => {
    if (!mapInstance || !window.google) return

    clearCctvMarkers()

    places.forEach((place) => {
      // 如果沒有座標，跳過
      if (place.lat === undefined || place.lng === undefined) {
        console.warn('CCTV 點位缺少座標:', place)
        return
      }

      const marker = new window.google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: mapInstance,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#475259',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        },
        title: `CCTV - ${place.owner}`,
      })

      // 添加資訊視窗
      const infoContent = `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">監視器</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>管理單位:</strong> ${place.owner}
          </p>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>距離:</strong> ${place.distance.toFixed(0)} 公尺
          </p>
        </div>
      `

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent)
          infoWindowRef.current.open(mapInstance, marker)
        }
      })

      cctvMarkersRef.current.push(marker)
    })
  }

  /**
   * 清除所有路線點位圓形
   */
  const clearRouteMarkers = () => {
    routeCirclesRef.current.forEach((circle) => {
      circle.setMap(null)
    })
    routeCirclesRef.current = []
  }

  /**
   * 繪製路線點位圓形（以 searchRadius 為半徑）
   */
  const drawRouteMarkers = (points: RoutePoint[], mapInstance: google.maps.Map | null) => {
    if (!mapInstance || !window.google) return

    clearRouteMarkers()

    points.forEach((point) => {
      // 使用 searchRadius 作為半徑（單位：米），如果沒有則使用默認值
      const radius = point.searchRadius || 50

      const circle = new window.google.maps.Circle({
        center: { lat: point.lat, lng: point.lng },
        radius: radius, // 半徑（米）
        map: mapInstance,
        fillColor: '#9ca3af', // 灰色
        fillOpacity: 0.2,
        strokeColor: '#6b7280', // 深灰色邊框
        strokeOpacity: 0.4,
        strokeWeight: 1,
      })

      routeCirclesRef.current.push(circle)
    })
  }

  // 當安全點位或 CCTV 數據更新時，更新地圖標記
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    addSafePlaceMarkers(safePlaces, mapInstanceRef.current)
    addCctvMarkers(cctvPlaces, mapInstanceRef.current)
  }, [safePlaces, cctvPlaces])

  /**
   * 清除路線折線
   */
  const clearRoutePolyline = () => {
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }
  }

  /**
   * 繪製路線折線
   */
  const drawRoutePolyline = (polylineString: string, mapInstance: google.maps.Map | null) => {
    if (!mapInstance || !window.google) return

    clearRoutePolyline()

    try {
      // 解碼 polyline 字符串為座標點陣列
      const path = window.google.maps.geometry.encoding.decodePath(polylineString)

      // 創建折線
      const polyline = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#5ab4c5',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstance,
      })

      routePolylineRef.current = polyline

      // 調整地圖視圖以顯示整個路線
      const bounds = new window.google.maps.LatLngBounds()
      path.forEach((point) => {
        bounds.extend(point)
      })
      mapInstance.fitBounds(bounds)
    } catch (err) {
      console.error('繪製路線失敗:', err)
    }
  }

  // 當路線點位數據更新時，繪製路線點位標記
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    drawRouteMarkers(routePoints, mapInstanceRef.current)
  }, [routePoints])

  /**
   * 清除所有處理過的點位標記
   */
  const clearProcessedPointsMarkers = () => {
    processedPointsMarkersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    processedPointsMarkersRef.current = []
  }

  /**
   * 繪製處理過的點位標記
   */
  const drawProcessedPointsMarkers = (points: ProcessedPoint[], mapInstance: google.maps.Map | null) => {
    if (!mapInstance || !window.google) return

    clearProcessedPointsMarkers()

    points.forEach((point) => {
      // 根據是否重新定位到 CCTV 使用不同的顏色
      const isRelocated = point.relocatedToCctv
      const marker = new window.google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map: mapInstance,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: isRelocated ? '#ff9343' : '#318ea0', // 橙色表示重新定位到 CCTV，藍色表示一般處理過的點位
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: isRelocated
          ? `處理過的點位 (原始 ID: ${point.originalId}, 重新定位到 CCTV: ${point.cctvId})`
          : `處理過的點位 (原始 ID: ${point.originalId})`,
      })

      // 添加資訊視窗
      const infoContent = `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">處理過的點位</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>原始點位 ID:</strong> ${point.originalId}
          </p>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>位置:</strong> ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
          </p>
          <p style="margin: 4px 0; font-size: 14px; color: #475259;">
            <strong>重新定位到 CCTV:</strong> ${isRelocated ? '是' : '否'}
          </p>
          ${isRelocated && point.cctvId ? `<p style="margin: 4px 0; font-size: 14px; color: #475259;"><strong>CCTV ID:</strong> ${point.cctvId}</p>` : ''}
        </div>
      `

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent)
          infoWindowRef.current.open(mapInstance, marker)
        }
      })

      processedPointsMarkersRef.current.push(marker)
    })
  }

  // 當路線 polyline 數據更新時，繪製路線
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    if (routePolyline) {
      drawRoutePolyline(routePolyline, mapInstanceRef.current)
    } else {
      clearRoutePolyline()
    }
  }, [routePolyline])

  // 當處理過的點位數據更新時，繪製標記
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    drawProcessedPointsMarkers(processedPoints, mapInstanceRef.current)
  }, [processedPoints])

  return (
    <div className="safety-map">
      {loading && !mapInstanceRef.current && (
        <div className="safety-map__loading">
          <p>正在載入地圖...</p>
        </div>
      )}
      {error && (
        <div className="safety-map__error">
          <p>{error}</p>
        </div>
      )}
      <div ref={mapRef} className="safety-map__container" />
    </div>
  )
}

