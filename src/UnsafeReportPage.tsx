import { useState } from 'react'
import './UnsafeReportPage.css'

interface UnsafeReportPageProps {
  onBack: () => void
}

function UnsafeReportPage({ onBack }: UnsafeReportPageProps) {
  const [reason, setReason] = useState<string>('')
  const [suggestion, setSuggestion] = useState<string>('')

  const handleSubmit = () => {
    // TODO: 實作提交功能
    console.log('提交不安全回報', { reason, suggestion })
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
            <path d="M15 6L9 12L15 18" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="unsafe-report-page__headline">不安全回報</span>
        <div className="unsafe-report-page__header-spacer" />
      </header>

      <main className="unsafe-report-page__content" aria-label="不安全回報表單">
        <div className="unsafe-report-page__form">
          <div className="unsafe-report-page__field">
            <label htmlFor="reason" className="unsafe-report-page__label">
              不安全原因<span className="unsafe-report-page__required">*</span>
            </label>
            <select
              id="reason"
              className="unsafe-report-page__select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="">請選擇不安全原因</option>
              <option value="lighting">照明不足</option>
              <option value="surveillance">監視器不足</option>
              <option value="isolation">人煙稀少</option>
              <option value="obstruction">視線受阻</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div className="unsafe-report-page__field">
            <label htmlFor="suggestion" className="unsafe-report-page__label">
              改善建議
            </label>
            <textarea
              id="suggestion"
              className="unsafe-report-page__textarea"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="請描述您認為可以改善的建議..."
              rows={6}
            />
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
          disabled={!reason}
        >
          送出
        </button>
      </div>

      <footer className="unsafe-report-page__footer">撥打 1999 專線 · SafeTrace 測試版</footer>
    </div>
  )
}

export default UnsafeReportPage

