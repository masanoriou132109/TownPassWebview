import { useState, useEffect, useRef } from 'react'
import './HamburgerMenu.css'

interface HamburgerMenuProps {
  onShowDangerMap?: () => void
  onShowReportList?: () => void
  onShowSettings?: () => void
  onExportEvidence?: () => void
}

export default function HamburgerMenu({ onShowReportList, onShowSettings, onExportEvidence }: HamburgerMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleToggleMenu = () => {
    setShowMenu(!showMenu)
  }

  const handleCloseMenu = () => {
    setShowMenu(false)
  }

  const handleMenuShowReportList = () => {
    setShowMenu(false)
    if (onShowReportList) {
      onShowReportList()
    }
  }

  const handleMenuShowSettings = () => {
    setShowMenu(false)
    if (onShowSettings) {
      onShowSettings()
    }
  }

  const handleMenuExportEvidence = () => {
    setShowMenu(false)
    if (onExportEvidence) {
      onExportEvidence()
    }
  }

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="hamburger-menu__button"
        aria-label="更多功能"
        onClick={handleToggleMenu}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 7H19" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 12H19" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 17H19" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* 漢堡選單遮罩層 */}
      {showMenu && (
        <div className="hamburger-menu__overlay" onClick={handleCloseMenu} />
      )}

      {/* 漢堡選單 */}
      <div ref={dropdownRef} className={`hamburger-menu ${showMenu ? 'hamburger-menu--active' : ''}`}>
        <div className="hamburger-menu__header">
          <span className="hamburger-menu__title">選單</span>
          <button
            type="button"
            className="hamburger-menu__close-btn"
            onClick={handleCloseMenu}
            aria-label="關閉選單"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 6L18 18" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="hamburger-menu__nav">
          {onShowReportList && (
            <button
              type="button"
              className="hamburger-menu__item"
              onClick={handleMenuShowReportList}
            >
              <span>我的回報列表</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="hamburger-menu__item"
            onClick={handleMenuExportEvidence}
          >
            <span>匯出證據</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {onShowSettings && (
            <button
              type="button"
              className="hamburger-menu__item"
              onClick={handleMenuShowSettings}
            >
              <span>使用設定</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="#475259" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </nav>
      </div>
    </>
  )
}

