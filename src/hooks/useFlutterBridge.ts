import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * 針對 Flutter WebView 所提供的 `window.flutterObject` 做簡易封裝，
 * 讓 React Component 能夠：
 * 1. 派送訊息給 Flutter（對應 TownPass 的 `useConnectionMessage`）
 * 2. 接收 Flutter 回傳的結果（對應 TownPass 的 `useHandleConnectionData`）
 *
 * Flutter 端在 WebView 內部會透過 `addWebMessageListener` 把一個帶有 `postMessage` /
 * `addEventListener` 的物件注入到 window，這裡只做最小限度的型別與流程保護。
 */

type FlutterRawReply = {
  name: string
  data: unknown
}

type BridgeStatus = 'connected' | 'missing' | 'sent'

interface FlutterObject {
  postMessage(payload: string): void
  addEventListener?(event: 'message', listener: (event: { data: string }) => void): void
  removeEventListener?(event: 'message', listener: (event: { data: string }) => void): void
}

declare global {
  interface Window {
    flutterObject?: FlutterObject
  }
}

export const useFlutterBridge = () => {
  const flutterObject = useMemo(() => window.flutterObject, [])

  const [status, setStatus] = useState<BridgeStatus>(() => (flutterObject ? 'connected' : 'missing'))

  const [lastReply, setLastReply] = useState<FlutterRawReply | null>(null)

  useEffect(() => {
    if (!flutterObject?.addEventListener) {
      return
    }

    const handleMessage = (event: { data: string }) => {
      try {
        const parsed = JSON.parse(event.data) as FlutterRawReply
        setLastReply(parsed)
        setStatus('connected')
      } catch (error) {
        console.warn('[FlutterBridge] 無法解析來自 Flutter 的資料', error, event.data)
      }
    }

    flutterObject.addEventListener('message', handleMessage)

    return () => {
      flutterObject.removeEventListener?.('message', handleMessage)
    }
  }, [flutterObject])

  const sendMessage = useCallback(
    (name: string, data: unknown) => {
      if (!flutterObject) {
        setStatus('missing')
        console.warn('[FlutterBridge] 找不到 flutterObject，請確認 WebView 已注入橋接物件。')
        return
      }

      const payload = JSON.stringify({ name, data })
      flutterObject.postMessage(payload)
      setStatus('sent')
    },
    [flutterObject],
  )

  return {
    status,
    lastReply,
    sendMessage,
    isAvailable: Boolean(flutterObject),
  }
}

