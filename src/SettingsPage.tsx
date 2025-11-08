import './SettingsPage.css'
import HamburgerMenu from './components/HamburgerMenu'

interface SettingsPageProps {
  onBack: () => void
  onNavigateToDangerMap?: () => void
  onNavigateToReportList?: () => void
}

function SettingsPage({ onBack, onNavigateToDangerMap, onNavigateToReportList }: SettingsPageProps) {
  const handleLocationPermission = () => {
    // 暂时不做任何功能，只是按钮
    console.log('[SettingsPage] 开启定位权限按钮被点击')
  }

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <button
          type="button"
          className="settings-page__nav-btn"
          onClick={onBack}
          aria-label="返回"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="settings-page__headline">使用設定</span>
        <HamburgerMenu 
          onShowDangerMap={onNavigateToDangerMap}
          onShowReportList={onNavigateToReportList}
        />
      </header>

      <main className="settings-page__content">
        <div className="settings-page__section">
          <h2 className="settings-page__section-title">權限設定</h2>
          
          <div className="settings-page__setting-item">
            <div className="settings-page__setting-info">
              <h3 className="settings-page__setting-label">定位權限</h3>
              <p className="settings-page__setting-description">
                允許應用程式存取您的位置資訊，以提供更準確的服務
              </p>
            </div>
            <button
              type="button"
              className="settings-page__permission-btn"
              onClick={handleLocationPermission}
            >
              開啟定位權限
            </button>
          </div>
        </div>
      </main>

      <footer className="settings-page__footer">本服務僅供非緊急事件使用，緊急狀態請撥打119</footer>
    </div>
  )
}

export default SettingsPage

