import { useState, useEffect } from 'react'
import './ReportListPage.css'
import HamburgerMenu from './components/HamburgerMenu'
import { apiGet } from './utils/api'
import { useFlutterBridge } from './hooks/useFlutterBridge'

interface ReportListPageProps {
  onBack: () => void
  onNavigateToDangerMap?: () => void
  onNavigateToSettings?: () => void
}

/**
 * 点数据接口
 */
interface Point {
  id: number
  uuuid: string
  lat: number
  lng: number
  alpha: number
  type: 'light' | 'few' | 'monitor' | 'dangerous'
  time: string
}

/**
 * API 响应接口
 */
interface PointsResponse {
  success: boolean
  data: {
    count: number
    total_alpha: number
    data: Point[]
  }
  message?: string
}

function ReportListPage({ onBack, onNavigateToDangerMap, onNavigateToSettings }: ReportListPageProps) {
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { lastReply, sendMessage, isAvailable } = useFlutterBridge()

  // 类型映射
  const typeLabels: Record<string, string> = {
    light: '照明不足',
    few: '人煙稀少',
    monitor: '監視器不足',
    dangerous: '危險',
  }

  // 获取用户 UUID（从 Flutter 或 localStorage）
  const getUserUUID = (): string | null => {
    // 先尝试从 localStorage 获取
    const storedUserId = localStorage.getItem('userId')
    if (storedUserId) {
      return storedUserId
    }
    
    // 如果 Flutter bridge 可用，尝试从 lastReply 获取
    if (lastReply?.name === 'userinfo' && typeof lastReply.data === 'object' && lastReply.data !== null) {
      const data = lastReply.data as Record<string, unknown>
      const id = String(data.id ?? '')
      if (id) {
        localStorage.setItem('userId', id)
        return id
      }
    }
    
    return null
  }

  // 获取点列表
  useEffect(() => {
    const fetchPoints = async () => {
      setLoading(true)
      setError(null)

      try {
        // 获取用户 UUID
        const uuid = getUserUUID()
        
        if (!uuid) {
          // 如果 Flutter bridge 可用，请求用户信息
          if (isAvailable) {
            console.log('[ReportListPage] 请求用户信息...')
            sendMessage('userinfo', null)
            // 等待用户信息返回后再重试
            return
          } else {
            throw new Error('无法获取用户 UUID')
          }
        }

        console.log('[ReportListPage] 获取点列表，UUID:', uuid)
        const response = await apiGet(`/api/points/${uuid}`)

        if (!response.ok) {
          throw new Error(`获取点列表失败: ${response.statusText}`)
        }

        const data: PointsResponse = await response.json()

        if (data.success && data.data && Array.isArray(data.data.data)) {
          // 按照 id 排序（降序，最新的在前）
          const sortedPoints = [...data.data.data].sort((a, b) => b.id - a.id)
          setPoints(sortedPoints)
        } else {
          console.warn('[ReportListPage] 响应格式不符合预期:', data)
          setPoints([])
        }
      } catch (err) {
        console.error('[ReportListPage] 获取点列表失败:', err)
        setError(err instanceof Error ? err.message : '获取点列表失败')
        setPoints([])
      } finally {
        setLoading(false)
      }
    }

    fetchPoints()
  }, [isAvailable, sendMessage, lastReply])

  // 格式化时间显示
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}/${month}/${day} ${hours}:${minutes}`
    } catch {
      return dateString
    }
  }

  return (
    <div className="report-list-page">
      <header className="report-list-page__header">
        <button
          type="button"
          className="report-list-page__nav-btn"
          onClick={onBack}
          aria-label="返回"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="report-list-page__headline">我的回報列表</span>
        <HamburgerMenu 
          onShowDangerMap={onNavigateToDangerMap}
          onShowSettings={onNavigateToSettings}
        />
      </header>

      <main className="report-list-page__content">
        {loading && (
          <div className="report-list-page__loading">
            <div className="report-list-page__spinner" />
            <p>載入中...</p>
          </div>
        )}

        {error && !loading && (
          <div className="report-list-page__error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"
                fill="#d45251"
              />
            </svg>
            <p>{error}</p>
            <button
              type="button"
              className="report-list-page__retry-btn"
              onClick={() => window.location.reload()}
            >
              重新載入
            </button>
          </div>
        )}

        {!loading && !error && points.length === 0 && (
          <div className="report-list-page__empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 17C11.45 17 11 16.55 11 16C11 15.45 11.45 15 12 15C12.55 15 13 15.45 13 16C13 16.55 12.55 17 12 17ZM13 13H11V7H13V13Z"
                fill="#4d5459"
              />
            </svg>
            <p>尚未回報</p>
          </div>
        )}

        {!loading && !error && points.length > 0 && (
          <div className="report-list-page__list">
            {points.map((point) => (
              <div key={point.id} className="report-list-page__item">
                <div className="report-list-page__item-header">
                  <div className="report-list-page__item-type">
                    <span className="report-list-page__type-badge">{typeLabels[point.type] || point.type}</span>
                  </div>
                  <span className="report-list-page__item-date">{formatDate(point.time)}</span>
                </div>

                <div className="report-list-page__item-body">
                  <div className="report-list-page__item-location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"
                        fill="#4d5459"
                      />
                    </svg>
                    <span>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="report-list-page__footer">本服務僅供非緊急事件使用，緊急狀態請撥打119</footer>
    </div>
  )
}

export default ReportListPage

