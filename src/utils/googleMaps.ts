import { setOptions } from '@googlemaps/js-api-loader'

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// 全局標誌，確保 setOptions 只調用一次
let mapsOptionsSet = false

/**
 * 初始化 Google Maps API
 * 這個函數應該在應用啟動時只調用一次
 */
export function initGoogleMaps() {
  if (!mapsOptionsSet) {
    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: 'weekly',
    })
    mapsOptionsSet = true
  }
}

