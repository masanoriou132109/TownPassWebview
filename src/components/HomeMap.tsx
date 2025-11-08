import { useEffect, useRef, useState } from 'react'

// Google Maps API Key (首頁專用)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDu0788Su8S96hJ_MDkgfqYt_6Kbpa92wI'

// 使用 window 對象存儲首頁地圖的初始化標誌
declare global {
  interface Window {
    __homeMapScriptLoaded?: boolean
    google?: typeof google
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

export default function HomeMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const userMarkerRef = useRef<google.maps.Marker | null>(null)

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
        // 確保容器尺寸為 378x400（不包括 padding）
        const computedStyle = window.getComputedStyle(container)
        const padding = parseFloat(computedStyle.padding) || 16
        container.style.width = '378px'
        container.style.height = '400px'
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
              mapRef.current.style.minHeight = '400px'
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
}

