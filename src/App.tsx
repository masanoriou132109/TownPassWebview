import { useState, useRef, useEffect } from 'react'
import './App.css'
import DangerPage from './DangerPage'
import UnsafeReportPage from './UnsafeReportPage'
import DangerMapPage from './DangerMapPage'
import ReportListPage from './ReportListPage'
import SettingsPage from './SettingsPage'
import HomeMap from './components/HomeMap'
import HamburgerMenu from './components/HamburgerMenu'
import type { HomeMapHandle } from './components/HomeMap'
import { login, hasToken } from './utils/auth'
import { useFlutterBridge } from './hooks/useFlutterBridge'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'danger' | 'unsafe-report' | 'danger-map' | 'report-list' | 'settings'>('home')
  const [showDangerMap, setShowDangerMap] = useState(false)
  const homeMapRef = useRef<HomeMapHandle>(null)
  const [canQuery, setCanQuery] = useState(false)
  const [queryingDanger, setQueryingDanger] = useState(false)
  const { lastReply, sendMessage, isAvailable } = useFlutterBridge()

  // 处理从 Flutter 接收到的用户信息，并自动登录获取 JWT token
  useEffect(() => {
    if (!lastReply) {
      return
    }

    // 处理使用者資訊回覆（参考 Test/frontend 的实现）
    if (lastReply.name === 'userinfo' && typeof lastReply.data === 'object' && lastReply.data !== null) {
      const data = lastReply.data as Record<string, unknown>
      const id = String(data.id ?? '')
      const idNo = String(data.idNo ?? '')
      
      if (id && idNo) {
        console.log('[App] 收到使用者資訊，ID:', id)
        
        // 保存用户 ID 到 localStorage
        try {
          localStorage.setItem('userId', id)
          console.log('[App] 用户 ID 已保存到 localStorage')
        } catch (err) {
          console.warn('[App] 保存用户 ID 失败:', err)
        }
        
        // 如果已有 token，跳过登录
        if (hasToken()) {
          console.log('[App] 已存在 token，跳过自动登录')
          return
        }

        // 使用接收到的 id 和 idNo 登录获取 JWT token
        console.log('[App] 开始自动登录获取 JWT token...')
        login(id, idNo).then((success) => {
          if (success) {
            console.log('[App] ✅ 自动登录成功，token 已保存')
          } else {
            console.warn('[App] ⚠️ 自动登录失败，部分功能可能无法使用')
          }
        })
      }
    }
  }, [lastReply])

  // 应用初始化时，如果 Flutter bridge 可用，自动请求用户信息
  useEffect(() => {
    if (!isAvailable) {
      return
    }

    // 如果已有 token，跳过
    if (hasToken()) {
      console.log('[App] 已存在 token，跳过请求用户信息')
      return
    }

    // 发送 userinfo 请求（参考 Test/frontend 的实现）
    console.log('[App] 请求使用者資訊...')
    sendMessage('userinfo', null)
  }, [isAvailable, sendMessage])
  
  // 定期檢查是否可以查詢（因為 useImperativeHandle 可能不會觸發重新渲染）
  useEffect(() => {
    if (!showDangerMap) {
      setCanQuery(false)
      return
    }
    
    const checkInterval = setInterval(() => {
      if (homeMapRef.current) {
        const can = homeMapRef.current.canQuery()
        setCanQuery(can)
      }
    }, 500)

    return () => clearInterval(checkInterval)
  }, [showDangerMap])

  // 當地圖顯示且可以查詢時，自動查詢危險區域
  useEffect(() => {
    if (!showDangerMap || !canQuery || queryingDanger) {
      return
    }

    // 等待一小段時間確保地圖完全渲染
    const timer = setTimeout(async () => {
      if (homeMapRef.current && homeMapRef.current.canQuery()) {
        console.log('[App] 自動查詢危險區域...')
        setQueryingDanger(true)
        try {
          await homeMapRef.current.queryDangerZones()
          console.log('[App] ✅ 危險區域查詢完成')
        } catch (error) {
          console.error('[App] ❌ 查詢危險區域失敗:', error)
        } finally {
          setQueryingDanger(false)
        }
      }
    }, 1000) // 等待 1 秒確保地圖完全加載

    return () => clearTimeout(timer)
  }, [showDangerMap, canQuery])

  const handleNavigateToDanger = () => {
    setCurrentPage('danger')
  }

  const handleNavigateToUnsafeReport = () => {
    setCurrentPage('unsafe-report')
  }

  const handleBack = () => {
    setCurrentPage('home')
  }

  const handleShowDangerMap = () => {
    console.log('[App] 顯示危險地圖')
    setShowDangerMap(true)
    // 注意：實際查詢會在 useEffect 中自動觸發，當 canQuery 變為 true 時
  }

  const handleHideDangerMap = () => {
    setShowDangerMap(false)
  }

  const handleMenuShowDangerMap = () => {
    setCurrentPage('danger-map')
  }

  const handleNavigateToReportList = () => {
    setCurrentPage('report-list')
  }

  const handleNavigateToSettings = () => {
    setCurrentPage('settings')
  }

  // 查詢此處危險狀態功能（已移除按鈕，但保留代碼以便將來使用）
  // const handleQueryDangerZones = async () => {
  //   if (!homeMapRef.current) return
  //   if (!homeMapRef.current.canQuery()) {
  //     alert('地圖尚未載入完成，請稍候再試')
  //     return
  //   }
  //   setQueryingDanger(true)
  //   try {
  //     await homeMapRef.current.queryDangerZones()
  //   } finally {
  //     setQueryingDanger(false)
  //   }
  // }

  return (
    <div className="app-container">
      <div
        className={`app app--home ${currentPage !== 'home' ? 'app--slide-out' : ''}`}
      >
        <header className="app__header">
          <button type="button" className="app__nav-btn" aria-label="返回">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="app__headline">危險通報</span>
          <HamburgerMenu 
            onShowDangerMap={handleMenuShowDangerMap}
            onShowReportList={handleNavigateToReportList}
            onShowSettings={handleNavigateToSettings}
          />
        </header>

        <main className="app__content" aria-label="危險通報操作">
          {showDangerMap && (
            <>
              <div className="app__map-container">
                <HomeMap 
                  ref={homeMapRef}
                  onDangerZonesData={(data) => {
                    console.log('[App] 收到危險區域數據:', data)
                    // 數據已經由 HomeMap 自動繪製在地圖上
                  }}
                  onClusterClick={(cluster) => {
                    console.log('[App] 點擊群集:', cluster)
                    // 首頁不需要顯示詳細資訊，只記錄日誌
                  }}
                />
              </div>

              {/* 查詢此處危險狀態按鈕（已移除，代碼保留在下方註釋中） */}
              {/* 
              <div className="app__query-danger-btn-container">
                <button
                  type="button"
                  className="app__query-danger-btn"
                  onClick={handleQueryDangerZones}
                  disabled={queryingDanger || !canQuery}
                >
                  {queryingDanger ? '查詢中...' : '查詢此處危險狀態'}
                </button>
              </div>
              */}

              <div className="app__hide-map-btn-container">
                <button
                  type="button"
                  className="app__hide-map-btn"
                  onClick={handleHideDangerMap}
                >
                  隱藏危險地圖
                </button>
              </div>
            </>
          )}

          {!showDangerMap && (
            <div className="app__show-map-btn-container">
              <button
                type="button"
                className="app__show-map-btn"
                onClick={handleShowDangerMap}
              >
                快速查看危險地圖
              </button>
            </div>
          )}

          <div className="app__buttons">
            <button
              type="button"
              className="app__action-btn"
              onClick={handleNavigateToUnsafeReport}
            >
              <svg
                className="app__action-icon"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM12 7C12.5523 7 13 7.44772 13 8V11C13 11.5523 12.5523 12 12 12C11.4477 12 11 11.5523 11 11V8C11 7.44772 11.4477 7 12 7ZM13 14C13 13.4477 12.5523 13 12 13C11.4477 13 11 13.4477 11 14V15C11 15.5523 11.4477 16 12 16C12.5523 16 13 15.5523 13 15V14Z"
                  fill="#F5BA4B"
                />
              </svg>
              <span>不安全回報</span>
            </button>
            <button
              type="button"
              className="app__action-btn"
              onClick={handleNavigateToDanger}
            >
              <svg
                className="app__action-icon"
                width="48"
                height="48"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_3_2431)">
                  <path
                    d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16Z"
                    fill="#F5BA4B"
                  />
                  <path
                    d="M3.50806 6.46903L7.99906 3.50903L12.4871 6.46903"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11.6711 8.03003V12.488H4.32715V8.03003"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.80602 5.7832C8.96563 5.7832 9.12166 5.83053 9.25437 5.91921C9.38708 6.00788 9.49051 6.13392 9.55159 6.28138C9.61267 6.42884 9.62866 6.5911 9.59752 6.74764C9.56638 6.90418 9.48952 7.04798 9.37666 7.16084C9.2638 7.2737 9.12 7.35056 8.96346 7.3817C8.80692 7.41284 8.64466 7.39685 8.4972 7.33577C8.34974 7.27469 8.2237 7.17126 8.13503 7.03855C8.04635 6.90584 7.99902 6.74981 7.99902 6.5902C7.99902 6.37617 8.08405 6.17091 8.23539 6.01957C8.38673 5.86823 8.59199 5.7832 8.80602 5.7832Z"
                    fill="white"
                  />
                  <mask
                    id="mask0_3_2431"
                    style={{ maskType: 'luminance' }}
                    maskUnits="userSpaceOnUse"
                    x="5"
                    y="7"
                    width="6"
                    height="5"
                  >
                    <path d="M5.41003 7.39722H10.589V11.7202H5.41003V7.39722Z" fill="white" />
                  </mask>
                  <g mask="url(#mask0_3_2431)">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10.002 7.53718C9.93625 7.64599 9.8483 7.73973 9.7439 7.81227C9.63949 7.88482 9.52096 7.93456 9.39605 7.95824C9.27113 7.98192 9.14263 7.97902 9.01891 7.94971C8.8952 7.92041 8.77904 7.86537 8.67802 7.78818C8.64402 7.76618 8.48802 7.68218 8.45402 7.66018C8.28304 7.54339 8.09005 7.46269 7.88683 7.423C7.68361 7.38332 7.47443 7.3855 7.27208 7.42939C7.06973 7.47329 6.87846 7.55798 6.70995 7.6783C6.54144 7.79863 6.39923 7.95204 6.29202 8.12918C6.06302 8.45318 6.59202 8.76018 6.82302 8.44218C6.9228 8.26841 7.08006 8.13489 7.26771 8.06461C7.45535 7.99433 7.66164 7.99171 7.85102 8.05718C7.65102 8.40318 7.47702 8.75018 7.23102 9.24118C7.18659 9.36812 7.11648 9.48454 7.02507 9.58319C6.93366 9.68184 6.8229 9.76059 6.6997 9.81454C6.57651 9.86849 6.44352 9.89648 6.30903 9.89676C6.17454 9.89705 6.04144 9.86962 5.91802 9.81618C5.88247 9.79063 5.84208 9.7726 5.79933 9.76318C5.75658 9.75377 5.71235 9.75317 5.66936 9.76142C5.62637 9.76968 5.58551 9.78661 5.54928 9.81119C5.51306 9.83578 5.48223 9.86748 5.45867 9.90438C5.43511 9.94128 5.41933 9.9826 5.41228 10.0258C5.40523 10.069 5.40707 10.1132 5.41768 10.1557C5.42829 10.1982 5.44745 10.238 5.47398 10.2728C5.50052 10.3077 5.53388 10.3367 5.57202 10.3582C5.89399 10.5417 6.27105 10.6037 6.63485 10.5331C6.99864 10.4624 7.32509 10.2638 7.55502 9.97318C7.56803 9.98445 7.58341 9.99265 7.60002 9.99718C7.94055 10.1396 8.26014 10.3277 8.55002 10.5562C8.75844 10.8678 8.93246 11.2011 9.06902 11.5502C9.10555 11.6203 9.16763 11.6737 9.24243 11.6993C9.31722 11.7249 9.39899 11.7207 9.47082 11.6877C9.54264 11.6547 9.59902 11.5953 9.62828 11.5219C9.65755 11.4484 9.65745 11.3666 9.62802 11.2932C9.47003 10.8756 9.2539 10.4824 8.98602 10.1252C8.74473 9.9249 8.48489 9.7481 8.21002 9.59718C8.39402 9.22918 8.59502 8.87118 8.80202 8.51318C9.12303 8.61109 9.46755 8.59903 9.78093 8.47893C10.0943 8.35883 10.3587 8.13755 10.532 7.85018C10.761 7.52618 10.233 7.21918 10.002 7.53718Z"
                      fill="white"
                    />
                  </g>
                </g>
                <defs>
                  <clipPath id="clip0_3_2431">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span>我有危險</span>
            </button>
          </div>
        </main>

        <footer className="app__footer">本服務僅供非緊急事件使用，緊急狀態請撥打119</footer>
      </div>

      <div
        className={`danger-page-wrapper ${currentPage === 'danger' ? 'danger-page-wrapper--active' : ''}`}
      >
        <DangerPage 
          onBack={handleBack} 
          onNavigateToDangerMap={handleMenuShowDangerMap}
          onNavigateToReportList={handleNavigateToReportList}
          onNavigateToSettings={handleNavigateToSettings}
        />
      </div>

      <div
        className={`unsafe-report-page-wrapper ${currentPage === 'unsafe-report' ? 'unsafe-report-page-wrapper--active' : ''}`}
      >
        <UnsafeReportPage 
          onBack={handleBack} 
          onNavigateToDangerMap={handleMenuShowDangerMap}
          onNavigateToReportList={handleNavigateToReportList}
          onNavigateToSettings={handleNavigateToSettings}
        />
      </div>

      <div
        className={`danger-map-page-wrapper ${currentPage === 'danger-map' ? 'danger-map-page-wrapper--active' : ''}`}
      >
        <DangerMapPage 
          onBack={handleBack}
          onNavigateToDangerMap={handleMenuShowDangerMap}
          onNavigateToReportList={handleNavigateToReportList}
          onNavigateToSettings={handleNavigateToSettings}
        />
      </div>

      <div
        className={`report-list-page-wrapper ${currentPage === 'report-list' ? 'report-list-page-wrapper--active' : ''}`}
      >
        <ReportListPage 
          onBack={handleBack} 
          onNavigateToDangerMap={handleMenuShowDangerMap}
          onNavigateToSettings={handleNavigateToSettings}
        />
      </div>

      <div
        className={`settings-page-wrapper ${currentPage === 'settings' ? 'settings-page-wrapper--active' : ''}`}
      >
        <SettingsPage 
          onBack={handleBack} 
          onNavigateToDangerMap={handleMenuShowDangerMap}
          onNavigateToReportList={handleNavigateToReportList}
        />
      </div>
    </div>
  )
}

export default App
