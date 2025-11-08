import { useState, useEffect, useRef } from 'react'
import './UnsafeReportPage.css'
import HamburgerMenu from './components/HamburgerMenu'
import { apiPost } from './utils/api'
import { useFlutterBridge } from './hooks/useFlutterBridge'

interface UnsafeReportPageProps {
  onBack: () => void
  onNavigateToDangerMap?: () => void
  onNavigateToReportList?: () => void
  onNavigateToSettings?: () => void
}

// API 基礎 URL（已移至 utils/api.ts，保留此處以備兼容）
// const API_BASE = 'https://ws10.csie.ntu.edu.tw:54443'

// 生成 UUID（簡單版本，實際使用時可能從 Flutter 獲取）
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 格式化時間為後端要求的格式：2025-11-08T15:30:00:000000
function formatTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}:000000`
}

function UnsafeReportPage({ onBack, onNavigateToDangerMap, onNavigateToReportList, onNavigateToSettings }: UnsafeReportPageProps) {
  const [reason, setReason] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef<HTMLButtonElement>(null)
  const { lastReply, sendMessage, isAvailable } = useFlutterBridge()

  const options = [
    { value: 'lighting', label: '照明不足' },
    { value: 'surveillance', label: '監視器不足' },
    { value: 'isolation', label: '人煙稀少' },
    { value: 'obstruction', label: '視線受阻' },
  ]

  const selectedOption = options.find(opt => opt.value === reason)

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        selectRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // 獲取用戶 UUID（在組件加載時預先獲取）
  useEffect(() => {
    // 如果 Flutter bridge 可用且 localStorage 沒有 userId，請求用戶信息
    if (isAvailable && !localStorage.getItem('userId')) {
      console.log('[UnsafeReportPage] 預先請求用戶信息...')
      sendMessage('userinfo', null)
    }
  }, [isAvailable, sendMessage])

  // 處理從 Flutter 接收到的用戶信息
  useEffect(() => {
    if (lastReply?.name === 'userinfo' && typeof lastReply.data === 'object' && lastReply.data !== null) {
      const data = lastReply.data as Record<string, unknown>
      const id = String(data.id ?? '')
      if (id) {
        localStorage.setItem('userId', id)
        console.log('[UnsafeReportPage] 預先獲取並保存用戶 UUID:', id)
      }
    }
  }, [lastReply])

  // 獲取用戶位置（優先從 Flutter 獲取，否則使用瀏覽器 geolocation）
  useEffect(() => {
    // 如果 Flutter bridge 可用，先請求位置
    if (isAvailable) {
      console.log('[UnsafeReportPage] 請求 Flutter 位置...')
      sendMessage('location', null)
    }
  }, [isAvailable, sendMessage])

  // 處理從 Flutter 接收到的位置信息
  useEffect(() => {
    if (lastReply?.name === 'location' && typeof lastReply.data === 'object' && lastReply.data !== null) {
      const data = lastReply.data as Record<string, unknown>
      const lat = typeof data.latitude === 'number' ? data.latitude : null
      const lng = typeof data.longitude === 'number' ? data.longitude : null
      
      if (lat !== null && lng !== null) {
        console.log('[UnsafeReportPage] 從 Flutter 獲取到位置:', { lat, lng })
        setUserLocation({ lat, lng })
        return
      }
    }
  }, [lastReply])

  // 如果 Flutter 不可用或未返回位置，使用瀏覽器 geolocation
  useEffect(() => {
    // 如果已經有位置（從 Flutter 獲取），跳過
    if (userLocation) {
      return
    }

    // 如果 Flutter bridge 可用，等待 Flutter 返回位置
    if (isAvailable) {
      // 設置超時，如果 3 秒內沒有收到 Flutter 的位置，則使用瀏覽器定位
      const timeout = setTimeout(() => {
        if (!userLocation) {
          console.log('[UnsafeReportPage] Flutter 未返回位置，使用瀏覽器定位')
          getBrowserLocation()
        }
      }, 3000)
      
      return () => clearTimeout(timeout)
    } else {
      // Flutter 不可用，直接使用瀏覽器定位
      getBrowserLocation()
    }
  }, [isAvailable, userLocation])

  const getBrowserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          console.log('[UnsafeReportPage] 從瀏覽器獲取到位置:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.warn('[UnsafeReportPage] 無法獲取用戶位置:', error)
          // 如果無法獲取位置，使用預設位置（台北市政府）
          setUserLocation({
            lat: 25.0375,
            lng: 121.5645,
          })
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    } else {
      // 瀏覽器不支持定位，使用預設位置
      console.warn('[UnsafeReportPage] 瀏覽器不支持定位')
      setUserLocation({
        lat: 25.0375,
        lng: 121.5645,
      })
    }
  }

      const handleSubmit = async () => {
        if (!userLocation) {
          alert('無法獲取您的位置，請稍後再試')
          return
        }

        if (!reason) {
          alert('請選擇不安全原因')
          return
        }

        setSubmitting(true)
        try {
          // 獲取用戶 UUID（從 localStorage 或 Flutter）
          let uuid: string | null = null
          
          // 先嘗試從 localStorage 獲取
          const storedUserId = localStorage.getItem('userId')
          if (storedUserId) {
            uuid = storedUserId
            console.log('[UnsafeReportPage] 從 localStorage 獲取 UUID:', uuid)
          } else if (isAvailable) {
            // 如果 Flutter bridge 可用，嘗試從 lastReply 獲取
            if (lastReply?.name === 'userinfo' && typeof lastReply.data === 'object' && lastReply.data !== null) {
              const data = lastReply.data as Record<string, unknown>
              const id = String(data.id ?? '')
              if (id) {
                uuid = id
                localStorage.setItem('userId', id)
                console.log('[UnsafeReportPage] 從 Flutter 獲取 UUID:', uuid)
              }
            }
          }
          
          // 如果還是沒有 UUID，使用隨機生成的（fallback）
          // 注意：這會導致回報無法關聯到真實用戶，但允許提交
          if (!uuid) {
            console.warn('[UnsafeReportPage] 無法獲取用戶 UUID，使用隨機生成')
            uuid = generateUUID()
          }
          
          const time = formatTime(new Date())

          // 映射不安全原因到 type
          const typeMap: Record<string, string> = {
            lighting: 'light',
            surveillance: 'monitor',
            isolation: 'few',
            obstruction: 'dangerous',
          }
          const type = typeMap[reason] || 'light'

          console.log('[UnsafeReportPage] 提交不安全回報:', {
            uuid,
            time,
            lat: userLocation.lat,
            lon: userLocation.lng,
            type,
          })

          const response = await apiPost('/api/points', {
            uuid,
            time,
            lat: userLocation.lat,
            lon: userLocation.lng,
            type,
          })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 回應錯誤: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      console.log('[UnsafeReportPage] 提交成功:', result)

      // 顯示成功訊息
      alert('不安全回報已成功送出')
      
      // 重置表單
      setReason('')
      
      // 返回上一頁
      onBack()
    } catch (error) {
      console.error('[UnsafeReportPage] 提交失敗:', error)
      alert('提交失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="unsafe-report-page">
      <header className="unsafe-report-page__header">
        <button
          type="button"
          className="unsafe-report-page__nav-btn"
          aria-label="返回"
          onClick={onBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="unsafe-report-page__headline">不安全回報</span>
        <HamburgerMenu 
          onShowDangerMap={onNavigateToDangerMap}
          onShowReportList={onNavigateToReportList}
          onShowSettings={onNavigateToSettings}
        />
      </header>

      <main className="unsafe-report-page__content" aria-label="不安全回報表單">
        <div className="unsafe-report-page__form">
          <div className="unsafe-report-page__field">
            <label htmlFor="reason" className="unsafe-report-page__label">
              不安全原因<span className="unsafe-report-page__required">*</span>
            </label>
            <div className="unsafe-report-page__select-wrapper">
              <button
                ref={selectRef}
                type="button"
                id="reason"
                className="unsafe-report-page__select"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-expanded={showDropdown}
                aria-haspopup="listbox"
              >
                <span className="unsafe-report-page__select-text">
                  {selectedOption ? selectedOption.label : '請選擇不安全原因'}
                </span>
                <svg
                  className={`unsafe-report-page__select-icon ${showDropdown ? 'unsafe-report-page__select-icon--open' : ''}`}
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 9L12 15L6 9"
                    stroke="#475259"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {showDropdown && (
                <div ref={dropdownRef} className="unsafe-report-page__dropdown">
                  {options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`unsafe-report-page__dropdown-item ${reason === option.value ? 'unsafe-report-page__dropdown-item--selected' : ''}`}
                      onClick={() => {
                        setReason(option.value)
                        setShowDropdown(false)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="unsafe-report-page__info">
            <p>您的回報將協助我們改善該區域的安全性，感謝您的協助。</p>
          </div>
        </div>
      </main>

      <div className="unsafe-report-page__actions">
        <button
          type="button"
          className="unsafe-report-page__submit-btn"
          onClick={handleSubmit}
          disabled={!reason || submitting || !userLocation}
        >
          {submitting ? '送出中...' : '送出'}
        </button>
      </div>

      <footer className="unsafe-report-page__footer">本服務僅供非緊急事件使用，緊急狀態請撥打119</footer>
    </div>
  )
}

export default UnsafeReportPage

