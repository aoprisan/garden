import { useCallback, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Single owner of the service-worker registration so the update/offline prompts
// (<PwaPrompts>) read one source of truth. `useRegisterSW` must be called once.
export interface PwaUpdate {
  offlineReady: boolean
  setOfflineReady: (v: boolean) => void
  needRefresh: boolean
  setNeedRefresh: (v: boolean) => void
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  checkForUpdate: () => Promise<boolean>
}

export function usePwaUpdate(): PwaUpdate {
  const swRef = useRef<ServiceWorkerRegistration | undefined>(undefined)

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      swRef.current = r ?? undefined
    },
    onRegisterError(err) {
      console.warn('[garden] service worker registration failed', err)
    },
  })

  const checkForUpdate = useCallback(async () => {
    const r = swRef.current
    if (!r) return false
    try {
      await r.update()
    } catch {
      // Offline or the SW isn't controlling yet — nothing to update against.
    }
    return true
  }, [])

  return { offlineReady, setOfflineReady, needRefresh, setNeedRefresh, updateServiceWorker, checkForUpdate }
}
