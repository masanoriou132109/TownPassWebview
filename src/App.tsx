import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <span className="app__badge">SafeTrace</span>
        <h1 className="app__headline">危險通報</h1>
        <p className="app__subtitle">快速回報情況，讓我們協助你保持安全</p>
      </header>

      <main className="app__content" aria-label="危險通報操作">
        <section className="module">
          <button type="button" className="module__action module__action--primary">
            我遇到危險
          </button>
          <p className="module__hint">查看附近的安全空間</p>
        </section>

        <div className="divider" role="presentation" />

        <section className="module">
          <button type="button" className="module__action module__action--secondary">
            這裡不安全
          </button>
          <p className="module__hint">回報問題地點</p>
        </section>
      </main>

      <footer className="app__footer">撥打 1999 專線 · SafeTrace 測試版</footer>
    </div>
  )
}

export default App
