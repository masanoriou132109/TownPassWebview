import { useRef, useState, useEffect } from 'react'
import './DangerMapPage.css'
import HomeMap from './components/HomeMap'
import HamburgerMenu from './components/HamburgerMenu'
import type { HomeMapHandle, NoisePointInfo } from './components/HomeMap'

interface DangerMapPageProps {
  onBack: () => void
  onNavigateToDangerMap?: () => void
  onNavigateToReportList?: () => void
  onNavigateToSettings?: () => void
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

function DangerMapPage({ onBack, onNavigateToDangerMap, onNavigateToReportList, onNavigateToSettings }: DangerMapPageProps) {
  const homeMapRef = useRef<HomeMapHandle>(null)
  const [, setDangerZonesData] = useState<any>(null) // 保存後端返回的數據，備用
  const [loading, setLoading] = useState(false)
  const [canQuery, setCanQuery] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<ClusterInfo | null>(null)
  const [selectedNoisePoint, setSelectedNoisePoint] = useState<NoisePointInfo | null>(null)

  // 定期檢查是否可以查詢
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (homeMapRef.current) {
        const can = homeMapRef.current.canQuery()
        setCanQuery(can)
      }
    }, 500)

    return () => clearInterval(checkInterval)
  }, [])

  const handleQueryDangerZones = async () => {
    if (!homeMapRef.current) {
      alert('地圖尚未載入完成，請稍候再試')
      return
    }

    if (!homeMapRef.current.canQuery()) {
      alert('地圖尚未載入完成，請稍候再試')
      return
    }

    // 清除之前選中的群集和噪音點資訊
    setSelectedCluster(null)
    setSelectedNoisePoint(null)

    setLoading(true)
    try {
      await homeMapRef.current.queryDangerZones()
      // 數據會通過 HomeMap 的 callback 傳遞回來
    } catch (error) {
      console.error('查詢危險區域失敗:', error)
      alert('查詢危險區域失敗，請稍後再試')
    } finally {
      // 確保按鈕恢復原樣式
      setLoading(false)
    }
  }


  return (
    <div className="danger-map-page">
      <header className="danger-map-page__header">
        <button
          type="button"
          className="danger-map-page__nav-btn"
          aria-label="返回"
          onClick={onBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="danger-map-page__headline">危險地圖</span>
        <HamburgerMenu
          onShowDangerMap={onNavigateToDangerMap}
          onShowReportList={onNavigateToReportList}
          onShowSettings={onNavigateToSettings}
        />
      </header>

      <main className="danger-map-page__content">
        <div className="danger-map-page__map-container">
          <HomeMap
            ref={homeMapRef}
            onDangerZonesData={setDangerZonesData}
            onClusterClick={(cluster) => {
              setSelectedCluster(cluster)
              setSelectedNoisePoint(null) // 清除噪音點選擇
            }}
            onNoisePointClick={(noisePoint) => {
              setSelectedNoisePoint(noisePoint)
              setSelectedCluster(null) // 清除群集選擇
            }}
          />
          <button
            type="button"
            className="danger-map-page__query-btn"
            onClick={handleQueryDangerZones}
            disabled={loading || !canQuery}
          >
            {loading ? '查詢中...' : '查看此處安全狀態'}
          </button>
        </div>
      </main>

      <div className="danger-map-page__cluster-info">
        <div className="danger-map-page__cluster-info-header">
          <span className="danger-map-page__cluster-info-title">安全資訊</span>
        </div>
        <div className="danger-map-page__cluster-info-content">
          {selectedCluster ? (
            <div className="danger-map-page__cluster-details">
              <div className="danger-map-page__cluster-detail-row">
                <span className="danger-map-page__cluster-detail-label">點位數量:</span>
                <span className="danger-map-page__cluster-detail-value">{selectedCluster.point_count}</span>
              </div>
              {selectedCluster.type_counts && (
                <div className="danger-map-page__cluster-type-counts">
                  <div className="danger-map-page__cluster-detail-label" style={{ marginBottom: '0.5rem' }}>
                    類型統計:
                  </div>
                  <div className="danger-map-page__type-counts-grid">
                    {selectedCluster.type_counts.light !== undefined && (
                      <div className="danger-map-page__type-count-item">
                        <span className="danger-map-page__type-count-label">照明不足:</span>
                        <span className="danger-map-page__type-count-value">{selectedCluster.type_counts.light}</span>
                      </div>
                    )}
                    {selectedCluster.type_counts.few !== undefined && (
                      <div className="danger-map-page__type-count-item">
                        <span className="danger-map-page__type-count-label">人煙稀少:</span>
                        <span className="danger-map-page__type-count-value">{selectedCluster.type_counts.few}</span>
                      </div>
                    )}
                    {selectedCluster.type_counts.monitor !== undefined && (
                      <div className="danger-map-page__type-count-item">
                        <span className="danger-map-page__type-count-label">監視器不足:</span>
                        <span className="danger-map-page__type-count-value">{selectedCluster.type_counts.monitor}</span>
                      </div>
                    )}
                    {selectedCluster.type_counts.dangerous !== undefined && (
                      <div className="danger-map-page__type-count-item">
                        <span className="danger-map-page__type-count-label">危險:</span>
                        <span className="danger-map-page__type-count-value">{selectedCluster.type_counts.dangerous}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : selectedNoisePoint ? (
            <div className="danger-map-page__cluster-details">
              <div className="danger-map-page__cluster-detail-row">
                <span className="danger-map-page__cluster-detail-label">噪音點 ID:</span>
                <span className="danger-map-page__cluster-detail-value">{selectedNoisePoint.id}</span>
              </div>
              <div className="danger-map-page__cluster-detail-row">
                <span className="danger-map-page__cluster-detail-label">Alpha 值:</span>
                <span className="danger-map-page__cluster-detail-value">{selectedNoisePoint.alpha.toFixed(2)}</span>
              </div>
              <div className="danger-map-page__cluster-detail-row">
                <span className="danger-map-page__cluster-detail-label">位置:</span>
                <span className="danger-map-page__cluster-detail-value danger-map-page__cluster-detail-value--coords">
                  {selectedNoisePoint.lat.toFixed(6)}, {selectedNoisePoint.lng.toFixed(6)}
                </span>
              </div>
              <p className="danger-map-page__cluster-info-empty" style={{ marginTop: '0.5rem' }}>
                此點未形成群集，可能是偶發事件
              </p>
            </div>
          ) : (
            <div className="danger-map-page__cluster-info-empty">
              <p>點擊地圖上的標記</p>
            </div>
          )}
        </div>
      </div>

      <footer className="danger-map-page__footer">本服務僅供非緊急事件使用，緊急狀態請撥打119</footer>
    </div>
  )
}

export default DangerMapPage

