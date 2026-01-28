import { useState, useEffect } from 'react'

function UserModal({ user, onClose, onSave, loading = false }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'teacher'
  })
  const [errors, setErrors] = useState({})

  const isEditing = !!user

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        role: user.role || 'teacher'
      })
    } else {
      setFormData({
        username: '',
        password: '',
        role: 'teacher'
      })
    }
    setErrors({})
  }, [user])

  const validate = () => {
    const newErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Kullanıcı adı gereklidir'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Kullanıcı adı en az 3 karakter olmalıdır'
    }

    if (!isEditing && !formData.password) {
      newErrors.password = 'Şifre gereklidir'
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Şifre en az 6 karakter olmalıdır'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validate()) return

    const payload = {
      username: formData.username,
      role: formData.role
    }

    // Only include password if it's provided
    if (formData.password) {
      payload.password = formData.password
    }

    onSave(payload)
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
            {isEditing ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
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
          {/* Username */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              display: 'block',
              marginBottom: '6px'
            }}>
              Kullanıcı Adı <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={loading}
              placeholder="kullanici_adi"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: errors.username ? '1px solid #EF4444' : '1px solid #E2E8F0',
                borderRadius: '8px',
                outline: 'none',
                background: loading ? '#F1F5F9' : 'white'
              }}
            />
            {errors.username && (
              <span style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                {errors.username}
              </span>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              display: 'block',
              marginBottom: '6px'
            }}>
              Şifre {!isEditing && <span style={{ color: '#EF4444' }}>*</span>}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
              placeholder={isEditing ? 'Değiştirmek için yeni şifre girin' : '••••••'}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: errors.password ? '1px solid #EF4444' : '1px solid #E2E8F0',
                borderRadius: '8px',
                outline: 'none',
                background: loading ? '#F1F5F9' : 'white'
              }}
            />
            {errors.password && (
              <span style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                {errors.password}
              </span>
            )}
            {isEditing && !formData.password && (
              <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                Boş bırakılırsa şifre değiştirilmez
              </span>
            )}
          </div>

          {/* Role */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              display: 'block',
              marginBottom: '6px'
            }}>
              Rol <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={formData.role === 'teacher'}
                  onChange={() => setFormData({ ...formData, role: 'teacher' })}
                  disabled={loading}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: '14px', color: '#475569' }}>Öğretmen</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={formData.role === 'admin'}
                  onChange={() => setFormData({ ...formData, role: 'admin' })}
                  disabled={loading}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: '14px', color: '#475569' }}>Yönetici</span>
              </label>
            </div>
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

export default UserModal
