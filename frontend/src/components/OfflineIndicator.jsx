/**
 * Offline Status Indicator Component
 * Shows online/offline status and pending uploads count
 */
import { useEffect, useState } from 'react'
import { subscribeToNetworkStatus } from '../services/offlineSync'
import { getPendingCount } from '../services/offlineStorage'

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((online) => {
      setIsOnline(online)
    })

    const updateCount = async () => {
      const count = await getPendingCount()
      setPendingCount(count)
    }

    updateCount()
    const interval = setInterval(updateCount, 5000)

    const handleStorageChange = () => {
      updateCount()
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      unsubscribe()
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const { triggerSync } = await import('../services/offlineSync')
      const result = await triggerSync()
      setPendingCount(prev => Math.max(0, prev - result.success))

      if (result.failed > 0) {
        alert(`${result.success} öğrenci senkronize edildi, ${result.failed} başarısız.`)
      }
    } finally {
      setSyncing(false)
    }
  }

  if (isOnline && pendingCount === 0) {
    return null
  }

  const offlineIndicator = !isOnline && (
    <div style={{
      background: '#DC2626',
      color: 'white',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 1l22 22M23 9l-9 5 9-5-9-5-9" />
      </svg>
      <span>Çevrimdışı Modu</span>
    </div>
  )

  const pendingIndicator = pendingCount > 0 && (
    <div style={{
      background: isOnline ? '#F59E0B' : '#991B1B',
      color: 'white',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <span>{pendingCount} bekleyen kayıt</span>
      {isOnline && !syncing && (
        <button
          onClick={handleSync}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            color: 'white'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
        >
          Şimdi Gönder
        </button>
      )}
    </div>
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-end'
    }}>
      {offlineIndicator}
      {pendingIndicator}
    </div>
  )
}

export default OfflineIndicator
