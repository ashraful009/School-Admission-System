import { useEffect, useState } from 'react'
import { getApiUrl } from './api/config'

type BackendStatus = 'checking' | 'connected' | 'unreachable'

function App() {
  const [status, setStatus] = useState<BackendStatus>('checking')

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const res = await fetch(`${getApiUrl()}/health`)
        if (!cancelled) {
          setStatus(res.ok ? 'connected' : 'unreachable')
        }
      } catch {
        // Network error — do not log to console; show friendly message in UI
        if (!cancelled) setStatus('unreachable')
      }
    }

    checkHealth()
    return () => { cancelled = true }
  }, [])

  const statusMessages: Record<BackendStatus, string> = {
    checking: 'Backend: checking...',
    connected: 'Backend: connected',
    unreachable: 'Backend: cannot be reached right now. Please try again shortly.',
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>School Admission</h1>
      <p>{statusMessages[status]}</p>
    </div>
  )
}

export default App
