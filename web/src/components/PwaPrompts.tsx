import { useEffect } from 'react'
import type { PwaUpdate } from '../hooks/usePwaUpdate'

// Renders the "new build ready" update prompt and the "offline ready" notice off
// the shared PWA state. Offline matters here: a walk is exactly when the phone
// has no signal.
export default function PwaPrompts({ pwa }: { pwa: PwaUpdate }) {
  const { offlineReady, setOfflineReady, needRefresh, setNeedRefresh, updateServiceWorker } = pwa

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 5000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <aside className="pwa-prompt" role="dialog" aria-label="Update available">
        <div>
          <h3>New build ready</h3>
          <p>Reload to take it over — your garden is saved locally.</p>
        </div>
        <button className="btn" onClick={() => updateServiceWorker(true)}>Update</button>
        <button className="btn-ghost" onClick={() => setNeedRefresh(false)}>Later</button>
      </aside>
    )
  }

  if (offlineReady) {
    return (
      <div className="pwa-prompt" role="status">
        <p>Cached — the garden grows offline.</p>
      </div>
    )
  }

  return null
}
