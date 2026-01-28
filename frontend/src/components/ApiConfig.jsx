import { useState } from 'react'
import { setApiBaseUrl, getApiBaseUrl } from '../services/api'

export default function ApiConfig({ onSave }) {
  const [url, setUrl] = useState(getApiBaseUrl().replace('/api', ''))
  const [show, setShow] = useState(false)

  const handleSave = () => {
    const cleanUrl = url.trim().replace(/\/$/, '')
    setApiBaseUrl(cleanUrl + '/api')
    setShow(false)
    if (onSave) onSave()
  }

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setShow(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          padding: '10px 16px',
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
        }}
      >
        ⚙️ Sunucu Ayarları
      </button>

      {/* Config Modal */}
      {show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px 0' }}>Sunucu Ayarları</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
              Backend API adresini girin:
            </p>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8000"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShow(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#6b7280',
                  background: 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'white',
                  background: '#6366f1',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
