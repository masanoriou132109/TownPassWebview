import './DangerPage.css'

interface DangerPageProps {
  onBack: () => void
}

function DangerPage({ onBack }: DangerPageProps) {
  return (
    <div className="danger-page">
      <header className="danger-page__header">
        <button
          type="button"
          className="danger-page__nav-btn"
          aria-label="返回"
          onClick={onBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="danger-page__headline">我有危險</span>
        <div className="danger-page__header-spacer" />
      </header>

      <main className="danger-page__content" aria-label="我有危險操作">
        <div className="danger-page__map-container">
          {/* 地圖將在這裡實作，等API確認後 */}
        </div>
      </main>

      <div className="danger-page__actions">
        <button type="button" className="danger-page__action-btn">
          匯出資訊
        </button>
        <button type="button" className="danger-page__action-btn danger-page__action-btn--primary">
          前往安全處
        </button>
      </div>

      <footer className="danger-page__footer">撥打 1999 專線 · SafeTrace 測試版</footer>
    </div>
  )
}

export default DangerPage

