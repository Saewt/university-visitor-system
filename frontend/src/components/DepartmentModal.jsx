import { useState, useEffect } from 'react'

function DepartmentModal({ department, onClose, onSave, loading = false }) {
  const [formData, setFormData] = useState({
    name: '',
    telegram_chat_id: '',
    active: true
  })
  const [errors, setErrors] = useState({})

  const isEditing = !!department

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        telegram_chat_id: department.telegram_chat_id || '',
        active: department.active !== undefined ? department.active : true
      })
    } else {
      setFormData({
        name: '',
        telegram_chat_id: '',
        active: true
      })
    }
    setErrors({})
  }, [department])

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Bölüm adı gereklidir'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validate()) return

    onSave(formData)
  }

  return (
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
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#0F172A',
            margin: 0
          }}>
            {isEditing ? 'Bölüm Düzenle' : 'Yeni Bölüm'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              color: '#64748B'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              display: 'block',
              marginBottom: '6px'
            }}>
              Bölüm Adı <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
              placeholder="Bilgisayar Mühendisliği"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: errors.name ? '1px solid #EF4444' : '1px solid #E2E8F0',
                borderRadius: '8px',
                outline: 'none',
                background: loading ? '#F1F5F9' : 'white'
              }}
            />
            {errors.name && (
              <span style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                {errors.name}
              </span>
            )}
          </div>

          {/* Telegram Chat ID */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              display: 'block',
              marginBottom: '6px'
            }}>
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={formData.telegram_chat_id}
              onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
              disabled={loading}
              placeholder="-1001234567890"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                outline: 'none',
                background: loading ? '#F1F5F9' : 'white'
              }}
            />
            <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
              Kampüs turu bildirimleri için Telegram bot chat ID
            </span>
          </div>

          {/* Active Status */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                disabled={loading}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              />
              <span style={{ fontSize: '14px', color: '#475569' }}>
                Aktif
              </span>
            </label>
            <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block', marginLeft: '28px' }}>
              Pasif bölümler öğrenci kayıtlarında görünmez
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#64748B',
                background: 'transparent',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                background: loading ? '#94A3B8' : '#0F172A',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DepartmentModal
